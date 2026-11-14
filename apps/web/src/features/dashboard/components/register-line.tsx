import type { ConditionCounts, Summary } from '@doctrack/contracts';
import { formatDateTime, plural } from '@/lib/format';

export function RegisterLine({
  summary,
  conditions,
}: {
  summary: Summary;
  conditions: ConditionCounts;
}) {
  const { patients, doctors } = summary;
  const critical = conditions.counts.critical;
  const observation = conditions.counts.under_observation;
  return (
    <section aria-label="Register totals" className="flex flex-col gap-2">
      <p className="font-display text-h1 font-normal text-ink">
        <span className="text-accent tabular-nums">{patients.toLocaleString('en-GB')}</span>{' '}
        {patients === 1 ? 'patient is' : 'patients are'} on record with{' '}
        <span className="text-accent tabular-nums">{doctors.toLocaleString('en-GB')}</span>{' '}
        {doctors === 1 ? 'doctor' : 'doctors'}.
      </p>
      <p className="text-body text-ink-muted">
        {plural(critical, 'patient')} {critical === 1 ? 'is' : 'are'} critical and{' '}
        {observation.toLocaleString('en-GB')} {observation === 1 ? 'is' : 'are'} under observation.{' '}
        {summary.updatedAt ? `Updated ${formatDateTime(summary.updatedAt)}.` : 'No activity yet.'}
      </p>
    </section>
  );
}
