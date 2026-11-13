import {
  AuthUserSchema,
  LoginRequestSchema,
  MeSchema,
  SessionSchema,
  z,
} from '@doctrack/contracts';
import {
  ACCESS_COOKIE,
  AUTH_PATH,
  API_PREFIX,
  REFRESH_COOKIE,
  defineRoute,
  readCookie,
  type CookieOps,
  type RouteDefinition,
} from '../../../platform/http/index.ts';
import { AppError } from '../../../shared/errors/index.ts';
import type {
  GetCurrentUserQuery,
  LoginHandler,
  LogoutHandler,
  RefreshSessionHandler,
} from '../application/index.ts';
import type { IssuedToken } from '../domain/ports.ts';

export interface AuthRouteDeps {
  login: LoginHandler;
  refresh: RefreshSessionHandler;
  logout: LogoutHandler;
  me: GetCurrentUserQuery;
}

const seconds = (token: IssuedToken): number =>
  Math.max(1, Math.floor((token.expiresAt.getTime() - Date.now()) / 1000));

const sessionCookies = (access: IssuedToken, refresh: IssuedToken): CookieOps => ({
  set: [
    { name: ACCESS_COOKIE, value: access.token, maxAgeSeconds: seconds(access), path: '/' },
    {
      name: REFRESH_COOKIE,
      value: refresh.token,
      maxAgeSeconds: seconds(refresh),
      path: AUTH_PATH,
    },
  ],
});

const clearedCookies: CookieOps = {
  clear: [
    { name: ACCESS_COOKIE, path: '/' },
    { name: REFRESH_COOKIE, path: AUTH_PATH },
  ],
};

export function authRoutes(deps: AuthRouteDeps): RouteDefinition[] {
  const login = defineRoute({
    method: 'post',
    path: `${API_PREFIX}/auth/login`,
    summary: 'Sign in with email and password',
    tags: ['Auth'],
    public: true,
    rateLimit: 'none',
    request: { body: LoginRequestSchema },
    responses: {
      200: {
        description: 'Signed in; session cookies are set',
        schema: z.object({ data: SessionSchema }),
      },
      401: { description: 'Invalid email or password' },
      429: { description: 'Too many failed attempts' },
    },
    handler: async ({ body, req }) => {
      const result = await deps.login.execute({
        email: body.email,
        password: body.password,
        ip: req.ip ?? 'unknown',
      });
      return {
        status: 200,
        data: { user: result.user },
        cookies: sessionCookies(result.access, result.refresh),
      };
    },
  });

  const refresh = defineRoute({
    method: 'post',
    path: `${API_PREFIX}/auth/refresh`,
    summary: 'Rotate the refresh token and issue a new access token',
    tags: ['Auth'],
    public: true,
    rateLimit: 'none',
    responses: {
      200: { description: 'Tokens rotated', schema: z.object({ data: SessionSchema }) },
      401: { description: 'Missing, invalid or revoked refresh token' },
    },
    handler: async ({ req }) => {
      const token = readCookie(req, REFRESH_COOKIE);
      if (!token) throw AppError.unauthenticated();
      const result = await deps.refresh.execute({ refreshToken: token });
      return {
        status: 200,
        data: { user: result.user },
        cookies: sessionCookies(result.access, result.refresh),
      };
    },
  });

  const logout = defineRoute({
    method: 'post',
    path: `${API_PREFIX}/auth/logout`,
    summary: 'Sign out and blacklist the current tokens',
    tags: ['Auth'],
    rateLimit: 'refresh',
    responses: { 204: { description: 'Signed out; cookies cleared' } },
    handler: async ({ auth, req }) => {
      if (!auth) throw AppError.unauthenticated();
      const refreshToken = readCookie(req, REFRESH_COOKIE);
      await deps.logout.execute({ auth, ...(refreshToken ? { refreshToken } : {}) });
      return { status: 204, cookies: clearedCookies };
    },
  });

  const me = defineRoute({
    method: 'get',
    path: `${API_PREFIX}/auth/me`,
    summary: 'The signed-in user and their permissions',
    tags: ['Auth'],
    responses: { 200: { description: 'Current user', schema: z.object({ data: MeSchema }) } },
    handler: async ({ auth }) => {
      if (!auth) throw AppError.unauthenticated();
      return { status: 200, data: await deps.me.execute(auth) };
    },
  });

  void AuthUserSchema;
  return [login, refresh, logout, me];
}
