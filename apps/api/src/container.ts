import { loadConfig, type AppConfig } from './platform/config/index.ts';
import { connectRedis, type RedisHandle } from './platform/cache/index.ts';
import { connectMongo, type MongoHandle } from './platform/database/index.ts';
import type { Probe } from './platform/health/index.ts';
import { createLogger, type Logger } from './platform/logger/index.ts';
import { connectNats, type NatsHandle } from './platform/messaging/index.ts';

export interface Container {
  config: AppConfig;
  logger: Logger;
  mongo: MongoHandle;
  redis: RedisHandle;
  nats: NatsHandle;
  probes: Probe[];
  closers: { name: string; close: () => Promise<void> }[];
}

export async function createContainer(processName: 'api' | 'worker'): Promise<Container> {
  const config = loadConfig();
  const logger = createLogger(config, processName);
  const mongo = await connectMongo(config);
  const redis = await connectRedis(config, logger);
  const nats = await connectNats(config, `doctrack-${processName}`);
  return {
    config,
    logger,
    mongo,
    redis,
    nats,
    probes: [mongo.probe, redis.probe, nats.probe],
    closers: [
      { name: 'nats', close: nats.close },
      { name: 'redis', close: redis.close },
      { name: 'mongo', close: mongo.close },
    ],
  };
}
