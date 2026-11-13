import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  MONGO_URI: z.string().min(1),
  MONGO_DB: z.string().min(1).default('doctrack'),
  REDIS_URL: z.string().min(1),
  NATS_URL: z.string().min(1),
  NATS_USER: z.string().optional(),
  NATS_PASSWORD: z.string().optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  READY_TIMEOUT_MS: z.coerce.number().int().min(100).max(10000).default(2000),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
  WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(9090),
  OUTBOX_POLL_MS: z.coerce.number().int().min(50).max(60000).default(1000),
  OUTBOX_BATCH: z.coerce.number().int().min(1).max(1000).default(100),
  OUTBOX_LEASE_MS: z.coerce.number().int().min(100).max(300000).default(30000),
  CONSUMER_MAX_DELIVER: z.coerce.number().int().min(1).max(20).default(5),
});

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  port: number;
  logLevel: string;
  mongoUri: string;
  mongoDb: string;
  redisUrl: string;
  natsUrl: string;
  natsUser?: string;
  natsPassword?: string;
  trustProxyHops: number;
  readyTimeoutMs: number;
  shutdownTimeoutMs: number;
  workerPort: number;
  outboxPollMs: number;
  outboxBatch: number;
  outboxLeaseMs: number;
  consumerMaxDeliver: number;
}

export class ConfigError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid configuration:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  const v = parsed.data;
  const config: AppConfig = {
    env: v.NODE_ENV,
    port: v.PORT,
    logLevel: v.LOG_LEVEL,
    mongoUri: v.MONGO_URI,
    mongoDb: v.MONGO_DB,
    redisUrl: v.REDIS_URL,
    natsUrl: v.NATS_URL,
    trustProxyHops: v.TRUST_PROXY_HOPS,
    readyTimeoutMs: v.READY_TIMEOUT_MS,
    shutdownTimeoutMs: v.SHUTDOWN_TIMEOUT_MS,
    workerPort: v.WORKER_PORT,
    outboxPollMs: v.OUTBOX_POLL_MS,
    outboxBatch: v.OUTBOX_BATCH,
    outboxLeaseMs: v.OUTBOX_LEASE_MS,
    consumerMaxDeliver: v.CONSUMER_MAX_DELIVER,
  };
  if (v.NATS_USER !== undefined) config.natsUser = v.NATS_USER;
  if (v.NATS_PASSWORD !== undefined) config.natsPassword = v.NATS_PASSWORD;
  return config;
}
