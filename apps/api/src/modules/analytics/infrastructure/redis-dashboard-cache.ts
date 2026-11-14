import type { Redis } from 'ioredis';
import { AppError } from '../../../shared/errors/index.ts';
import { DashboardCache } from '../domain/ports.ts';

const TTL_SECONDS = 30;

export class RedisDashboardCache extends DashboardCache {
  constructor(
    private readonly redis: Redis,
    private readonly namespace = 'dash',
  ) {
    super();
  }

  async remember<T>(endpoint: string, params: string, compute: () => Promise<T>): Promise<T> {
    const version = await this.guard(() => this.redis.get(`${this.namespace}:version`));
    const key = `${this.namespace}:v${version ?? '0'}:${endpoint}:${params}`;
    const hit = await this.guard(() => this.redis.get(key));
    if (hit !== null) return JSON.parse(hit) as T;
    const value = await compute();
    await this.guard(() => this.redis.set(key, JSON.stringify(value), 'EX', TTL_SECONDS));
    return value;
  }

  async invalidate(): Promise<void> {
    await this.guard(() => this.redis.incr(`${this.namespace}:version`));
  }

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw new AppError('UNAVAILABLE', 'Dashboard cache is unavailable.', {
        retryAfter: 5,
        cause: error,
      });
    }
  }
}
