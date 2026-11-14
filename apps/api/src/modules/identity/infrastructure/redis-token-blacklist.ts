import type { Redis } from 'ioredis';
import { AppError } from '../../../shared/errors/index.ts';
import { TokenBlacklist } from '../domain/ports.ts';

const unavailable = (cause: unknown): AppError =>
  new AppError('UNAVAILABLE', 'Token store is unavailable.', { retryAfter: 5, cause });

export class RedisTokenBlacklist extends TokenBlacklist {
  constructor(private readonly redis: Redis) {
    super();
  }

  async revokeToken(jti: string, expiresAt: Date): Promise<void> {
    const ttl = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
    if (ttl <= 0) return;
    await this.guard(() => this.redis.set(`bl:${jti}`, '1', 'EX', ttl));
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    return (await this.guard(() => this.redis.exists(`bl:${jti}`))) === 1;
  }

  async revokeSession(sessionId: string, ttlSeconds: number): Promise<void> {
    await this.guard(() => this.redis.set(`sid:${sessionId}`, '1', 'EX', ttlSeconds));
  }

  async isSessionRevoked(sessionId: string): Promise<boolean> {
    return (await this.guard(() => this.redis.exists(`sid:${sessionId}`))) === 1;
  }

  async revokeUserBefore(userId: string, before: Date, ttlSeconds: number): Promise<void> {
    await this.guard(() =>
      this.redis.set(`user:${userId}:revoked-before`, String(before.getTime()), 'EX', ttlSeconds),
    );
  }

  async userRevokedBefore(userId: string): Promise<Date | null> {
    const value = await this.guard(() => this.redis.get(`user:${userId}:revoked-before`));
    return value ? new Date(Number(value)) : null;
  }

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw unavailable(error);
    }
  }
}
