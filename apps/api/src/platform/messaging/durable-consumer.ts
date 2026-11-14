import { EventEnvelopeSchema, type EventEnvelope } from '@doctrack/contracts';
import {
  AckPolicy,
  DeliverPolicy,
  jetstream,
  type ConsumerMessages,
  type JetStreamClient,
  type JetStreamManager,
  type JsMsg,
} from '@nats-io/jetstream';
import { headers as natsHeaders, type NatsConnection } from '@nats-io/transport-node';
import { MongoServerError, type Db } from 'mongodb';
import type { UnitOfWork } from '../../shared/application/index.ts';
import type { TransactionContext } from '../database/index.ts';
import type { Logger } from '../logger/index.ts';
import { PROCESSED_EVENTS_COLLECTION } from './processed-events.ts';
import { dlqSubject, eventSubject, type Topology } from './topology.ts';

export abstract class DurableEventHandler {
  abstract readonly consumerName: string;
  abstract readonly subjects: string[];
  abstract handle(event: EventEnvelope): Promise<void>;

  afterCommit(_event: EventEnvelope): Promise<void> {
    return Promise.resolve();
  }
}

export interface ConsumerOptions {
  maxDeliver: number;
  ackWaitMs: number;
  backoffMs: number[];
  maxMessages: number;
}

export const defaultConsumerOptions: ConsumerOptions = {
  maxDeliver: 5,
  ackWaitMs: 30_000,
  backoffMs: [1_000, 5_000, 30_000, 120_000],
  maxMessages: 10,
};

class AlreadyProcessed extends Error {}

const MS_NS = 1e6;

const headerSafe = (value: string): string =>
  value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
const DUPLICATE_KEY = 11000;

export class ConsumerRunner {
  private readonly js: JetStreamClient;
  private readonly sessions: ConsumerMessages[] = [];
  private readonly loops: Promise<void>[] = [];
  private stopping = false;

  constructor(
    private readonly deps: {
      connection: NatsConnection;
      jsm: JetStreamManager;
      db: Db;
      uow: UnitOfWork;
      context: TransactionContext;
      logger: Logger;
      topology: Topology;
      handlers: readonly DurableEventHandler[];
      options?: Partial<ConsumerOptions>;
    },
  ) {
    this.js = jetstream(deps.connection);
  }

  private get options(): ConsumerOptions {
    return { ...defaultConsumerOptions, ...this.deps.options };
  }

  async start(): Promise<void> {
    for (const handler of this.deps.handlers) {
      await this.ensureConsumer(handler);
      const consumer = await this.js.consumers.get(
        this.deps.topology.eventsStream,
        handler.consumerName,
      );
      const messages = await consumer.consume({ max_messages: this.options.maxMessages });
      this.sessions.push(messages);
      this.loops.push(this.pump(handler, messages));
    }
  }

  async stop(): Promise<void> {
    this.stopping = true;
    for (const session of this.sessions) session.stop();
    await Promise.allSettled(this.loops);
  }

  private async ensureConsumer(handler: DurableEventHandler): Promise<void> {
    const { topology, jsm } = this.deps;
    const options = this.options;
    const config = {
      durable_name: handler.consumerName,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      filter_subjects: handler.subjects.map((s) => eventSubject(topology, s)),
      max_deliver: options.maxDeliver,
      ack_wait: options.ackWaitMs * MS_NS,
      backoff: options.backoffMs.slice(0, options.maxDeliver - 1).map((ms) => ms * MS_NS),
    };
    try {
      await jsm.consumers.add(topology.eventsStream, config);
    } catch {
      await jsm.consumers.update(topology.eventsStream, handler.consumerName, config);
    }
  }

  private async pump(handler: DurableEventHandler, messages: ConsumerMessages): Promise<void> {
    try {
      for await (const message of messages) {
        await this.process(handler, message);
      }
    } catch (error) {
      if (!this.stopping) this.deps.logger.error({ err: error }, 'consumer loop failed');
    }
  }

  private async process(handler: DurableEventHandler, message: JsMsg): Promise<void> {
    let envelope: EventEnvelope;
    try {
      envelope = EventEnvelopeSchema.parse(JSON.parse(message.string()));
    } catch (error) {
      await this.deadLetter(handler, message, error, 'malformed envelope');
      return;
    }

    try {
      await this.deps.uow.withTransaction(async () => {
        await this.markProcessed(handler.consumerName, envelope.id);
        await handler.handle(envelope);
      });
      await handler.afterCommit(envelope).catch((hookError: unknown) => {
        this.deps.logger.warn(
          { err: hookError, consumer: handler.consumerName, eventId: envelope.id },
          'afterCommit hook failed',
        );
      });
      message.ack();
    } catch (error) {
      if (error instanceof AlreadyProcessed) {
        message.ack();
        return;
      }
      await this.fail(handler, message, envelope, error);
    }
  }

  private async markProcessed(consumer: string, eventId: string): Promise<void> {
    const session = this.deps.context.current();
    try {
      await this.deps.db
        .collection(PROCESSED_EVENTS_COLLECTION)
        .insertOne({ consumer, eventId, processedAt: new Date() }, session ? { session } : {});
    } catch (error) {
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
        throw new AlreadyProcessed();
      }
      throw error;
    }
  }

  private async fail(
    handler: DurableEventHandler,
    message: JsMsg,
    envelope: EventEnvelope,
    error: unknown,
  ): Promise<void> {
    const { maxDeliver, backoffMs } = this.options;
    const deliveries = message.info.deliveryCount;
    if (deliveries >= maxDeliver) {
      await this.deadLetter(
        handler,
        message,
        error,
        `failed after ${deliveries} deliveries`,
        envelope.id,
      );
      return;
    }
    const delay = backoffMs[Math.min(deliveries - 1, backoffMs.length - 1)] ?? 1_000;
    this.deps.logger.warn(
      { err: error, consumer: handler.consumerName, eventId: envelope.id, deliveries },
      'handler failed, retrying',
    );
    message.nak(delay);
  }

  private async deadLetter(
    handler: DurableEventHandler,
    message: JsMsg,
    error: unknown,
    reason: string,
    eventId?: string,
  ): Promise<void> {
    const { topology, logger } = this.deps;
    const hdrs = natsHeaders();
    hdrs.set('Doctrack-Error', headerSafe(error instanceof Error ? error.message : String(error)));
    hdrs.set('Doctrack-Reason', headerSafe(reason));
    hdrs.set('Doctrack-Deliveries', String(message.info.deliveryCount));
    hdrs.set('Doctrack-Original-Subject', message.subject);
    if (eventId) hdrs.set('Doctrack-Event-Id', eventId);
    try {
      await this.js.publish(dlqSubject(topology, handler.consumerName), message.data, {
        headers: hdrs,
      });
      message.term(reason);
      logger.error({ consumer: handler.consumerName, eventId, reason }, 'event dead-lettered');
    } catch (publishError) {
      logger.error(
        { err: publishError, consumer: handler.consumerName },
        'dead-letter publish failed',
      );
      message.nak(5_000);
    }
  }
}
