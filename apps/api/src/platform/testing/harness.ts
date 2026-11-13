import { randomBytes } from 'node:crypto';
import type { AppConfig } from '../config/index.ts';
import { loadConfig } from '../config/index.ts';
import {
  connectMongo,
  ensureIndexes,
  MongoUnitOfWork,
  TransactionContext,
  type MongoHandle,
} from '../database/index.ts';
import { createLogger, type Logger } from '../logger/index.ts';
import {
  connectNats,
  ensureStreams,
  JetStreamPublisher,
  type NatsHandle,
  type Topology,
} from '../messaging/index.ts';
import { OutboxEventBus } from '../outbox/index.ts';
import '../messaging/processed-events.ts';
import { DomainEvent } from '../../shared/domain/index.ts';

export class ThingHappened extends DomainEvent {
  readonly name = 'thing.happened';
}

export interface Harness {
  config: AppConfig;
  logger: Logger;
  mongo: MongoHandle;
  nats: NatsHandle;
  topology: Topology;
  transactions: TransactionContext;
  uow: MongoUnitOfWork;
  bus: OutboxEventBus;
  publisher: JetStreamPublisher;
  close(): Promise<void>;
}

export async function createHarness(): Promise<Harness> {
  const suffix = randomBytes(4).toString('hex');
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    MONGO_DB: `doctrack_test_${suffix}`,
  });
  const logger = createLogger(config);
  const mongo = await connectMongo(config);
  const nats = await connectNats(config, `doctrack-int-${suffix}`);
  const topology: Topology = {
    eventsStream: `EVT_${suffix}`,
    dlqStream: `DLQ_${suffix}`,
    eventPrefix: `e${suffix}`,
    dlqPrefix: `d${suffix}`,
  };
  await ensureIndexes(mongo.db);
  await ensureStreams(nats.jsm, topology);
  const transactions = new TransactionContext();
  return {
    config,
    logger,
    mongo,
    nats,
    topology,
    transactions,
    uow: new MongoUnitOfWork(mongo.client, transactions),
    bus: new OutboxEventBus(mongo.db, transactions),
    publisher: new JetStreamPublisher(nats.connection),
    close: async () => {
      await nats.jsm.streams.delete(topology.eventsStream).catch(() => undefined);
      await nats.jsm.streams.delete(topology.dlqStream).catch(() => undefined);
      await mongo.db.dropDatabase().catch(() => undefined);
      await nats.close();
      await mongo.close();
    },
  };
}

export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  timeoutMs = 10_000,
  intervalMs = 50,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`condition not met within ${timeoutMs} ms`);
}

export const streamMessages = async (h: Harness, stream: string): Promise<number> =>
  (await h.nats.jsm.streams.info(stream)).state.messages;
