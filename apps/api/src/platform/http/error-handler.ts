import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../shared/errors/index.ts';
import type { Logger } from '../logger/index.ts';
import { PROBLEM_CONTENT_TYPE, toProblem } from './problem.ts';

export const zodToAppError = (error: ZodError, prefix?: string): AppError =>
  AppError.validation(
    error.issues.map((issue) => {
      const path = [prefix, ...issue.path].filter((p) => p !== undefined && p !== '').join('.');
      return { field: path || '(root)', message: issue.message };
    }),
  );

const isBodyParserError = (err: unknown): err is { type: string; status?: number } =>
  typeof err === 'object' && err !== null && typeof (err as { type?: unknown }).type === 'string';

export function normalizeError(err: unknown): AppError {
  if (AppError.is(err)) return err;
  if (err instanceof ZodError) return zodToAppError(err);
  if (isBodyParserError(err)) {
    if (err.type === 'entity.parse.failed') return AppError.badRequest('Malformed JSON body.', err);
    if (err.type === 'entity.too.large')
      return AppError.badRequest('Request body is too large.', err);
    if (err.type.startsWith('encoding.') || err.type.startsWith('charset.')) {
      return AppError.badRequest('Unsupported request encoding.', err);
    }
  }
  return AppError.internal(err);
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`No route for ${req.method} ${req.path}.`));
};

export const errorHandler =
  (logger: Logger): ErrorRequestHandler =>
  (err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const error = normalizeError(err);
    const requestId = String(res.locals.requestId ?? '');
    if (error.status >= 500) {
      logger.error(
        { err: error.cause ?? error, code: error.code, path: req.path },
        'request failed',
      );
    } else {
      logger.debug({ code: error.code, path: req.path }, 'request rejected');
    }
    if (error.retryAfter !== undefined) res.setHeader('Retry-After', String(error.retryAfter));
    res
      .status(error.status)
      .type(PROBLEM_CONTENT_TYPE)
      .send(JSON.stringify(toProblem(error, req.originalUrl.split('?')[0] ?? req.path, requestId)));
  };
