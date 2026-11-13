import {
  Authenticator,
  RateLimiter,
  type RateDecision,
  type RatePolicy,
} from '../../shared/application/index.ts';
import type { CurrentUser } from '../../shared/auth/index.ts';

export const adminUser: CurrentUser = {
  id: 'admin-1',
  role: 'admin',
  permissions: [
    'doctors:read',
    'doctors:write',
    'patients:read',
    'patients:write',
    'dashboard:read',
  ],
  sessionId: 'session-1',
  tokenId: 'token-1',
  expiresAt: new Date(Date.now() + 3_600_000),
};

export class FakeAuthenticator extends Authenticator {
  constructor(private readonly user: CurrentUser = adminUser) {
    super();
  }
  async authenticate(): Promise<CurrentUser> {
    return this.user;
  }
}

export class AllowAllLimiter extends RateLimiter {
  private decision(policy: RatePolicy): RateDecision {
    return { policy, allowed: true, remaining: policy.limit, resetSeconds: policy.windowSeconds };
  }
  async consume(policy: RatePolicy): Promise<RateDecision> {
    return this.decision(policy);
  }
  async peek(policy: RatePolicy): Promise<RateDecision> {
    return this.decision(policy);
  }
  async record(policy: RatePolicy): Promise<RateDecision> {
    return this.decision(policy);
  }
  async reset(): Promise<void> {}
}
