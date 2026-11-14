import type { Redis } from 'ioredis';
import { v7 as uuidv7 } from 'uuid';
import { RateLimiter, type RateDecision, type RatePolicy } from '../../shared/application/index.ts';
import { AppError } from '../../shared/errors/index.ts';
import { SLIDING_WINDOW } from './sliding-window.lua.ts';

type Mode = 'peek' | 'consume' | 'record';

export class RedisRateLimiter extends RateLimiter {
  constructor(private readonly redis: Redis) {
    super();
  }

  consume(policy: RatePolicy, key: string): Promise<RateDecision> {
    return this.run('consume', policy, key);
  }

  peek(policy: RatePolicy, key: string): Promise<RateDecision> {
    return this.run('peek', policy, key);
  }

  record(policy: RatePolicy, key: string): Promise<RateDecision> {
    return this.run('record', policy, key);
  }

  async reset(policy: RatePolicy, key: string): Promise<void> {
    try {
      await this.redis.del(this.key(policy, key));
    } catch (error) {
      throw this.unavailable(error);
    }
  }

  private key(policy: RatePolicy, key: string): string {
    return `rl:${policy.name}:${key}`;
  }

  private async run(mode: Mode, policy: RatePolicy, key: string): Promise<RateDecision> {
    try {
      const [allowed, remaining, resetSeconds] = (await this.redis.eval(
        SLIDING_WINDOW,
        1,
        this.key(policy, key),
        policy.windowSeconds,
        policy.limit,
        mode,
        uuidv7(),
      )) as [number, number, number];
      return { policy, allowed: allowed === 1, remaining, resetSeconds: Math.max(1, resetSeconds) };
    } catch (error) {
      throw this.unavailable(error);
    }
  }

  private unavailable(cause: unknown): AppError {
    return new AppError('UNAVAILABLE', 'Rate limiting backend is unavailable.', {
      retryAfter: 5,
      cause,
    });
  }
}
