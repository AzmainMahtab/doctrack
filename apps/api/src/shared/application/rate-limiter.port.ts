export interface RatePolicy {
  readonly name: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface RateDecision {
  policy: RatePolicy;
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

export abstract class RateLimiter {
  abstract consume(policy: RatePolicy, key: string): Promise<RateDecision>;
  abstract peek(policy: RatePolicy, key: string): Promise<RateDecision>;
  abstract record(policy: RatePolicy, key: string): Promise<RateDecision>;
  abstract reset(policy: RatePolicy, key: string): Promise<void>;
}
