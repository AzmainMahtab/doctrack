import { createContainer } from './container.ts';
import { installShutdown } from './platform/lifecycle.ts';

async function main(): Promise<void> {
  const container = await createContainer('worker');
  const { config, logger } = container;
  logger.info('worker ready');
  installShutdown(logger, container.closers, config.shutdownTimeoutMs);
  await new Promise<void>(() => undefined);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
