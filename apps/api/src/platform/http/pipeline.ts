import type { RequestHandler, Response } from 'express';
import type { Authenticator, RateLimiter } from '../../shared/application/index.ts';
import type { CurrentUser } from '../../shared/auth/index.ts';
import { AppError } from '../../shared/errors/index.ts';
import { requestContext } from '../logger/index.ts';
import { recordDecision } from '../rate-limit/headers.ts';
import { POLICIES, type PolicyName, type PolicyTable } from '../rate-limit/index.ts';
import { ACCESS_COOKIE, readCookie } from './cookies.ts';
import type { RouteDefinition } from './define-route.ts';

export interface PipelineDeps {
  authenticator: Authenticator;
  limiter: RateLimiter;
  policies?: PolicyTable;
}

type Spec = RouteDefinition['spec'];

export const authOf = (res: Response): CurrentUser | undefined =>
  res.locals.auth as CurrentUser | undefined;

export function ipGlobalLimit(deps: PipelineDeps): RequestHandler {
  const policy = (deps.policies ?? POLICIES)['ip-global'];
  return async (req, res, next) => {
    try {
      const decision = await deps.limiter.consume(policy, req.ip ?? 'unknown');
      recordDecision(res, decision);
      if (!decision.allowed) throw AppError.rateLimited(decision.resetSeconds);
      next();
    } catch (error) {
      next(error);
    }
  };
}

const authenticate =
  (deps: PipelineDeps): RequestHandler =>
  async (req, res, next) => {
    try {
      const token = readCookie(req, ACCESS_COOKIE);
      if (!token) throw AppError.unauthenticated();
      const user = await deps.authenticator.authenticate(token);
      res.locals.auth = user;
      requestContext.setActor(user.id);
      next();
    } catch (error) {
      next(error);
    }
  };

const authorize =
  (permission: string): RequestHandler =>
  (_req, res, next) => {
    const user = authOf(res);
    if (!user || !user.permissions.includes(permission)) {
      next(AppError.forbidden());
      return;
    }
    next();
  };

const routeLimit = (deps: PipelineDeps, name: PolicyName): RequestHandler => {
  const policy = (deps.policies ?? POLICIES)[name];
  return async (req, res, next) => {
    try {
      const user = authOf(res);
      const decision = await deps.limiter.consume(policy, user?.id ?? req.ip ?? 'unknown');
      recordDecision(res, decision);
      if (!decision.allowed) throw AppError.rateLimited(decision.resetSeconds);
      next();
    } catch (error) {
      next(error);
    }
  };
};

export function policyFor(spec: Spec): PolicyName | undefined {
  if (spec.rateLimit === 'none') return undefined;
  if (spec.rateLimit) return spec.rateLimit as PolicyName;
  if (spec.public) return undefined;
  return spec.method === 'get' ? 'user-read' : 'user-write';
}

export const buildChain =
  (deps: PipelineDeps) =>
  (spec: Spec): RequestHandler[] => {
    const chain: RequestHandler[] = [];
    if (!spec.public) chain.push(authenticate(deps));
    if (spec.permission) chain.push(authorize(spec.permission));
    const policy = policyFor(spec);
    if (policy) chain.push(routeLimit(deps, policy));
    return chain;
  };
