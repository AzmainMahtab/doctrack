import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createContainer } from './container.ts';
import { createDoctorsModule } from './modules/doctors/index.ts';
import { createIdentityModule } from './modules/identity/index.ts';
import { createPatientsModule } from './modules/patients/index.ts';
import { createApp, systemRoutes } from './platform/http/index.ts';
import { installShutdown } from './platform/lifecycle.ts';
import { RedisRateLimiter } from './platform/rate-limit/index.ts';

const VERSION = '0.1.0';

async function main(): Promise<void> {
  const container = await createContainer('api');
  const { config, logger } = container;
  if (!config.jwtPrivateKeyPath) throw new Error('JWT_PRIVATE_KEY_PATH is required for the api');

  const limiter = new RedisRateLimiter(container.redis.client);
  const identity = createIdentityModule({
    db: container.mongo.db,
    redis: container.redis.client,
    transactions: container.transactions,
    uow: container.uow,
    eventBus: container.eventBus,
    clock: container.clock,
    limiter,
    privateKeyPem: readFileSync(config.jwtPrivateKeyPath, 'utf8'),
    settings: {
      accessTtlSeconds: config.accessTokenTtlSeconds,
      refreshTtlSeconds: config.refreshTokenTtlSeconds,
    },
  });

  const domain = {
    db: container.mongo.db,
    transactions: container.transactions,
    uow: container.uow,
    eventBus: container.eventBus,
    clock: container.clock,
  };
  const doctors = createDoctorsModule(domain);
  const patients = createPatientsModule({ ...domain, doctors: doctors.api });

  const routes = [
    ...systemRoutes(container.probes, config.readyTimeoutMs),
    ...identity.routes,
    ...doctors.routes,
    ...patients.routes,
  ];
  const { app } = createApp({
    config,
    logger,
    routes,
    version: VERSION,
    cookies: {
      secure: config.cookieSecure,
      ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
    },
    authenticator: identity.authenticator,
    limiter,
  });

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(config.port, resolve));
  logger.info({ port: config.port }, 'api listening');

  installShutdown(
    logger,
    [
      {
        name: 'http',
        close: () =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeIdleConnections();
          }),
      },
      ...container.closers,
    ],
    config.shutdownTimeoutMs,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
