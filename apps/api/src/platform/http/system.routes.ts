import { HealthSchema, ReadinessSchema, z } from '@doctrack/contracts';
import { AppError } from '../../shared/errors/index.ts';
import { runProbes, type Probe } from '../health/index.ts';
import { defineRoute, type RouteDefinition } from './define-route.ts';

export function systemRoutes(probes: readonly Probe[], timeoutMs: number): RouteDefinition[] {
  const health = defineRoute({
    method: 'get',
    path: '/health',
    summary: 'Liveness probe',
    tags: ['System'],
    public: true,
    responses: {
      200: { description: 'The process is running', schema: z.object({ data: HealthSchema }) },
    },
    handler: async () => ({ status: 200, data: { status: 'ok' } }),
  });

  const ready = defineRoute({
    method: 'get',
    path: '/ready',
    summary: 'Readiness probe: MongoDB, Redis and NATS are reachable',
    tags: ['System'],
    public: true,
    responses: {
      200: {
        description: 'All dependencies are reachable',
        schema: z.object({ data: ReadinessSchema }),
      },
      503: { description: 'At least one dependency is unavailable' },
    },
    handler: async () => {
      const results = await runProbes(probes, timeoutMs);
      const down = results.filter((r) => !r.ok).map((r) => r.name);
      if (down.length > 0) {
        throw AppError.unavailable(5, `Dependencies unavailable: ${down.join(', ')}.`);
      }
      return {
        status: 200,
        data: {
          status: 'ready',
          checks: Object.fromEntries(results.map((r) => [r.name, 'up'])),
        },
      };
    },
  });

  return [health, ready];
}
