import { createServer } from 'node:http';
import { createContainer } from './container.ts';
import { createApp, systemRoutes } from './platform/http/index.ts';
import { installShutdown } from './platform/lifecycle.ts';

const VERSION = '0.1.0';

async function main(): Promise<void> {
  const container = await createContainer('api');
  const { config, logger } = container;

  const routes = [...systemRoutes(container.probes, config.readyTimeoutMs)];
  const { app } = createApp({ config, logger, routes, version: VERSION });

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
