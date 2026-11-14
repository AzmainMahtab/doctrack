import { describe, expect, it } from 'vitest';
import { ApiError, fieldErrors, parseProblem } from './problem';

const response = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/problem+json', ...headers },
  });

describe('parseProblem', () => {
  it('maps Problem Details to an ApiError', async () => {
    const error = await parseProblem(
      response(
        {
          type: 'x',
          title: 'Request validation failed',
          status: 422,
          detail: '2 fields are invalid.',
          code: 'VALIDATION_FAILED',
          requestId: 'req-1',
          errors: [{ field: 'body.phone', message: 'Must be in E.164 format' }],
        },
        422,
      ),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'VALIDATION_FAILED',
      requestId: 'req-1',
      message: '2 fields are invalid.',
    });
    expect(fieldErrors(error)).toEqual({ phone: 'Must be in E.164 format' });
  });

  it('reads retryAfter from the body or the header', async () => {
    const fromBody = await parseProblem(
      response({ status: 429, code: 'RATE_LIMITED', detail: 'slow down', retryAfter: 34 }, 429),
    );
    expect(fromBody.retryAfter).toBe(34);
    const fromHeader = await parseProblem(
      response({ status: 429, code: 'RATE_LIMITED', detail: 'x' }, 429, { 'retry-after': '12' }),
    );
    expect(fromHeader.retryAfter).toBe(12);
  });

  it('survives a body that is not JSON', async () => {
    const error = await parseProblem(new Response('<html>bad gateway</html>', { status: 502 }));
    expect(error).toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });
});

describe('fieldErrors', () => {
  it('strips the location prefix and keeps the first message per field', () => {
    const error = new ApiError({
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'x',
      errors: [
        { field: 'body.email', message: 'Invalid email' },
        { field: 'body.email', message: 'Second' },
        { field: 'query.limit', message: 'Too big' },
      ],
    });
    expect(fieldErrors(error)).toEqual({ email: 'Invalid email', limit: 'Too big' });
  });

  it('returns nothing for other errors', () => {
    expect(fieldErrors(new Error('x'))).toEqual({});
  });
});
