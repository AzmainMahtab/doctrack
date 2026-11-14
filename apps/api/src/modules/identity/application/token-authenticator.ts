import { Authenticator } from '../../../shared/application/index.ts';
import type { CurrentUser } from '../../../shared/auth/index.ts';
import { AppError } from '../../../shared/errors/index.ts';
import { permissionsFor } from '../domain/permissions.ts';
import type { TokenBlacklist, TokenService } from '../domain/ports.ts';

export class TokenAuthenticator extends Authenticator {
  constructor(
    private readonly tokens: TokenService,
    private readonly blacklist: TokenBlacklist,
  ) {
    super();
  }

  async authenticate(accessToken: string): Promise<CurrentUser> {
    const claims = await this.tokens.parseAccess(accessToken);
    const [tokenRevoked, sessionRevoked, revokedBefore] = await Promise.all([
      this.blacklist.isTokenRevoked(claims.jti),
      this.blacklist.isSessionRevoked(claims.sid),
      this.blacklist.userRevokedBefore(claims.sub),
    ]);
    if (tokenRevoked || sessionRevoked) throw AppError.tokenRevoked();
    if (revokedBefore && claims.iat * 1000 <= revokedBefore.getTime())
      throw AppError.tokenRevoked();
    return {
      id: claims.sub,
      role: claims.role,
      permissions: permissionsFor(claims.role),
      sessionId: claims.sid,
      tokenId: claims.jti,
      expiresAt: new Date(claims.exp * 1000),
    };
  }
}
