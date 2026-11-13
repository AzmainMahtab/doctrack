import { createContainer } from './container.ts';
import { ensureIndexes } from './platform/database/index.ts';
import { createMetrics, startWorkerServer } from './platform/metrics/index.ts';
import {
  ConsumerRunner,
  defaultTopology,
  ensureStreams,
  type DurableEventHandler,
} from './platform/messaging/index.ts';
import { installShutdown } from './platform/lifecycle.ts';
import { OutboxRelay } from './platform/outbox/index.ts';

async function main(): Promise<void> {
  const container = await createContainer('worker');
  const { config, logger, mongo, nats } = container;
  const topology = defaultTopology;

  await ensureIndexes(mongo.db);
  await ensureStreams(nats.jsm, topology);

  const handlers: DurableEventHandler[] = [];

  const relay = new OutboxRelay(mongo.db, container.publisher, topology, logger, {
    batchSize: config.outboxBatch,
    leaseMs: config.outboxLeaseMs,
    pollMs: config.outboxPollMs,
  });
  const runner = new ConsumerRunner({
    connection: nats.connection,
    jsm: nats.jsm,
    db: mongo.db,
    uow: container.uow,
    context: container.transactions,
    logger,
    topology,
    handlers,
    options: { maxDeliver: config.consumerMaxDeliver },
  });

  const registry = createMetrics({
    db: mongo.db,
    jsm: nats.jsm,
    topology,
    relay,
    consumers: handlers.map((h) => h.consumerName),
  });
  const server = await startWorkerServer({
    port: config.workerPort,
    registry,
    probes: container.probes,
    readyTimeoutMs: config.readyTimeoutMs,
    logger,
  });

  await runner.start();
  relay.start();
  logger.info({ port: config.workerPort, handlers: handlers.length }, 'worker ready');

  installShutdown(
    logger,
    [
      { name: 'relay', close: () => relay.stop() },
      { name: 'consumers', close: () => runner.stop() },
      {
        name: 'worker-server',
        close: () =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
          }),
      },
      ...container.closers,
    ],
    config.shutdownTimeoutMs,
  );
  await new Promise<void>(() => undefined);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
