import type { Problem } from '@doctrack/contracts';

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: FieldError[];
  readonly retryAfter: number | undefined;
  readonly requestId: string | undefined;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    errors?: FieldError[];
    retryAfter?: number | undefined;
    requestId?: string | undefined;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.errors = init.errors ?? [];
    this.retryAfter = init.retryAfter;
    this.requestId = init.requestId;
  }
}

export async function parseProblem(response: Response): Promise<ApiError> {
  const retryHeader = Number(response.headers.get('retry-after'));
  try {
    const body = (await response.json()) as Partial<Problem>;
    return new ApiError({
      status: body.status ?? response.status,
      code: body.code ?? 'INTERNAL_ERROR',
      message: body.detail ?? body.title ?? 'Request failed.',
      errors: body.errors ?? [],
      retryAfter:
        body.retryAfter ??
        (Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined),
      requestId: body.requestId,
    });
  } catch {
    return new ApiError({
      status: response.status,
      code: 'INTERNAL_ERROR',
      message: 'Request failed.',
      retryAfter: Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined,
    });
  }
}

export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const out: Record<string, string> = {};
  for (const item of error.errors) {
    const name = item.field.replace(/^(body|query|params)\./, '');
    out[name] ??= item.message;
  }
  return out;
}
