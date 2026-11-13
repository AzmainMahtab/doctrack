import type { Logger } from './logger/index.ts';

type Closer = { name: string; close: () => Promise<void> };

export function installShutdown(
  logger: Logger,
  closers: Closer[],
  timeoutMs: number,
): () => Promise<void> {
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    const timer = setTimeout(() => {
      logger.error('shutdown timed out, forcing exit');
      process.exit(1);
    }, timeoutMs);
    timer.unref();
    for (const closer of closers) {
      try {
        await closer.close();
      } catch (error) {
        logger.warn({ err: error, closer: closer.name }, 'close failed');
      }
    }
    logger.info('shutdown complete');
    process.exit(0);
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
  return () => shutdown('manual');
}
