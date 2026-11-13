import { Redis } from 'ioredis';
import type { AppConfig } from '../config/index.ts';
import type { Logger } from '../logger/index.ts';
import type { Probe } from '../health/index.ts';

export interface RedisHandle {
  client: Redis;
  probe: Probe;
  close(): Promise<void>;
}

export async function connectRedis(config: AppConfig, logger: Logger): Promise<RedisHandle> {
  const client = new Redis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    commandTimeout: 1500,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
  });
  client.on('error', (error) => logger.warn({ err: error }, 'redis error'));
  await client.connect();
  return {
    client,
    probe: {
      name: 'redis',
      check: async () => {
        const reply = await client.ping();
        if (reply !== 'PONG') throw new Error(`unexpected reply ${reply}`);
      },
    },
    close: async () => {
      await client.quit().catch(() => client.disconnect());
    },
  };
}
