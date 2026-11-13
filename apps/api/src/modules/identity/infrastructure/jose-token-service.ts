import { createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto';
import { errors, jwtVerify, SignJWT, type JWTPayload } from 'jose';
import { v7 as uuidv7 } from 'uuid';
import { AppError } from '../../../shared/errors/index.ts';
import {
  TokenService,
  type AccessClaims,
  type IssuedToken,
  type RefreshClaims,
} from '../domain/ports.ts';
import type { User } from '../domain/user.ts';

export interface TokenSettings {
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  issuer?: string;
  audience?: string;
}

type TokenType = 'access' | 'refresh';

export class JoseTokenService extends TokenService {
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    privateKeyPem: string,
    private readonly settings: TokenSettings,
  ) {
    super();
    this.privateKey = createPrivateKey(privateKeyPem);
    this.publicKey = createPublicKey(this.privateKey);
    this.issuer = settings.issuer ?? 'doctrack';
    this.audience = settings.audience ?? 'doctrack-api';
  }

  issueAccess(user: User, sessionId: string): Promise<IssuedToken> {
    return this.sign('access', user.id, sessionId, this.settings.accessTtlSeconds, {
      role: user.role,
    });
  }

  issueRefresh(userId: string, sessionId: string): Promise<IssuedToken> {
    return this.sign('refresh', userId, sessionId, this.settings.refreshTtlSeconds, {});
  }

  async parseAccess(token: string): Promise<AccessClaims> {
    const p = await this.verify(token, 'access');
    const role = p.role;
    if (role !== 'admin' && role !== 'viewer') throw AppError.unauthenticated();
    return { ...this.base(p), role };
  }

  async parseRefresh(token: string): Promise<RefreshClaims> {
    return this.base(await this.verify(token, 'refresh'));
  }

  private base(p: JWTPayload): RefreshClaims {
    if (!p.sub || !p.jti || typeof p.sid !== 'string' || !p.iat || !p.exp) {
      throw AppError.unauthenticated();
    }
    return { sub: p.sub, jti: p.jti, sid: p.sid, iat: p.iat, exp: p.exp };
  }

  private async sign(
    typ: TokenType,
    sub: string,
    sid: string,
    ttlSeconds: number,
    extra: Record<string, unknown>,
  ): Promise<IssuedToken> {
    const jti = uuidv7();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const token = await new SignJWT({ ...extra, sid, typ })
      .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
      .setSubject(sub)
      .setJti(jti)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.privateKey);
    return { token, jti, expiresAt };
  }

  private async verify(token: string, expected: TokenType): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.publicKey, {
        algorithms: ['ES256'],
        issuer: this.issuer,
        audience: this.audience,
      });
      if (payload.typ !== expected) throw AppError.unauthenticated('Wrong token type.');
      return payload;
    } catch (error) {
      if (AppError.is(error)) throw error;
      if (error instanceof errors.JWTExpired) throw AppError.unauthenticated('Token expired.');
      throw AppError.unauthenticated('Invalid token.');
    }
  }
}
