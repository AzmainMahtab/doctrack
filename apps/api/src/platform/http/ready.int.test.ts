import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectRedis, type RedisHandle } from '../cache/index.ts';
import { loadConfig } from '../config/index.ts';
import { connectMongo, type MongoHandle } from '../database/index.ts';
import { createLogger } from '../logger/index.ts';
import { connectNats, type NatsHandle } from '../messaging/index.ts';
import { createApp } from './app.ts';
import { systemRoutes } from './system.routes.ts';

describe('readiness against real services', () => {
  const config = loadConfig({ ...process.env, NODE_ENV: 'test' });
  const logger = createLogger(config);
  let mongo: MongoHandle;
  let redis: RedisHandle;
  let nats: NatsHandle;
  let app: ReturnType<typeof createApp>['app'];

  beforeAll(async () => {
    mongo = await connectMongo(config);
    redis = await connectRedis(config, logger);
    nats = await connectNats(config, 'doctrack-int-test');
    const routes = systemRoutes([mongo.probe, redis.probe, nats.probe], config.readyTimeoutMs);
    app = createApp({ config, logger, routes, version: 'test' }).app;
  });

  afterAll(async () => {
    await nats.close();
    await redis.close();
    await mongo.close();
  });

  it('is ready when MongoDB, Redis and NATS are reachable', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.data.checks).toEqual({ mongo: 'up', redis: 'up', nats: 'up' });
  });

  it('connects to a replica set with a writable primary', async () => {
    const hello = await mongo.db.admin().command({ hello: 1 });
    expect(hello.setName).toBe('rs0');
    expect(hello.isWritablePrimary).toBe(true);
  });

  it('returns 503 naming redis once Redis is unreachable, while /health stays up', async () => {
    redis.client.disconnect();
    const ready = await request(app).get('/ready');
    expect(ready.status).toBe(503);
    expect(ready.body.code).toBe('UNAVAILABLE');
    expect(ready.body.detail).toContain('redis');
    expect(ready.headers['retry-after']).toBe('5');
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
  });
});
