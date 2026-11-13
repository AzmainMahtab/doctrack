import { createServer, type Server } from 'node:http';
import type { Registry } from 'prom-client';
import { runProbes, type Probe } from '../health/index.ts';
import type { Logger } from '../logger/index.ts';

export interface WorkerServerOptions {
  port: number;
  registry: Registry;
  probes: readonly Probe[];
  readyTimeoutMs: number;
  logger: Logger;
}

export async function startWorkerServer(options: WorkerServerOptions): Promise<Server> {
  const { registry, probes, readyTimeoutMs, logger } = options;
  const server = createServer((req, res) => {
    void (async () => {
      try {
        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"status":"ok"}');
        } else if (req.url === '/ready') {
          const results = await runProbes(probes, readyTimeoutMs);
          const ok = results.every((r) => r.ok);
          res
            .writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json' })
            .end(JSON.stringify({ status: ok ? 'ready' : 'unavailable', checks: results }));
        } else if (req.url === '/metrics') {
          res
            .writeHead(200, { 'Content-Type': registry.contentType })
            .end(await registry.metrics());
        } else {
          res.writeHead(404).end();
        }
      } catch (error) {
        logger.error({ err: error }, 'worker server error');
        res.writeHead(500).end();
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(options.port, resolve));
  return server;
}
