import type { CurrentUser } from '../../../shared/auth/index.ts';
import { AppError } from '../../../shared/errors/index.ts';
import type { TokenBlacklist, TokenService } from '../domain/ports.ts';

export class LogoutHandler {
  constructor(
    private readonly tokens: TokenService,
    private readonly blacklist: TokenBlacklist,
  ) {}

  async execute(input: { auth: CurrentUser; refreshToken?: string }): Promise<void> {
    await this.blacklist.revokeToken(input.auth.tokenId, input.auth.expiresAt);
    if (!input.refreshToken) return;
    try {
      const claims = await this.tokens.parseRefresh(input.refreshToken);
      if (claims.sub === input.auth.id) {
        await this.blacklist.revokeToken(claims.jti, new Date(claims.exp * 1000));
      }
    } catch (error) {
      if (!AppError.is(error, 'UNAUTHENTICATED')) throw error;
    }
  }
}
