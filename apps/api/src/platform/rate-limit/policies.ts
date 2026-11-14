import type { RatePolicy } from '../../shared/application/index.ts';

export const POLICIES = {
  'ip-global': { name: 'ip-global', limit: 300, windowSeconds: 60 },
  'login-ip': { name: 'login-ip', limit: 20, windowSeconds: 900 },
  'login-account': { name: 'login-account', limit: 5, windowSeconds: 900 },
  refresh: { name: 'refresh', limit: 30, windowSeconds: 900 },
  'user-read': { name: 'user-read', limit: 120, windowSeconds: 60 },
  'user-write': { name: 'user-write', limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, RatePolicy>;

export type PolicyName = keyof typeof POLICIES;

export type PolicyTable = Record<PolicyName, RatePolicy>;

export const defaultPolicies: PolicyTable = POLICIES;
