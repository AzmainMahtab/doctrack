import 'server-only';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { apiOrigin, API_PREFIX } from './config.ts';
import { clientIp } from './client-ip.ts';
import type { Fetcher, RequestOptions } from './client.ts';
import { ApiError, parseProblem } from './problem.ts';

export const serverApi: Fetcher = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const [jar, incoming] = await Promise.all([cookies(), headers()]);
  const response = await fetch(`${apiOrigin()}${API_PREFIX}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      cookie: jar.toString(),
      'x-forwarded-for': clientIp(incoming),
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });
  if (response.status === 401) redirect('/login');
  if (response.status === 404) notFound();
  if (!response.ok) throw await parseProblem(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

export { ApiError };
