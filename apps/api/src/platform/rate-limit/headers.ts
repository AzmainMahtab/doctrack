import type { Response } from 'express';
import type { RateDecision } from '../../shared/application/index.ts';

const LOCALS_KEY = 'rateDecisions';

export function recordDecision(res: Response, decision: RateDecision): void {
  const decisions = (res.locals[LOCALS_KEY] ??= []) as RateDecision[];
  decisions.push(decision);
  const policies = decisions
    .map((d) => `"${d.policy.name}";q=${d.policy.limit};w=${d.policy.windowSeconds}`)
    .join(', ');
  const tightest = decisions.reduce((a, b) => (b.remaining < a.remaining ? b : a));
  res.setHeader('RateLimit-Policy', policies);
  res.setHeader(
    'RateLimit',
    `"${tightest.policy.name}";r=${tightest.remaining};t=${tightest.resetSeconds}`,
  );
}
