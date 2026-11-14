import { API_PREFIX } from './config.ts';
import { ApiError, parseProblem } from './problem.ts';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  keepalive?: boolean;
  signal?: AbortSignal | undefined;
}

export interface Fetcher {
  <T>(path: string, options?: RequestOptions): Promise<T>;
}

let refreshing: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_PREFIX}/auth/refresh`, { method: 'POST', credentials: 'same-origin' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const hasBody = options.body !== undefined;
  return fetch(`${API_PREFIX}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    keepalive: options.keepalive,
    signal: options.signal,
  });
}

export const api: Fetcher = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  let response = await send(path, options);
  if (response.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) {
      response = await send(path, options);
    }
    if (response.status === 401) {
      redirectToLogin();
      throw await parseProblem(response);
    }
  }
  if (!response.ok) throw await parseProblem(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

export const isRetryable = (failureCount: number, error: unknown): boolean =>
  failureCount < 1 && error instanceof ApiError && error.status === 429;

export const retryDelay = (_attempt: number, error: unknown): number =>
  error instanceof ApiError && error.retryAfter ? Math.min(error.retryAfter, 60) * 1000 : 1000;
