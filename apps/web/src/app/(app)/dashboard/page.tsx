import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageTitle } from '@/components/layout/page-title';
import { ConditionPanel } from '@/features/dashboard/components/condition-panel';
import { RankList } from '@/features/dashboard/components/rank-list';
import { RegisterLine } from '@/features/dashboard/components/register-line';
import { RegistrationsChart } from '@/features/dashboard/components/registrations-chart';
import { SectionError } from '@/features/dashboard/components/section-error';
import { serverApi } from '@/lib/api/server';
import { normalizeTimeseriesQuery, toSearch, type One } from '@/lib/query/queries';
import type {
  ConditionCounts,
  PatientsPerDoctorRow,
  Summary,
  Timeseries,
} from '@doctrack/contracts';

export const metadata: Metadata = { title: 'Dashboard' };

async function attempt<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    const digest = (error as { digest?: unknown })?.digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_')) throw error;
    return null;
  }
}

const fetchOne = <T,>(path: string) => attempt(async () => (await serverApi<One<T>>(path)).data);

async function Totals() {
  const [summary, conditions] = await Promise.all([
    fetchOne<Summary>('/dashboard/summary'),
    fetchOne<ConditionCounts>('/dashboard/conditions'),
  ]);
  if (!summary || !conditions) return <SectionError what="the totals" href="/dashboard" />;
  return <RegisterLine summary={summary} conditions={conditions} />;
}

async function Registrations({ raw }: { raw: Record<string, unknown> }) {
  const query = normalizeTimeseriesQuery(raw);
  const series = await fetchOne<Timeseries>(`/dashboard/timeseries${toSearch(query)}`);
  if (!series) return <SectionError what="the registrations chart" href="/dashboard" />;
  return <RegistrationsChart series={series} query={query} />;
}

async function Lower() {
  const [rows, conditions] = await Promise.all([
    fetchOne<PatientsPerDoctorRow[]>('/dashboard/patients-per-doctor?limit=10'),
    fetchOne<ConditionCounts>('/dashboard/conditions'),
  ]);
  return (
    <div className="flex flex-col gap-10 lg:flex-row lg:gap-18">
      {rows ? <RankList rows={rows} /> : <SectionError what="the ranking" href="/dashboard" />}
      {conditions ? (
        <ConditionPanel conditions={conditions} />
      ) : (
        <SectionError what="the conditions" href="/dashboard" />
      )}
    </div>
  );
}

const Fallback = ({ height }: { height: string }) => (
  <div aria-hidden className={`${height} animate-pulse rounded-ui bg-bg-sunken`} />
);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  return (
    <>
      <PageTitle
        title="Dashboard"
        subtitle="What the register holds today. Figures update within a few seconds of a change."
      />
      <div className="flex flex-col gap-10">
        <Suspense fallback={<Fallback height="h-24" />}>
          <Totals />
        </Suspense>
        <Suspense fallback={<Fallback height="h-96" />}>
          <Registrations raw={flat} />
        </Suspense>
        <Suspense fallback={<Fallback height="h-96" />}>
          <Lower />
        </Suspense>
      </div>
    </>
  );
}
