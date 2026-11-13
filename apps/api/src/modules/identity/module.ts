import type { Redis } from 'ioredis';
import type { Db } from 'mongodb';
import type { TransactionContext } from '../../platform/database/index.ts';
import { POLICIES } from '../../platform/rate-limit/index.ts';
import type { Clock, EventBus, RateLimiter, UnitOfWork } from '../../shared/application/index.ts';
import {
  DeactivateUserHandler,
  EnsureUserHandler,
  GetCurrentUserQuery,
  LoginHandler,
  LogoutHandler,
  RefreshSessionHandler,
  TokenAuthenticator,
  type AuthSettings,
} from './application/index.ts';
import { Argon2Hasher } from './infrastructure/argon2-hasher.ts';
import { JoseTokenService } from './infrastructure/jose-token-service.ts';
import { MongoRefreshTokenStore } from './infrastructure/mongo-refresh-token-store.ts';
import { MongoUserRepository } from './infrastructure/mongo-user-repository.ts';
import { RedisTokenBlacklist } from './infrastructure/redis-token-blacklist.ts';
import { authRoutes } from './presentation/auth.routes.ts';

export interface IdentityDeps {
  db: Db;
  redis: Redis;
  transactions: TransactionContext;
  uow: UnitOfWork;
  eventBus: EventBus;
  clock: Clock;
  limiter: RateLimiter;
  privateKeyPem: string;
  settings: AuthSettings;
}

export function createIdentityModule(deps: IdentityDeps) {
  const users = new MongoUserRepository(deps.db, deps.transactions);
  const refreshTokens = new MongoRefreshTokenStore(deps.db, deps.transactions);
  const hasher = new Argon2Hasher();
  const tokens = new JoseTokenService(deps.privateKeyPem, deps.settings);
  const blacklist = new RedisTokenBlacklist(deps.redis);

  const login = new LoginHandler(
    users,
    hasher,
    tokens,
    refreshTokens,
    deps.limiter,
    deps.uow,
    deps.eventBus,
    deps.clock,
    { perIp: POLICIES['login-ip'], perAccount: POLICIES['login-account'] },
  );
  const refresh = new RefreshSessionHandler(
    users,
    tokens,
    refreshTokens,
    blacklist,
    deps.limiter,
    deps.uow,
    deps.clock,
    POLICIES.refresh,
    deps.settings,
  );
  const logout = new LogoutHandler(tokens, blacklist);
  const me = new GetCurrentUserQuery(users);

  return {
    authenticator: new TokenAuthenticator(tokens, blacklist),
    routes: authRoutes({ login, refresh, logout, me }),
    ensureUser: new EnsureUserHandler(users, hasher, deps.clock),
    deactivateUser: new DeactivateUserHandler(
      users,
      blacklist,
      deps.uow,
      deps.eventBus,
      deps.clock,
      deps.settings,
    ),
    blacklist,
    users,
  };
}

export type IdentityModule = ReturnType<typeof createIdentityModule>;
