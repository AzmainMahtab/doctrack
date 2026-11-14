import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, isRetryable, retryDelay } from './client';
import { ApiError } from './problem';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const problem = (status: number, code: string, extra: object = {}) =>
  new Response(JSON.stringify({ status, code, detail: code, ...extra }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });

describe('api client', () => {
  const fetchMock = vi.fn();
  const assign = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    assign.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(window, 'location', {
      value: { pathname: '/doctors', search: '?q=a', assign },
      writable: true,
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns the parsed body and sends cookies to the same origin', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [1] }));
    expect(await api<{ data: number[] }>('/doctors')).toEqual({ data: [1] });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/doctors',
      expect.objectContaining({ credentials: 'same-origin', method: 'GET' }),
    );
  });

  it('sends JSON bodies and returns undefined for 204', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await api('/patients/1', { method: 'DELETE' })).toBeUndefined();
    fetchMock.mockResolvedValueOnce(json({ data: {} }, 201));
    await api('/doctors', { method: 'POST', body: { name: 'A' } });
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(init.body).toBe('{"name":"A"}');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('refreshes once on 401 and retries the request', async () => {
    fetchMock
      .mockResolvedValueOnce(problem(401, 'UNAUTHENTICATED'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(json({ data: 'ok' }));
    expect(await api('/doctors')).toEqual({ data: 'ok' });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/api/v1/doctors',
      '/api/v1/auth/refresh',
      '/api/v1/doctors',
    ]);
    expect(assign).not.toHaveBeenCalled();
  });

  it('shares one refresh between concurrent 401s', async () => {
    let refreshes = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/v1/auth/refresh') {
        refreshes += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return new Response(null, { status: 200 });
      }
      const seen = fetchMock.mock.calls.filter((c) => c[0] === url).length;
      return seen <= 2 ? problem(401, 'UNAUTHENTICATED') : json({ data: url });
    });
    const [a, b] = await Promise.all([api('/doctors'), api('/doctors')]);
    expect(a).toEqual(b);
    expect(refreshes).toBe(1);
  });

  it('sends the user to sign in when the refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce(problem(401, 'UNAUTHENTICATED'))
      .mockResolvedValueOnce(problem(401, 'TOKEN_REVOKED'))
      .mockResolvedValueOnce(problem(401, 'UNAUTHENTICATED'));
    await expect(api('/doctors')).rejects.toMatchObject({ status: 401 });
    expect(assign).toHaveBeenCalledWith('/login?next=%2Fdoctors%3Fq%3Da');
  });

  it('does not try to refresh the auth routes themselves', async () => {
    fetchMock.mockResolvedValueOnce(problem(401, 'UNAUTHENTICATED'));
    await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('turns failures into ApiError with the code', async () => {
    fetchMock.mockResolvedValueOnce(problem(409, 'CONFLICT'));
    await expect(api('/doctors', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
    });
  });
});

describe('retry policy', () => {
  it('retries a 429 once and nothing else', () => {
    const limited = new ApiError({
      status: 429,
      code: 'RATE_LIMITED',
      message: 'x',
      retryAfter: 7,
    });
    expect(isRetryable(0, limited)).toBe(true);
    expect(isRetryable(1, limited)).toBe(false);
    expect(isRetryable(0, new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))).toBe(
      false,
    );
    expect(
      isRetryable(0, new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: 'x' })),
    ).toBe(false);
    expect(isRetryable(0, new Error('network'))).toBe(false);
  });

  it('waits for Retry-After, capped at a minute', () => {
    expect(
      retryDelay(
        0,
        new ApiError({ status: 429, code: 'RATE_LIMITED', message: 'x', retryAfter: 7 }),
      ),
    ).toBe(7000);
    expect(
      retryDelay(
        0,
        new ApiError({ status: 429, code: 'RATE_LIMITED', message: 'x', retryAfter: 900 }),
      ),
    ).toBe(60_000);
    expect(retryDelay(0, new Error('x'))).toBe(1000);
  });
});
