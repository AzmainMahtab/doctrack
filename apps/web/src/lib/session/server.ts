import 'server-only';
import type { Me } from '@doctrack/contracts';
import { cache } from 'react';
import { serverApi } from '../api/server';

export const getSession = cache(
  async (): Promise<Me> => (await serverApi<{ data: Me }>('/auth/me')).data,
);
