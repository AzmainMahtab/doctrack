import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { DoctorsView } from '@/features/doctors/components/doctors-view';
import { serverApi } from '@/lib/api/server';
import { normalizeDoctorQuery, q } from '@/lib/query/queries';
import { getQueryClient, prefetch } from '@/lib/query/server';

export const metadata: Metadata = { title: 'Doctors' };

export default async function DoctorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const query = normalizeDoctorQuery(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const client = getQueryClient();
  await Promise.all([
    prefetch(client, q.doctors(serverApi, query) as never),
    prefetch(client, q.facets(serverApi) as never),
  ]);
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <DoctorsView />
    </HydrationBoundary>
  );
}
