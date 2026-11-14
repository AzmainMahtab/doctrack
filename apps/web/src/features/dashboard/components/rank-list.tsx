import type { PatientsPerDoctorRow } from '@doctrack/contracts';
import Link from 'next/link';

export function RankList({ rows }: { rows: readonly PatientsPerDoctorRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.patientCount));
  return (
    <section aria-labelledby="per-doctor-title" className="flex min-w-0 flex-1 flex-col gap-4">
      <h2 id="per-doctor-title" className="font-display text-h2 font-medium text-ink">
        Patients per doctor
      </h2>
      {rows.length === 0 ? (
        <p className="text-body text-ink-muted">No doctors on the register yet.</p>
      ) : (
        <ol className="flex flex-col">
          {rows.map((row, index) => (
            <li key={row.doctorId} className="flex h-10 items-center gap-4 border-b border-border">
              <span className="w-5 text-caption text-ink-subtle tabular-nums">{index + 1}</span>
              <Link
                href={`/doctors/${row.doctorId}`}
                className="min-w-0 flex-1 truncate text-body font-medium text-ink hover:text-accent hover:underline"
                title={row.name}
              >
                {row.name}
              </Link>
              <span aria-hidden className="h-2 w-24 shrink-0 rounded-mark bg-bg-sunken md:w-50">
                <span
                  className="block h-2 origin-left animate-[rank-grow_320ms_var(--ease-out)_both] rounded-mark bg-accent"
                  style={{ width: `${Math.round((row.patientCount / max) * 100)}%` }}
                />
              </span>
              <span className="w-8 text-right text-body font-medium text-ink tabular-nums">
                {row.patientCount}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
