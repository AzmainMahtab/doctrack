import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { DoctorDetailView } from '@/features/doctors/components/doctor-detail-view';
import { serverApi } from '@/lib/api/server';
import { normalizeDoctorPatientQuery, q } from '@/lib/query/queries';
import { getQueryClient, prefetch } from '@/lib/query/server';

export const metadata: Metadata = { title: 'Doctor' };

export default async function DoctorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, raw] = await Promise.all([params, searchParams]);
  const query = normalizeDoctorPatientQuery(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const client = getQueryClient();
  await Promise.all([
    prefetch(client, q.doctor(serverApi, id) as never),
    prefetch(client, q.doctorPatients(serverApi, id, query) as never),
  ]);
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <DoctorDetailView id={id} />
    </HydrationBoundary>
  );
}
