import type { EventEnvelope } from '@doctrack/contracts';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DomainEvent } from '../../shared/domain/index.ts';
import { createMetrics } from '../metrics/index.ts';
import { OutboxRelay } from '../outbox/index.ts';
import {
  createHarness,
  streamMessages,
  ThingHappened,
  waitFor,
  type Harness,
} from '../testing/harness.ts';
import { ConsumerRunner, DurableEventHandler } from './durable-consumer.ts';
import { dlqSubject, eventSubject } from './topology.ts';

const OPTIONS = { maxDeliver: 3, ackWaitMs: 5_000, backoffMs: [100, 100], maxMessages: 5 };

describe('durable consumers', () => {
  let h: Harness;
  let runner: ConsumerRunner | undefined;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterEach(async () => {
    await runner?.stop();
    runner = undefined;
  });
  afterAll(async () => {
    await h.close();
  });

  const effects = () => h.mongo.db.collection<{ _id: string; n: number }>('effects');
  const markers = () => h.mongo.db.collection('processed_events');
  const envelope = (id: string, area: string): EventEnvelope => ({
    id,
    name: `${area}.happened`,
    version: 1,
    aggregateId: `agg-${id}`,
    occurredAt: new Date().toISOString(),
    correlationId: null,
    payload: {},
  });
  const send = (e: EventEnvelope, messageId: string) =>
    h.publisher.publish(
      eventSubject(h.topology, e.name),
      new TextEncoder().encode(JSON.stringify(e)),
      messageId,
    );

  class E2eHappened extends DomainEvent {
    readonly name = 'e2e.happened';
  }

  class CountingHandler extends DurableEventHandler {
    readonly consumerName: string;
    readonly subjects: string[];
    constructor(
      name: string,
      private readonly effect: (e: EventEnvelope) => Promise<void>,
    ) {
      super();
      this.consumerName = name;
      this.subjects = [`${name}.>`];
    }
    handle(event: EventEnvelope): Promise<void> {
      return this.effect(event);
    }
  }

  const startRunner = async (handler: DurableEventHandler) => {
    runner = new ConsumerRunner({
      connection: h.nats.connection,
      jsm: h.nats.jsm,
      db: h.mongo.db,
      uow: h.uow,
      context: h.transactions,
      logger: h.logger,
      topology: h.topology,
      handlers: [handler],
      options: OPTIONS,
    });
    await runner.start();
  };

  const increment = async (key: string) => {
    const session = h.transactions.current();
    await effects().updateOne(
      { _id: key },
      { $inc: { n: 1 } },
      { upsert: true, ...(session ? { session } : {}) },
    );
  };

  it('applies the effect once when the same event arrives twice under different message ids', async () => {
    await startRunner(new CountingHandler('dup', () => increment('dup')));
    const e = envelope('dup-event', 'dup');
    await send(e, 'first');
    await send(e, 'second');
    expect(await streamMessages(h, h.topology.eventsStream)).toBeGreaterThanOrEqual(2);
    await waitFor(async () => (await effects().findOne({ _id: 'dup' }))?.n === 1);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect((await effects().findOne({ _id: 'dup' }))?.n).toBe(1);
    expect(await markers().countDocuments({ consumer: 'dup', eventId: 'dup-event' })).toBe(1);
  });

  it('retries a transient failure and processes the event exactly once', async () => {
    let attempts = 0;
    await startRunner(
      new CountingHandler('flaky', async () => {
        attempts += 1;
        await increment('flaky');
        if (attempts === 1) throw new Error('transient');
      }),
    );
    await send(envelope('flaky-event', 'flaky'), 'flaky-1');
    await waitFor(async () => (await markers().countDocuments({ consumer: 'flaky' })) === 1);
    expect(attempts).toBe(2);
    expect((await effects().findOne({ _id: 'flaky' }))?.n).toBe(1);
  });

  it('dead-letters an event after max_deliver failures and leaves no effect or marker', async () => {
    await startRunner(
      new CountingHandler('doomed', async () => {
        await increment('doomed');
        throw new Error('always fails');
      }),
    );
    await send(envelope('doomed-event', 'doomed'), 'doomed-1');
    await waitFor(async () => (await streamMessages(h, h.topology.dlqStream)) === 1);

    const dead = await h.nats.jsm.streams.getMessage(h.topology.dlqStream, {
      last_by_subj: dlqSubject(h.topology, 'doomed'),
    });
    expect(dead?.header.get('Doctrack-Deliveries')).toBe('3');
    expect(dead?.header.get('Doctrack-Error')).toBe('always fails');
    expect(dead?.header.get('Doctrack-Event-Id')).toBe('doomed-event');

    await waitFor(async () => {
      const info = await h.nats.jsm.consumers.info(h.topology.eventsStream, 'doomed');
      return info.num_pending === 0 && info.num_ack_pending === 0;
    });
    expect(await effects().findOne({ _id: 'doomed' })).toBeNull();
    expect(await markers().countDocuments({ consumer: 'doomed' })).toBe(0);
  });

  it('dead-letters a malformed envelope on the first delivery', async () => {
    await startRunner(new CountingHandler('strict', () => increment('strict')));
    await h.publisher.publish(
      eventSubject(h.topology, 'strict.happened'),
      new TextEncoder().encode('{"not":"an envelope"}'),
      'bad-1',
    );
    await waitFor(async () => {
      try {
        const m = await h.nats.jsm.streams.getMessage(h.topology.dlqStream, {
          last_by_subj: dlqSubject(h.topology, 'strict'),
        });
        return m !== null;
      } catch {
        return false;
      }
    });
    expect(await effects().findOne({ _id: 'strict' })).toBeNull();
  });

  it('delivers an outbox event end to end exactly once', async () => {
    await startRunner(new CountingHandler('e2e', () => increment('e2e')));
    const relay = new OutboxRelay(h.mongo.db, h.publisher, h.topology, h.logger, { pollMs: 100 });
    relay.start();
    try {
      await h.uow.withTransaction(() => h.bus.publish(new E2eHappened('e2e-1', {})));
      await waitFor(async () => (await effects().findOne({ _id: 'e2e' }))?.n === 1);
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect((await effects().findOne({ _id: 'e2e' }))?.n).toBe(1);
    } finally {
      await relay.stop();
    }
  });

  it('reports outbox, consumer and dead-letter metrics', async () => {
    await startRunner(new CountingHandler('metered', () => increment('metered')));
    const relay = new OutboxRelay(h.mongo.db, h.publisher, h.topology, h.logger);
    const registry = createMetrics({
      db: h.mongo.db,
      jsm: h.nats.jsm,
      topology: h.topology,
      relay,
      consumers: ['metered'],
    });
    await h.uow.withTransaction(() =>
      h.bus.publishAll([new ThingHappened('m-1', {}), new ThingHappened('m-2', {})]),
    );
    const text = await registry.metrics();
    expect(text).toMatch(/doctrack_outbox_pending 2\b/);
    expect(text).toMatch(/doctrack_outbox_oldest_pending_age_seconds [0-9.]+/);
    expect(text).toMatch(/doctrack_consumer_pending\{consumer="metered"\} 0\b/);
    const dead = await streamMessages(h, h.topology.dlqStream);
    expect(text).toContain(`doctrack_dlq_messages ${dead}`);
  });
});
