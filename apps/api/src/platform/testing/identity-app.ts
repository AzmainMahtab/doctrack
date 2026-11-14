import { generateKeyPairSync } from 'node:crypto';
import { z } from '@doctrack/contracts';
import { createIdentityModule } from '../../modules/identity/index.ts';
import { connectRedis, type RedisHandle } from '../cache/index.ts';
import { SystemClock } from '../clock.ts';
import { createApp, defineRoute, systemRoutes } from '../http/index.ts';
import { defaultPolicies, RedisRateLimiter, type PolicyTable } from '../rate-limit/index.ts';
import type { Harness } from './harness.ts';

export const API_TEST = '/api/v1/_test';

export interface IdentityAppOptions {
  policies?: Partial<PolicyTable>;
  accessTtlSeconds?: number;
  redis?: RedisHandle;
}

export async function createIdentityApp(h: Harness, options: IdentityAppOptions = {}) {
  const redis = options.redis ?? h.redis;
  const pem = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({
    type: 'pkcs8',
    format: 'pem',
  }) as string;
  const limiter = new RedisRateLimiter(redis.client);
  const identity = createIdentityModule({
    db: h.mongo.db,
    redis: redis.client,
    transactions: h.transactions,
    uow: h.uow,
    eventBus: h.bus,
    clock: new SystemClock(),
    limiter,
    privateKeyPem: pem,
    settings: { accessTtlSeconds: options.accessTtlSeconds ?? 900, refreshTtlSeconds: 604800 },
  });

  const fixtures = [
    defineRoute({
      method: 'get',
      path: `${API_TEST}/read`,
      summary: 'Read fixture',
      tags: ['Test'],
      permission: 'doctors:read',
      responses: {
        200: { description: 'ok', schema: z.object({ data: z.object({ ok: z.boolean() }) }) },
      },
      handler: async () => ({ status: 200, data: { ok: true } }),
    }),
    defineRoute({
      method: 'post',
      path: `${API_TEST}/write`,
      summary: 'Write fixture',
      tags: ['Test'],
      permission: 'doctors:write',
      responses: {
        200: { description: 'ok', schema: z.object({ data: z.object({ ok: z.boolean() }) }) },
      },
      handler: async () => ({ status: 200, data: { ok: true } }),
    }),
  ];

  const routes = [
    ...systemRoutes([h.mongo.probe, redis.probe], 500),
    ...identity.routes,
    ...fixtures,
  ];
  const built = createApp({
    config: { trustProxyHops: 1 },
    logger: h.logger,
    routes,
    version: 'test',
    cookies: { secure: false },
    authenticator: identity.authenticator,
    limiter,
    policies: { ...defaultPolicies, ...options.policies },
  });
  return { ...built, identity, redis, routes };
}

export async function connectOwnRedis(h: Harness): Promise<RedisHandle> {
  return connectRedis(h.config, h.logger);
}
