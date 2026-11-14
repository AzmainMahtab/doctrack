import 'server-only';
import type { QueryClient } from '@tanstack/react-query';
import { type FetchQueryOptions } from '@tanstack/react-query';
import { cache } from 'react';
import { ApiError } from '../api/problem';
import { makeQueryClient } from './client';

export const getQueryClient = cache((): QueryClient => makeQueryClient());

const isControlFlow = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  typeof (error as { digest?: unknown }).digest === 'string' &&
  /^NEXT_/.test((error as { digest: string }).digest);

export async function prefetch(
  client: QueryClient,
  options: FetchQueryOptions<never, never, never, never>,
): Promise<void>;
export async function prefetch(client: QueryClient, options: unknown): Promise<void> {
  try {
    await client.fetchQuery(options as FetchQueryOptions);
  } catch (error) {
    if (isControlFlow(error) || !(error instanceof ApiError)) throw error;
  }
}
