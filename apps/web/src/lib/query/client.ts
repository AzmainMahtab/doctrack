import { QueryClient } from '@tanstack/react-query';
import { isRetryable, retryDelay } from '../api/client.ts';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: isRetryable,
        retryDelay,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}
