import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MessagePublisher } from '../../shared/application/index.ts';
import {
  createHarness,
  streamMessages,
  ThingHappened,
  waitFor,
  type Harness,
} from '../testing/harness.ts';
import { OUTBOX, type OutboxDoc } from './outbox.ts';
import { OutboxRelay } from './relay.ts';

class RecordingPublisher extends MessagePublisher {
  readonly calls = new Map<string, number>();
  async publish(_subject: string, _payload: Uint8Array, messageId: string): Promise<void> {
    this.calls.set(messageId, (this.calls.get(messageId) ?? 0) + 1);
  }
}

describe('outbox relay', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h.close();
  });

  const outbox = () => h.mongo.db.collection<OutboxDoc>(OUTBOX);
  const publishEvents = async (events: ThingHappened[]) => {
    await h.uow.withTransaction(() => h.bus.publishAll(events));
  };
  const drain = async (relay: OutboxRelay) => {
    while ((await relay.runOnce()) > 0) {
      /* keep draining */
    }
  };

  it('publishes rows to the stream in order and marks them published', async () => {
    const before = await streamMessages(h, h.topology.eventsStream);
    const events = Array.from({ length: 20 }, (_, i) => new ThingHappened(`a-${i}`, { i }));
    await publishEvents(events);
    const relay = new OutboxRelay(h.mongo.db, h.publisher, h.topology, h.logger);
    await drain(relay);

    expect(await streamMessages(h, h.topology.eventsStream)).toBe(before + 20);
    const ids: string[] = [];
    for (let seq = before + 1; seq <= before + 20; seq++) {
      const stored = await h.nats.jsm.streams.getMessage(h.topology.eventsStream, { seq });
      ids.push((JSON.parse(new TextDecoder().decode(stored?.data)) as { id: string }).id);
    }
    expect(ids).toEqual(events.map((e) => e.id));
    expect(await outbox().countDocuments({ status: 'published', _id: { $in: ids } })).toBe(20);
  });

  it('deduplicates the same message id inside the stream', async () => {
    const before = await streamMessages(h, h.topology.eventsStream);
    const subject = `${h.topology.eventPrefix}.thing.happened`;
    const body = new TextEncoder().encode('{}');
    await h.publisher.publish(subject, body, 'same-id');
    await h.publisher.publish(subject, body, 'same-id');
    expect(await streamMessages(h, h.topology.eventsStream)).toBe(before + 1);
  });

  it('re-publishes after a crash between publish and mark without duplicating in the stream', async () => {
    const before = await streamMessages(h, h.topology.eventsStream);
    const events = Array.from({ length: 5 }, (_, i) => new ThingHappened(`c-${i}`, { i }));
    await publishEvents(events);
    const ids = events.map((e) => e.id);

    const crashing = new OutboxRelay(
      h.mongo.db,
      h.publisher,
      h.topology,
      h.logger,
      { leaseMs: 300 },
      {
        beforeMark: async () => {
          throw new Error('crash before mark');
        },
      },
    );
    await expect(crashing.runOnce()).rejects.toThrow('crash before mark');
    expect(await streamMessages(h, h.topology.eventsStream)).toBe(before + 5);
    expect(await outbox().countDocuments({ _id: { $in: ids }, status: 'claimed' })).toBe(5);

    await new Promise((resolve) => setTimeout(resolve, 400));
    const recovering = new OutboxRelay(h.mongo.db, h.publisher, h.topology, h.logger, {
      leaseMs: 300,
    });
    await drain(recovering);

    expect(await outbox().countDocuments({ _id: { $in: ids }, status: 'published' })).toBe(5);
    expect(await streamMessages(h, h.topology.eventsStream)).toBe(before + 5);
  });

  it('never publishes the same row twice when two relays run concurrently', async () => {
    const docs: OutboxDoc[] = Array.from({ length: 200 }, (_, i) => ({
      _id: `bulk-${String(i).padStart(4, '0')}`,
      type: 'thing.happened',
      aggregateId: `bulk-${i}`,
      payload: {},
      meta: { correlationId: null, occurredAt: new Date(), version: 1, actorId: null },
      status: 'pending',
      attempts: 0,
      leaseUntil: null,
      claimToken: null,
      publishedAt: null,
    }));
    await outbox().insertMany(docs);
    const recorder = new RecordingPublisher();
    const options = { batchSize: 20, leaseMs: 30_000 };
    const a = new OutboxRelay(h.mongo.db, recorder, h.topology, h.logger, options);
    const b = new OutboxRelay(h.mongo.db, recorder, h.topology, h.logger, options);
    await Promise.all([drain(a), drain(b)]);

    expect(recorder.calls.size).toBe(200);
    expect([...recorder.calls.values()].every((count) => count === 1)).toBe(true);
    expect(await outbox().countDocuments({ _id: /^bulk-/, status: 'published' })).toBe(200);
    expect(a.publishedCount + b.publishedCount).toBe(200);
  });

  it('is woken by the change stream well before the poll interval', async () => {
    const before = await streamMessages(h, h.topology.eventsStream);
    const relay = new OutboxRelay(h.mongo.db, h.publisher, h.topology, h.logger, {
      pollMs: 10_000,
    });
    relay.start();
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const started = Date.now();
      await publishEvents([new ThingHappened('wake-1', {})]);
      await waitFor(
        async () => (await streamMessages(h, h.topology.eventsStream)) === before + 1,
        5_000,
      );
      expect(Date.now() - started).toBeLessThan(3_000);
    } finally {
      await relay.stop();
    }
  });

  it('backs off and keeps the row when the broker publish fails', async () => {
    class FailingPublisher extends MessagePublisher {
      async publish(): Promise<void> {
        throw new Error('broker down');
      }
    }
    const event = new ThingHappened('fail-1', {});
    await publishEvents([event]);
    const relay = new OutboxRelay(h.mongo.db, new FailingPublisher(), h.topology, h.logger);
    expect(await relay.runOnce()).toBe(0);
    const row = await outbox().findOne({ _id: event.id });
    expect(row?.status).toBe('pending');
    expect(row?.attempts).toBe(1);
    expect(row?.leaseUntil?.getTime()).toBeGreaterThan(Date.now());
    await outbox().deleteOne({ _id: event.id });
  });
});
