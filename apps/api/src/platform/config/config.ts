import { z } from 'zod';

const blankToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

const schema = z.preprocess(
  (raw) =>
    raw && typeof raw === 'object'
      ? Object.fromEntries(
          Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, blankToUndefined(v)]),
        )
      : raw,
  z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(8080),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
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
    JWT_PRIVATE_KEY_PATH: z.string().min(1).optional(),
    ACCESS_TOKEN_TTL_S: z.coerce.number().int().min(1).max(86400).default(900),
    REFRESH_TOKEN_TTL_S: z.coerce.number().int().min(60).max(7776000).default(604800),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    COOKIE_DOMAIN: z.string().min(1).optional(),
    SEED_ADMIN_EMAIL: z.email().default('admin@doctrack.dev'),
    SEED_ADMIN_PASSWORD: z.string().min(12).max(128).optional(),
    SEED_VIEWER_EMAIL: z.email().default('viewer@doctrack.dev'),
    SEED_VIEWER_PASSWORD: z.string().min(12).max(128).optional(),
  }),
);

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
  jwtPrivateKeyPath?: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  cookieSecure: boolean;
  cookieDomain?: string;
  seed: {
    adminEmail: string;
    adminPassword?: string;
    viewerEmail: string;
    viewerPassword?: string;
  };
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
    accessTokenTtlSeconds: v.ACCESS_TOKEN_TTL_S,
    refreshTokenTtlSeconds: v.REFRESH_TOKEN_TTL_S,
    cookieSecure: v.COOKIE_SECURE ?? v.NODE_ENV === 'production',
    seed: { adminEmail: v.SEED_ADMIN_EMAIL, viewerEmail: v.SEED_VIEWER_EMAIL },
  };
  if (v.JWT_PRIVATE_KEY_PATH !== undefined) config.jwtPrivateKeyPath = v.JWT_PRIVATE_KEY_PATH;
  if (v.COOKIE_DOMAIN !== undefined) config.cookieDomain = v.COOKIE_DOMAIN;
  if (v.SEED_ADMIN_PASSWORD !== undefined) config.seed.adminPassword = v.SEED_ADMIN_PASSWORD;
  if (v.SEED_VIEWER_PASSWORD !== undefined) config.seed.viewerPassword = v.SEED_VIEWER_PASSWORD;
  if (v.NATS_USER !== undefined) config.natsUser = v.NATS_USER;
  if (v.NATS_PASSWORD !== undefined) config.natsPassword = v.NATS_PASSWORD;
  return config;
}
