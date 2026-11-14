import { readFileSync } from 'node:fs';
import { createContainer } from './container.ts';
import { createIdentityModule } from './modules/identity/index.ts';
import { ensureIndexes } from './platform/database/index.ts';
import { RedisRateLimiter } from './platform/rate-limit/index.ts';
import './register-indexes.ts';

async function main(): Promise<void> {
  const container = await createContainer('api');
  const { config, logger } = container;
  const { adminPassword, viewerPassword } = config.seed;
  if (!config.jwtPrivateKeyPath) throw new Error('JWT_PRIVATE_KEY_PATH is required');
  if (!adminPassword || !viewerPassword) {
    throw new Error('SEED_ADMIN_PASSWORD and SEED_VIEWER_PASSWORD are required (12+ characters)');
  }

  await ensureIndexes(container.mongo.db);
  const identity = createIdentityModule({
    db: container.mongo.db,
    redis: container.redis.client,
    transactions: container.transactions,
    uow: container.uow,
    eventBus: container.eventBus,
    clock: container.clock,
    limiter: new RedisRateLimiter(container.redis.client),
    privateKeyPem: readFileSync(config.jwtPrivateKeyPath, 'utf8'),
    settings: {
      accessTtlSeconds: config.accessTokenTtlSeconds,
      refreshTtlSeconds: config.refreshTokenTtlSeconds,
    },
  });

  const admin = await identity.ensureUser.execute({
    email: config.seed.adminEmail,
    password: adminPassword,
    role: 'admin',
  });
  const viewer = await identity.ensureUser.execute({
    email: config.seed.viewerEmail,
    password: viewerPassword,
    role: 'viewer',
  });
  logger.info({ admin, viewer }, 'seed complete');
  console.log(`admin ${config.seed.adminEmail}: ${admin}`);
  console.log(`viewer ${config.seed.viewerEmail}: ${viewer}`);
  for (const closer of container.closers) await closer.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
