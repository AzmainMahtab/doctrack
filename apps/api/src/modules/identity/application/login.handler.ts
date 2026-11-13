import { v7 as uuidv7 } from 'uuid';
import type { AuthUser } from '@doctrack/contracts';
import type {
  Clock,
  EventBus,
  RateLimiter,
  UnitOfWork,
} from '../../../shared/application/index.ts';
import { type RatePolicy } from '../../../shared/application/index.ts';
import { AppError } from '../../../shared/errors/index.ts';
import { UserLoggedIn } from '../domain/events.ts';
import type {
  PasswordHasher,
  RefreshTokenStore,
  TokenService,
  UserRepository,
} from '../domain/ports.ts';
import { type IssuedToken } from '../domain/ports.ts';
import { normalizeEmail } from '../domain/user.ts';

export interface LoginPolicies {
  perIp: RatePolicy;
  perAccount: RatePolicy;
}

export interface LoginResult {
  user: AuthUser;
  sessionId: string;
  access: IssuedToken;
  refresh: IssuedToken;
}

export class LoginHandler {
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly refreshTokens: RefreshTokenStore,
    private readonly limiter: RateLimiter,
    private readonly uow: UnitOfWork,
    private readonly eventBus: EventBus,
    private readonly clock: Clock,
    private readonly policies: LoginPolicies,
  ) {}

  async execute(input: { email: string; password: string; ip: string }): Promise<LoginResult> {
    const email = normalizeEmail(input.email);
    const accountKey = `${input.ip}|${email}`;

    const [byIp, byAccount] = await Promise.all([
      this.limiter.peek(this.policies.perIp, input.ip),
      this.limiter.peek(this.policies.perAccount, accountKey),
    ]);
    const blocked = [byIp, byAccount].filter((d) => !d.allowed);
    if (blocked.length > 0) {
      throw AppError.rateLimited(
        Math.max(...blocked.map((d) => d.resetSeconds)),
        'Too many failed login attempts. Try again later.',
      );
    }

    const user = await this.users.findByEmail(email);
    const hash = user?.passwordHash ?? (await this.dummy());
    const passwordOk = await this.hasher.verify(hash, input.password);

    if (!user || !user.isActive || !passwordOk) {
      await Promise.all([
        this.limiter.record(this.policies.perIp, input.ip),
        this.limiter.record(this.policies.perAccount, accountKey),
      ]);
      throw AppError.unauthenticated('Invalid email or password.');
    }

    await this.limiter.reset(this.policies.perAccount, accountKey);

    const sessionId = uuidv7();
    const [access, refresh] = await Promise.all([
      this.tokens.issueAccess(user, sessionId),
      this.tokens.issueRefresh(user.id, sessionId),
    ]);

    await this.uow.withTransaction(async () => {
      await this.refreshTokens.insert({
        id: refresh.jti,
        userId: user.id,
        familyId: sessionId,
        expiresAt: refresh.expiresAt,
      });
      await this.eventBus.publish(
        new UserLoggedIn(user.id, { email: user.email, role: user.role }),
      );
    });

    return {
      user: { id: user.id, email: user.email, role: user.role },
      sessionId,
      access,
      refresh,
    };
  }

  private dummy(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(`dummy-${this.clock.now().getTime()}`);
    return this.dummyHash;
  }
}
