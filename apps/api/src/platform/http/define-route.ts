import type { Request, RequestHandler, Router } from 'express';
import type { z } from '@doctrack/contracts';
import { AppError, type FieldError } from '../../shared/errors/index.ts';

export type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';

export interface ResponseSpec {
  description: string;
  schema?: z.ZodType;
}

export interface HandlerResult {
  status?: number;
  data?: unknown;
  meta?: unknown;
}

type Out<S> = S extends z.ZodType ? z.output<S> : undefined;

export interface RouteSpec<
  P extends z.ZodType | undefined = undefined,
  Q extends z.ZodType | undefined = undefined,
  B extends z.ZodType | undefined = undefined,
> {
  method: HttpMethod;
  path: string;
  summary: string;
  tags: string[];
  public?: boolean;
  permission?: string;
  rateLimit?: string;
  request?: { params?: P; query?: Q; body?: B };
  responses: Record<number, ResponseSpec>;
  handler: (input: {
    params: Out<P>;
    query: Out<Q>;
    body: Out<B>;
    req: Request;
  }) => Promise<HandlerResult | void>;
}

export interface RouteDefinition {
  spec: RouteSpec<z.ZodType | undefined, z.ZodType | undefined, z.ZodType | undefined>;
  handler: RequestHandler;
}

const parse = (
  schema: z.ZodType | undefined,
  value: unknown,
  prefix: string,
  problems: FieldError[],
): unknown => {
  if (!schema) return undefined;
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    problems.push({ field: [prefix, ...issue.path].join('.'), message: issue.message });
  }
  return undefined;
};

export function defineRoute<
  P extends z.ZodType | undefined = undefined,
  Q extends z.ZodType | undefined = undefined,
  B extends z.ZodType | undefined = undefined,
>(spec: RouteSpec<P, Q, B>): RouteDefinition {
  const handler: RequestHandler = async (req, res) => {
    const problems: FieldError[] = [];
    const params = parse(spec.request?.params, req.params, 'params', problems);
    const query = parse(spec.request?.query, req.query, 'query', problems);
    const body = parse(spec.request?.body, req.body, 'body', problems);
    if (problems.length > 0) throw AppError.validation(problems);
    const result = await spec.handler({
      params: params as Out<P>,
      query: query as Out<Q>,
      body: body as Out<B>,
      req,
    });
    const status = result?.status ?? Number(Object.keys(spec.responses)[0] ?? 200);
    if (status === 204 || !result || result.data === undefined) {
      res.status(status).end();
      return;
    }
    const envelope: Record<string, unknown> = { data: result.data };
    if (result.meta !== undefined) envelope.meta = result.meta;
    res.status(status).json(envelope);
  };
  return { spec: spec as unknown as RouteDefinition['spec'], handler };
}

export function mountRoutes(router: Router, routes: readonly RouteDefinition[]): void {
  for (const route of routes) {
    router[route.spec.method](route.spec.path, route.handler);
  }
}

export const toOpenApiPath = (path: string): string => path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
export const toExpressPath = (path: string): string => path.replace(/\{([A-Za-z0-9_]+)\}/g, ':$1');
