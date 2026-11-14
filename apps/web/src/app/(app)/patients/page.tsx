import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { PatientsView } from '@/features/patients/components/patients-view';
import { serverApi } from '@/lib/api/server';
import { normalizePatientQuery, q } from '@/lib/query/queries';
import { getQueryClient, prefetch } from '@/lib/query/server';

export const metadata: Metadata = { title: 'Patients' };

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const query = normalizePatientQuery(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const client = getQueryClient();
  await prefetch(client, q.patients(serverApi, query) as never);
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <PatientsView />
    </HydrationBoundary>
  );
}
