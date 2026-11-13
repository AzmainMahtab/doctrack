import type { ErrorCode } from '@doctrack/contracts';

export interface FieldError {
  field: string;
  message: string;
}

export interface AppErrorOptions {
  errors?: FieldError[];
  retryAfter?: number;
  cause?: unknown;
}

export const ERROR_STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  TOKEN_REVOKED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  UNAVAILABLE: 503,
};

export const ERROR_TITLE: Record<ErrorCode, string> = {
  BAD_REQUEST: 'Bad request',
  UNAUTHENTICATED: 'Authentication required',
  TOKEN_REVOKED: 'Token revoked',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Not found',
  CONFLICT: 'Conflict',
  VALIDATION_FAILED: 'Request validation failed',
  RATE_LIMITED: 'Too many requests',
  INTERNAL_ERROR: 'Internal error',
  UNAVAILABLE: 'Service unavailable',
};

export class AppError extends Error {
  readonly errors: FieldError[];
  readonly retryAfter?: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    options: AppErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.errors = options.errors ?? [];
    if (options.retryAfter !== undefined) this.retryAfter = options.retryAfter;
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }

  get title(): string {
    return ERROR_TITLE[this.code];
  }

  static is(err: unknown, code?: ErrorCode): err is AppError {
    return err instanceof AppError && (code === undefined || err.code === code);
  }

  static badRequest(message: string, cause?: unknown): AppError {
    return new AppError('BAD_REQUEST', message, { cause });
  }

  static unauthenticated(message = 'Authentication is required.'): AppError {
    return new AppError('UNAUTHENTICATED', message);
  }

  static tokenRevoked(message = 'This token has been revoked.'): AppError {
    return new AppError('TOKEN_REVOKED', message);
  }

  static forbidden(message = 'You do not have permission to perform this action.'): AppError {
    return new AppError('FORBIDDEN', message);
  }

  static notFound(message: string): AppError {
    return new AppError('NOT_FOUND', message);
  }

  static conflict(message: string): AppError {
    return new AppError('CONFLICT', message);
  }

  static validation(errors: FieldError[], message?: string): AppError {
    const detail =
      message ?? `${errors.length} ${errors.length === 1 ? 'field is' : 'fields are'} invalid.`;
    return new AppError('VALIDATION_FAILED', detail, { errors });
  }

  static rateLimited(retryAfter: number, message?: string): AppError {
    return new AppError(
      'RATE_LIMITED',
      message ?? `Rate limit exceeded. Retry in ${retryAfter} seconds.`,
      { retryAfter },
    );
  }

  static unavailable(retryAfter: number, message: string): AppError {
    return new AppError('UNAVAILABLE', message, { retryAfter });
  }

  static internal(cause: unknown): AppError {
    return new AppError('INTERNAL_ERROR', 'An unexpected error occurred.', { cause });
  }
}
