import type { AuthUser } from '@doctrack/contracts';
import type { Clock, RateLimiter, UnitOfWork } from '../../../shared/application/index.ts';
import { type RatePolicy } from '../../../shared/application/index.ts';
import { AppError } from '../../../shared/errors/index.ts';
import type {
  RefreshTokenStore,
  TokenBlacklist,
  TokenService,
  UserRepository,
} from '../domain/ports.ts';
import { type IssuedToken } from '../domain/ports.ts';
import type { AuthSettings } from './settings.ts';

export interface RefreshResult {
  user: AuthUser;
  sessionId: string;
  access: IssuedToken;
  refresh: IssuedToken;
}

export class RefreshSessionHandler {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: TokenService,
    private readonly refreshTokens: RefreshTokenStore,
    private readonly blacklist: TokenBlacklist,
    private readonly limiter: RateLimiter,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly policy: RatePolicy,
    private readonly settings: AuthSettings,
  ) {}

  async execute(input: { refreshToken: string }): Promise<RefreshResult> {
    const claims = await this.tokens.parseRefresh(input.refreshToken);

    const [tokenRevoked, sessionRevoked] = await Promise.all([
      this.blacklist.isTokenRevoked(claims.jti),
      this.blacklist.isSessionRevoked(claims.sid),
    ]);
    if (tokenRevoked || sessionRevoked) throw AppError.tokenRevoked();

    const decision = await this.limiter.consume(this.policy, claims.sub);
    if (!decision.allowed) throw AppError.rateLimited(decision.resetSeconds);

    const user = await this.users.findById(claims.sub);
    if (!user || !user.isActive) {
      await this.blacklist.revokeSession(claims.sid, this.settings.refreshTtlSeconds);
      throw AppError.unauthenticated();
    }

    const [access, refresh] = await Promise.all([
      this.tokens.issueAccess(user, claims.sid),
      this.tokens.issueRefresh(user.id, claims.sid),
    ]);

    const outcome = await this.uow.withTransaction(async () => {
      const rotated = await this.refreshTokens.rotate(claims.jti, this.clock.now());
      if (rotated === 'rotated') {
        await this.refreshTokens.insert({
          id: refresh.jti,
          userId: user.id,
          familyId: claims.sid,
          expiresAt: refresh.expiresAt,
        });
      }
      return rotated;
    });

    if (outcome === 'missing') throw AppError.unauthenticated();
    if (outcome === 'reused') {
      await this.blacklist.revokeSession(claims.sid, this.settings.refreshTtlSeconds);
      throw AppError.tokenRevoked('Refresh token reuse detected; the session was revoked.');
    }

    return {
      user: { id: user.id, email: user.email, role: user.role },
      sessionId: claims.sid,
      access,
      refresh,
    };
  }
}
