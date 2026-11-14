import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from '../../platform/testing/harness.ts';
import {
  API_TEST,
  connectOwnRedis,
  createIdentityApp,
} from '../../platform/testing/identity-app.ts';
import { defaultPolicies } from '../../platform/rate-limit/index.ts';

const PASSWORD = 'correct-horse-battery';
const AUTH = '/api/v1/auth';

type Built = Awaited<ReturnType<typeof createIdentityApp>>;
type Res = request.Response;

const ip = () => `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}`;

const cookiesOf = (res: Res): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const line of (res.headers['set-cookie'] as unknown as string[] | undefined) ?? []) {
    const [pair] = line.split(';');
    const [name, ...rest] = (pair ?? '').split('=');
    if (name) out[name] = rest.join('=');
  }
  return out;
};

const cookieHeader = (jar: Record<string, string>): string =>
  Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

const decode = (jwt: string): { jti: string; sid: string; typ: string } =>
  JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString());

describe('identity', () => {
  let h: Harness;
  let built: Built;
  let admin: string;
  let viewer: string;

  const post = (path: string, from = ip()) =>
    request(built.app).post(path).set('X-Forwarded-For', from);
  const get = (path: string, from = ip()) =>
    request(built.app).get(path).set('X-Forwarded-For', from);

  const login = (email: string, password = PASSWORD, from = ip()) =>
    post(`${AUTH}/login`, from).send({ email, password });

  const newUser = async (role: 'admin' | 'viewer') => {
    const email = `${role}-${randomBytes(4).toString('hex')}@example.com`;
    await built.identity.ensureUser.execute({ email, password: PASSWORD, role });
    return email;
  };

  beforeAll(async () => {
    h = await createHarness();
    built = await createIdentityApp(h);
    admin = await newUser('admin');
    viewer = await newUser('viewer');
  });
  afterAll(async () => {
    await h.close();
  });

  describe('login and session', () => {
    it('signs in, sets httpOnly cookies and exposes no token in the body', async () => {
      const res = await login(admin);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        data: { user: { id: expect.any(String), email: admin, role: 'admin' } },
      });
      expect(JSON.stringify(res.body)).not.toMatch(/eyJ/);

      const lines = res.headers['set-cookie'] as unknown as string[];
      const access = lines.find((l) => l.startsWith('dt_access='));
      const refresh = lines.find((l) => l.startsWith('dt_refresh='));
      for (const line of [access, refresh]) {
        expect(line).toMatch(/HttpOnly/);
        expect(line).toMatch(/SameSite=Lax/);
      }
      expect(access).toMatch(/Path=\/;/);
      expect(refresh).toMatch(/Path=\/api\/v1\/auth/);
    });

    it('returns the current user and permissions on /auth/me', async () => {
      const jar = cookiesOf(await login(viewer));
      const res = await get(`${AUTH}/me`).set('Cookie', cookieHeader(jar));
      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('viewer');
      expect(res.body.data.permissions).toEqual([
        'doctors:read',
        'patients:read',
        'dashboard:read',
      ]);
    });

    it('answers a wrong password and an unknown email with the same body', async () => {
      const wrong = await login(admin, 'wrong-password-here');
      const unknown = await login('nobody@example.com');
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      const strip = ({ requestId: _r, ...rest }: Record<string, unknown>) => rest;
      expect(strip(wrong.body)).toEqual(strip(unknown.body));
      expect(wrong.body.code).toBe('UNAUTHENTICATED');
    });

    it('validates the login body', async () => {
      const res = await post(`${AUTH}/login`).send({ email: 'not-an-email' });
      expect(res.status).toBe(422);
      expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual([
        'body.email',
        'body.password',
      ]);
    });

    it('records a user.logged_in event in the outbox', async () => {
      await login(admin);
      expect(
        await h.mongo.db.collection('outbox').countDocuments({ type: 'user.logged_in' }),
      ).toBeGreaterThan(0);
    });
  });

  describe('route protection', () => {
    it('rejects a request without a cookie, with garbage, and with a refresh token used as access', async () => {
      expect((await get(`${API_TEST}/read`)).body.code).toBe('UNAUTHENTICATED');
      const garbage = await get(`${API_TEST}/read`).set('Cookie', 'dt_access=not.a.jwt');
      expect(garbage.status).toBe(401);
      const jar = cookiesOf(await login(admin));
      const confused = await get(`${API_TEST}/read`).set('Cookie', `dt_access=${jar.dt_refresh}`);
      expect(confused.status).toBe(401);
      expect(confused.body.detail).toBe('Wrong token type.');
    });

    it('lets a viewer read but returns 403 on a write route; an admin can write', async () => {
      const v = cookieHeader(cookiesOf(await login(viewer)));
      const a = cookieHeader(cookiesOf(await login(admin)));
      expect((await get(`${API_TEST}/read`).set('Cookie', v)).status).toBe(200);
      const denied = await post(`${API_TEST}/write`).set('Cookie', v);
      expect(denied.status).toBe(403);
      expect(denied.body.code).toBe('FORBIDDEN');
      expect((await post(`${API_TEST}/write`).set('Cookie', a)).status).toBe(200);
    });

    it('rejects an expired access token', async () => {
      const short = await createIdentityApp(h, { accessTtlSeconds: 1 });
      const email = `short-${randomBytes(3).toString('hex')}@example.com`;
      await short.identity.ensureUser.execute({ email, password: PASSWORD, role: 'admin' });
      const res = await request(short.app)
        .post(`${AUTH}/login`)
        .set('X-Forwarded-For', ip())
        .send({ email, password: PASSWORD });
      const jar = cookiesOf(res);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const me = await request(short.app)
        .get(`${AUTH}/me`)
        .set('X-Forwarded-For', ip())
        .set('Cookie', cookieHeader(jar));
      expect(me.status).toBe(401);
      expect(me.body.detail).toBe('Token expired.');
    });
  });

  describe('logout and the token blacklist', () => {
    it('rejects the old access and refresh tokens after logout, and the entry expires with the token', async () => {
      const jar = cookiesOf(await login(admin));
      const out = await post(`${AUTH}/logout`).set('Cookie', cookieHeader(jar));
      expect(out.status).toBe(204);
      expect(out.headers['set-cookie'] as unknown as string[]).toEqual(
        expect.arrayContaining([expect.stringMatching(/dt_access=;.*Max-Age=0/)]),
      );

      const replay = await get(`${AUTH}/me`).set('Cookie', cookieHeader(jar));
      expect(replay.status).toBe(401);
      expect(replay.body.code).toBe('TOKEN_REVOKED');

      const refresh = await post(`${AUTH}/refresh`).set('Cookie', cookieHeader(jar));
      expect(refresh.status).toBe(401);
      expect(refresh.body.code).toBe('TOKEN_REVOKED');

      const ttl = await h.redis.client.ttl(`bl:${decode(jar.dt_access ?? '').jti}`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(900);
    });
  });

  describe('refresh rotation', () => {
    it('rotates the pair and keeps the session working', async () => {
      const first = cookiesOf(await login(admin));
      const res = await post(`${AUTH}/refresh`).set('Cookie', cookieHeader(first));
      expect(res.status).toBe(200);
      const second = cookiesOf(res);
      expect(second.dt_refresh).not.toBe(first.dt_refresh);
      expect(second.dt_access).not.toBe(first.dt_access);
      expect(decode(second.dt_refresh ?? '').sid).toBe(decode(first.dt_refresh ?? '').sid);
      const me = await get(`${AUTH}/me`).set('Cookie', cookieHeader(second));
      expect(me.status).toBe(200);
    });

    it('revokes the whole session when a rotated refresh token is presented again', async () => {
      const first = cookiesOf(await login(admin));
      const second = cookiesOf(await post(`${AUTH}/refresh`).set('Cookie', cookieHeader(first)));

      const reuse = await post(`${AUTH}/refresh`).set('Cookie', cookieHeader(first));
      expect(reuse.status).toBe(401);
      expect(reuse.body.code).toBe('TOKEN_REVOKED');

      const me = await get(`${AUTH}/me`).set('Cookie', cookieHeader(second));
      expect(me.status).toBe(401);
      expect(me.body.code).toBe('TOKEN_REVOKED');
      const next = await post(`${AUTH}/refresh`).set('Cookie', cookieHeader(second));
      expect(next.status).toBe(401);
    });

    it('rejects a request with no refresh cookie', async () => {
      expect((await post(`${AUTH}/refresh`)).status).toBe(401);
    });
  });

  describe('deactivation', () => {
    it('invalidates existing tokens and blocks new logins and refreshes', async () => {
      const email = await newUser('admin');
      const jar = cookiesOf(await login(email));
      const me = await get(`${AUTH}/me`).set('Cookie', cookieHeader(jar));
      expect(me.status).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 1100));
      await built.identity.deactivateUser.execute({ userId: me.body.data.user.id });

      const after = await get(`${AUTH}/me`).set('Cookie', cookieHeader(jar));
      expect(after.status).toBe(401);
      expect(after.body.code).toBe('TOKEN_REVOKED');
      expect((await login(email)).status).toBe(401);
      expect((await post(`${AUTH}/refresh`).set('Cookie', cookieHeader(jar))).status).toBe(401);
      expect(
        await h.mongo.db.collection('outbox').countDocuments({ type: 'user.deactivated' }),
      ).toBe(1);
    });
  });

  describe('rate limiting', () => {
    it('counts failed logins per IP and email, returns 429 on the sixth, and a success resets the count', async () => {
      const from = ip();
      for (let i = 0; i < 5; i++) {
        expect((await login(admin, 'wrong-password-here', from)).status).toBe(401);
      }
      const sixth = await login(admin, 'wrong-password-here', from);
      expect(sixth.status).toBe(429);
      expect(sixth.body.code).toBe('RATE_LIMITED');
      expect(Number(sixth.headers['retry-after'])).toBeGreaterThan(0);
      expect(sixth.body.retryAfter).toBe(Number(sixth.headers['retry-after']));
      expect(sixth.headers['ratelimit-policy']).toContain('"ip-global"');

      const blockedCorrect = await login(admin, PASSWORD, from);
      expect(blockedCorrect.status).toBe(429);

      const other = ip();
      for (let i = 0; i < 4; i++) await login(admin, 'wrong-password-here', other);
      expect((await login(admin, PASSWORD, other)).status).toBe(200);
      for (let i = 0; i < 4; i++) {
        expect((await login(admin, 'wrong-password-here', other)).status).toBe(401);
      }
    });

    it('returns the same 429 body whether or not the account exists', async () => {
      const a = ip();
      const b = ip();
      for (let i = 0; i < 5; i++) {
        await login(admin, 'wrong-password-here', a);
        await login('ghost@example.com', 'wrong-password-here', b);
      }
      const known = await login(admin, 'wrong-password-here', a);
      const ghost = await login('ghost@example.com', 'wrong-password-here', b);
      expect(known.status).toBe(429);
      expect(ghost.status).toBe(429);
      expect(known.body.detail).toBe(ghost.body.detail);
      expect(known.body.title).toBe(ghost.body.title);
    });

    it('limits writes per user and reports both policies in the headers', async () => {
      const limited = await createIdentityApp(h, {
        policies: { 'user-write': { name: 'user-write', limit: 3, windowSeconds: 60 } },
      });
      const email = `limited-${randomBytes(3).toString('hex')}@example.com`;
      await limited.identity.ensureUser.execute({ email, password: PASSWORD, role: 'admin' });
      const from = ip();
      const jar = cookieHeader(
        cookiesOf(
          await request(limited.app)
            .post(`${AUTH}/login`)
            .set('X-Forwarded-For', from)
            .send({ email, password: PASSWORD }),
        ),
      );
      const write = () =>
        request(limited.app)
          .post(`${API_TEST}/write`)
          .set('X-Forwarded-For', from)
          .set('Cookie', jar);
      for (let i = 0; i < 3; i++) expect((await write()).status).toBe(200);
      const fourth = await write();
      expect(fourth.status).toBe(429);
      expect(fourth.headers['ratelimit-policy']).toBe(
        '"ip-global";q=300;w=60, "user-write";q=3;w=60',
      );
      expect(fourth.headers['ratelimit']).toMatch(/^"user-write";r=0;t=\d+$/);
      expect(Number(fourth.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('keys the global limit on the proxy-appended client IP, not on spoofed leading entries', async () => {
      const tight = await createIdentityApp(h, {
        policies: { 'ip-global': { name: 'ip-global', limit: 5, windowSeconds: 60 } },
      });
      const real = ip();
      const hit = (forwarded: string) =>
        request(tight.app).get(`${AUTH}/me`).set('X-Forwarded-For', forwarded);
      for (let i = 0; i < 5; i++) {
        expect((await hit(`9.9.9.${i}, ${real}`)).status).toBe(401);
      }
      expect((await hit(`8.8.8.8, ${real}`)).status).toBe(429);
      expect((await hit(`8.8.8.8, ${ip()}`)).status).toBe(401);
    });
  });

  describe('redis outage', () => {
    it('returns 503 for login and authenticated routes, fails readiness, and keeps /health up', async () => {
      const own = await connectOwnRedis(h);
      const app = await createIdentityApp(h, { redis: own });
      const email = `outage-${randomBytes(3).toString('hex')}@example.com`;
      await app.identity.ensureUser.execute({ email, password: PASSWORD, role: 'admin' });
      const ok = await request(app.app)
        .post(`${AUTH}/login`)
        .set('X-Forwarded-For', ip())
        .send({ email, password: PASSWORD });
      expect(ok.status).toBe(200);
      const jar = cookieHeader(cookiesOf(ok));

      own.client.disconnect();

      const loginDown = await request(app.app)
        .post(`${AUTH}/login`)
        .set('X-Forwarded-For', ip())
        .send({ email, password: PASSWORD });
      expect(loginDown.status).toBe(503);
      expect(loginDown.body.code).toBe('UNAVAILABLE');
      expect(loginDown.headers['retry-after']).toBe('5');

      const protectedDown = await request(app.app)
        .get(`${API_TEST}/read`)
        .set('X-Forwarded-For', ip())
        .set('Cookie', jar);
      expect(protectedDown.status).toBe(503);

      expect((await request(app.app).get('/ready')).status).toBe(503);
      expect((await request(app.app).get('/health')).status).toBe(200);
    });
  });

  describe('documentation', () => {
    it('lists the auth routes with the cookie security scheme and permissions', () => {
      const doc = built.document as unknown as {
        paths: Record<string, Record<string, { security?: unknown[]; description?: string }>>;
        components: { securitySchemes: Record<string, unknown> };
      };
      expect(doc.components.securitySchemes.cookieAuth).toMatchObject({
        type: 'apiKey',
        in: 'cookie',
      });
      expect(doc.paths[`${AUTH}/login`]?.post?.security).toEqual([]);
      expect(doc.paths[`${AUTH}/me`]?.get?.security).toEqual([{ cookieAuth: [] }]);
      expect(doc.paths[`${API_TEST}/write`]?.post?.description).toContain(
        'Permission: `doctors:write`',
      );
    });
  });

  it('seeding is idempotent', async () => {
    const email = `seed-${randomBytes(3).toString('hex')}@example.com`;
    const first = await built.identity.ensureUser.execute({
      email,
      password: PASSWORD,
      role: 'viewer',
    });
    const second = await built.identity.ensureUser.execute({
      email,
      password: PASSWORD,
      role: 'viewer',
    });
    expect([first, second]).toEqual(['created', 'exists']);
  });
});

void defaultPolicies;
