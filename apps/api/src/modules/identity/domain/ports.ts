import type { Role } from '@doctrack/contracts';
import type { User } from './user.ts';

export abstract class UserRepository {
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findById(id: string): Promise<User | null>;
  abstract save(user: User): Promise<void>;
}

export interface RefreshRecord {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
}

export type RotateOutcome = 'rotated' | 'reused' | 'missing';

export abstract class RefreshTokenStore {
  abstract insert(record: RefreshRecord): Promise<void>;
  abstract rotate(id: string, at: Date): Promise<RotateOutcome>;
}

export abstract class PasswordHasher {
  abstract hash(plaintext: string): Promise<string>;
  abstract verify(hash: string, plaintext: string): Promise<boolean>;
}

export interface IssuedToken {
  token: string;
  jti: string;
  expiresAt: Date;
}

export interface AccessClaims {
  sub: string;
  jti: string;
  sid: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface RefreshClaims {
  sub: string;
  jti: string;
  sid: string;
  iat: number;
  exp: number;
}

export abstract class TokenService {
  abstract issueAccess(user: User, sessionId: string): Promise<IssuedToken>;
  abstract issueRefresh(userId: string, sessionId: string): Promise<IssuedToken>;
  abstract parseAccess(token: string): Promise<AccessClaims>;
  abstract parseRefresh(token: string): Promise<RefreshClaims>;
}

export abstract class TokenBlacklist {
  abstract revokeToken(jti: string, expiresAt: Date): Promise<void>;
  abstract isTokenRevoked(jti: string): Promise<boolean>;
  abstract revokeSession(sessionId: string, ttlSeconds: number): Promise<void>;
  abstract isSessionRevoked(sessionId: string): Promise<boolean>;
  abstract revokeUserBefore(userId: string, before: Date, ttlSeconds: number): Promise<void>;
  abstract userRevokedBefore(userId: string): Promise<Date | null>;
}
