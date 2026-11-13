import type { Response } from 'express';
import { describe, expect, it } from 'vitest';
import type { RateDecision } from '../../shared/application/index.ts';
import { policyFor } from '../http/pipeline.ts';
import { recordDecision } from './headers.ts';
import { POLICIES } from './policies.ts';

const fakeResponse = () => {
  const headers: Record<string, string> = {};
  const res = {
    locals: {} as Record<string, unknown>,
    setHeader: (k: string, v: string) => (headers[k] = v),
  };
  return { res: res as unknown as Response, headers };
};

const decision = (
  name: keyof typeof POLICIES,
  remaining: number,
  resetSeconds: number,
): RateDecision => ({
  policy: POLICIES[name],
  allowed: remaining > 0,
  remaining,
  resetSeconds,
});

describe('rate limit headers', () => {
  it('lists every evaluated policy and reports the one closest to exhaustion', () => {
    const { res, headers } = fakeResponse();
    recordDecision(res, decision('ip-global', 250, 40));
    recordDecision(res, decision('user-read', 87, 34));
    expect(headers['RateLimit-Policy']).toBe('"ip-global";q=300;w=60, "user-read";q=120;w=60');
    expect(headers['RateLimit']).toBe('"user-read";r=87;t=34');
  });

  it('reports the global policy when it is the tighter one', () => {
    const { res, headers } = fakeResponse();
    recordDecision(res, decision('ip-global', 3, 10));
    recordDecision(res, decision('user-write', 50, 20));
    expect(headers['RateLimit']).toBe('"ip-global";r=3;t=10');
  });
});

describe('policy catalogue', () => {
  it('matches the documented limits', () => {
    expect(POLICIES['ip-global']).toMatchObject({ limit: 300, windowSeconds: 60 });
    expect(POLICIES['login-account']).toMatchObject({ limit: 5, windowSeconds: 900 });
    expect(POLICIES['login-ip']).toMatchObject({ limit: 20, windowSeconds: 900 });
    expect(POLICIES.refresh).toMatchObject({ limit: 30, windowSeconds: 900 });
    expect(POLICIES['user-read']).toMatchObject({ limit: 120, windowSeconds: 60 });
    expect(POLICIES['user-write']).toMatchObject({ limit: 60, windowSeconds: 60 });
  });
});

describe('policyFor', () => {
  const base = {
    path: '/x',
    summary: 's',
    tags: [],
    responses: {},
    handler: async () => undefined,
  };
  it('defaults by method for authenticated routes and skips public ones', () => {
    expect(policyFor({ ...base, method: 'get' })).toBe('user-read');
    expect(policyFor({ ...base, method: 'post' })).toBe('user-write');
    expect(policyFor({ ...base, method: 'delete' })).toBe('user-write');
    expect(policyFor({ ...base, method: 'get', public: true })).toBeUndefined();
  });

  it('honours an explicit policy or none', () => {
    expect(policyFor({ ...base, method: 'post', rateLimit: 'refresh' })).toBe('refresh');
    expect(policyFor({ ...base, method: 'post', rateLimit: 'none' })).toBeUndefined();
  });
});
