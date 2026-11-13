import { loadConfig, type AppConfig } from './platform/config/index.ts';
import { connectRedis, type RedisHandle } from './platform/cache/index.ts';
import {
  connectMongo,
  MongoUnitOfWork,
  TransactionContext,
  type MongoHandle,
} from './platform/database/index.ts';
import { SystemClock } from './platform/clock.ts';
import type { Probe } from './platform/health/index.ts';
import { createLogger, type Logger } from './platform/logger/index.ts';
import { connectNats, JetStreamPublisher, type NatsHandle } from './platform/messaging/index.ts';
import { OutboxEventBus } from './platform/outbox/index.ts';
import type { Clock, EventBus, MessagePublisher, UnitOfWork } from './shared/application/index.ts';

export interface Container {
  config: AppConfig;
  logger: Logger;
  mongo: MongoHandle;
  redis: RedisHandle;
  nats: NatsHandle;
  transactions: TransactionContext;
  uow: UnitOfWork;
  eventBus: EventBus;
  publisher: MessagePublisher;
  clock: Clock;
  probes: Probe[];
  closers: { name: string; close: () => Promise<void> }[];
}

export async function createContainer(processName: 'api' | 'worker'): Promise<Container> {
  const config = loadConfig();
  const logger = createLogger(config, processName);
  const mongo = await connectMongo(config);
  const redis = await connectRedis(config, logger);
  const nats = await connectNats(config, `doctrack-${processName}`);
  const transactions = new TransactionContext();
  return {
    config,
    logger,
    mongo,
    redis,
    nats,
    transactions,
    uow: new MongoUnitOfWork(mongo.client, transactions),
    eventBus: new OutboxEventBus(mongo.db, transactions),
    publisher: new JetStreamPublisher(nats.connection),
    clock: new SystemClock(),
    probes: [mongo.probe, redis.probe, nats.probe],
    closers: [
      { name: 'nats', close: nats.close },
      { name: 'redis', close: redis.close },
      { name: 'mongo', close: mongo.close },
    ],
  };
}
