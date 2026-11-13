import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../shared/errors/index.ts';
import { defineRoute } from './define-route.ts';
import { buildTestApp, downProbe, upProbe } from './test-app.ts';

const UUID = '0190a3d4-7c1e-7a2b-8f3e-1234567890ab';

describe('problem details', () => {
  it('returns a 404 Problem for an unknown route', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      type: 'https://doctrack.app/problems/not-found',
      status: 404,
      code: 'NOT_FOUND',
      instance: '/nope',
    });
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('maps every AppError factory to its status and code', async () => {
    const cases: [AppError, number, string][] = [
      [AppError.badRequest('x'), 400, 'BAD_REQUEST'],
      [AppError.unauthenticated(), 401, 'UNAUTHENTICATED'],
      [AppError.tokenRevoked(), 401, 'TOKEN_REVOKED'],
      [AppError.forbidden(), 403, 'FORBIDDEN'],
      [AppError.notFound('x'), 404, 'NOT_FOUND'],
      [AppError.conflict('x'), 409, 'CONFLICT'],
      [AppError.validation([{ field: 'a', message: 'b' }]), 422, 'VALIDATION_FAILED'],
      [AppError.rateLimited(30), 429, 'RATE_LIMITED'],
      [AppError.internal(new Error('x')), 500, 'INTERNAL_ERROR'],
      [AppError.unavailable(5, 'x'), 503, 'UNAVAILABLE'],
    ];
    for (const [error, status, code] of cases) {
      const route = defineRoute({
        method: 'get',
        path: '/case',
        summary: 'case',
        tags: ['Test'],
        public: true,
        responses: { 200: { description: 'ok' } },
        handler: async () => {
          throw error;
        },
      });
      const { app } = buildTestApp([upProbe('mongo')], [route]);
      const res = await request(app).get('/case');
      expect(res.status).toBe(status);
      expect(res.body.code).toBe(code);
      expect(res.body.type).toBe(
        `https://doctrack.app/problems/${code.toLowerCase().replaceAll('_', '-')}`,
      );
    }
  });

  it('sets retryAfter in the body and Retry-After header for 429 and 503 only', async () => {
    const route = defineRoute({
      method: 'get',
      path: '/limited',
      summary: 'limited',
      tags: ['Test'],
      public: true,
      responses: { 200: { description: 'ok' } },
      handler: async () => {
        throw AppError.rateLimited(34);
      },
    });
    const { app } = buildTestApp([upProbe('mongo')], [route]);
    const res = await request(app).get('/limited');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('34');
    expect(res.body.retryAfter).toBe(34);
    expect(res.body.errors).toBeUndefined();
  });

  it('hides internals of unexpected errors', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('secret');
    expect(res.body.detail).toBe('An unexpected error occurred.');
  });

  it('returns 400 for malformed JSON', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post(`/things/${UUID}`)
      .set('Content-Type', 'application/json')
      .send('{"name": ');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  it('returns 400 for an oversized body', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post(`/things/${UUID}`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: 'x'.repeat(200_000) }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});

describe('validation', () => {
  it('returns 422 with an errors array of field and message', async () => {
    const { app } = buildTestApp();
    const res = await request(app).post('/things/not-a-uuid').send({ name: 'a', email: 'nope' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    const fields = (res.body.errors as { field: string; message: string }[])
      .map((e) => e.field)
      .sort();
    expect(fields).toEqual(['body.email', 'body.name', 'params.id']);
    for (const e of res.body.errors) expect(typeof e.message).toBe('string');
    expect(res.body.detail).toBe('3 fields are invalid.');
  });

  it('coerces and defaults query values', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post(`/things/${UUID}`)
      .send({ name: 'Ada', email: 'ada@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.data.n).toBe(1);
  });
});

describe('response envelope', () => {
  it('wraps data and meta', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post(`/things/${UUID}?n=3`)
      .send({ name: 'Ada', email: 'ada@example.com' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ data: { id: UUID, n: 3, name: 'Ada' }, meta: { total: 1 } });
  });

  it('sends no body for 204', async () => {
    const { app } = buildTestApp();
    const res = await request(app).delete('/things/abc');
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });
});

describe('request id', () => {
  it('generates one when absent', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('accepts a well-formed incoming id', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/nope').set('X-Request-Id', 'client-req-12345');
    expect(res.headers['x-request-id']).toBe('client-req-12345');
    expect(res.body.requestId).toBe('client-req-12345');
  });

  it('replaces a malformed incoming id', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/nope').set('X-Request-Id', 'bad id!');
    expect(res.headers['x-request-id']).not.toBe('bad id!');
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });
});

describe('health and readiness', () => {
  it('reports liveness', async () => {
    const { app } = buildTestApp([downProbe('redis')]);
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' } });
  });

  it('reports readiness when every probe is up', async () => {
    const { app } = buildTestApp([upProbe('mongo'), upProbe('redis'), upProbe('nats')]);
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      status: 'ready',
      checks: { mongo: 'up', redis: 'up', nats: 'up' },
    });
  });

  it('returns 503 naming the failed dependency with Retry-After', async () => {
    const { app } = buildTestApp([upProbe('mongo'), downProbe('redis')]);
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('UNAVAILABLE');
    expect(res.body.detail).toContain('redis');
    expect(res.body.detail).not.toContain('mongo');
    expect(res.headers['retry-after']).toBe('5');
  });

  it('treats a hung probe as down', async () => {
    const hung = { name: 'nats', check: () => new Promise<void>(() => undefined) };
    const { app } = buildTestApp([hung]);
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.detail).toContain('nats');
  });
});
