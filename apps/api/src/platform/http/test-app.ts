import { createLogger } from '../logger/index.ts';
import { createApp } from './app.ts';
import { defineRoute, type RouteDefinition } from './define-route.ts';
import { systemRoutes } from './system.routes.ts';
import type { Probe } from '../health/index.ts';
import { z } from '@doctrack/contracts';
import { AllowAllLimiter, FakeAuthenticator } from '../testing/fakes.ts';

export const upProbe = (name: string): Probe => ({ name, check: async () => undefined });
export const downProbe = (name: string): Probe => ({
  name,
  check: async () => {
    throw new Error('down');
  },
});

export const fixtureRoutes = (): RouteDefinition[] => [
  defineRoute({
    method: 'post',
    path: '/things/:id',
    summary: 'Fixture route',
    tags: ['Test'],
    request: {
      params: z.object({ id: z.string().uuid() }),
      query: z.object({ n: z.coerce.number().int().min(1).default(1) }),
      body: z.object({ name: z.string().min(2), email: z.string().email() }),
    },
    responses: { 201: { description: 'Created' } },
    handler: async ({ params, query, body }) => ({
      status: 201,
      data: { id: params.id, n: query.n, name: body.name },
      meta: { total: 1 },
    }),
  }),
  defineRoute({
    method: 'get',
    path: '/boom',
    summary: 'Throws an unexpected error',
    tags: ['Test'],
    public: true,
    responses: { 200: { description: 'never' } },
    handler: async () => {
      throw new Error('secret database password leaked');
    },
  }),
  defineRoute({
    method: 'delete',
    path: '/things/:id',
    summary: 'No content',
    tags: ['Test'],
    request: { params: z.object({ id: z.string() }) },
    responses: { 204: { description: 'Deleted' } },
    handler: async () => ({ status: 204 }),
  }),
];

export function buildTestApp(
  probes: Probe[] = [upProbe('mongo')],
  extra: RouteDefinition[] = fixtureRoutes(),
) {
  const routes = [...systemRoutes(probes, 500), ...extra];
  const logger = createLogger({ env: 'test', logLevel: 'silent' });
  return {
    ...createApp({
      config: { trustProxyHops: 1 },
      logger,
      routes,
      version: 'test',
      cookies: { secure: false },
      authenticator: new FakeAuthenticator(),
      limiter: new AllowAllLimiter(),
    }),
    routes,
  };
}
