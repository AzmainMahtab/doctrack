import type { Timeseries, TimeseriesQuery } from '@doctrack/contracts';
import { SegmentedLinks } from '@/components/ui/segmented-links';
import { buildBars, labelIndexes } from '@/lib/chart';
import { formatDay, plural } from '@/lib/format';
import { cn } from '@/lib/cn';

const ENTITIES = [
  { value: 'patients', label: 'Patients' },
  { value: 'doctors', label: 'Doctors' },
] as const;
const WINDOWS = [7, 30, 90] as const;
const INTERVALS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
] as const;

const hrefFor = (query: TimeseriesQuery, patch: Partial<TimeseriesQuery>): string => {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.entity !== 'patients') params.set('entity', next.entity);
  if (next.interval !== 'day') params.set('interval', next.interval);
  if (next.window && next.window !== 30) params.set('window', String(next.window));
  const text = params.toString();
  return text ? `/dashboard?${text}` : '/dashboard';
};

export function RegistrationsChart({
  series,
  query,
}: {
  series: Timeseries;
  query: TimeseriesQuery;
}) {
  const values = series.points.map((p) => p.count);
  const { scale, bars } = buildBars(values, 100);
  const window = query.window ?? 30;
  const noun = series.entity === 'patients' ? 'patient' : 'doctor';
  const labels = labelIndexes(series.points.length, 6);
  const caption =
    series.entity === 'patients'
      ? `Patients added per ${series.interval}, last ${window} days. Records that still exist, counted on the day they were registered.`
      : `Doctors registered per ${series.interval}, last ${window} days.`;

  return (
    <section aria-labelledby="registrations-title" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1">
          <h2 id="registrations-title" className="font-display text-h2 font-medium text-ink">
            New registrations
          </h2>
          <p className="text-small text-ink-muted">{caption}</p>
        </div>
        <div className="flex flex-wrap gap-3 max-md:w-full">
          <SegmentedLinks
            label="Entity"
            className="max-md:flex-1"
            items={ENTITIES.map((e) => ({
              label: e.label,
              href: hrefFor(query, { entity: e.value }),
              selected: query.entity === e.value,
            }))}
          />
          <SegmentedLinks
            label="Window"
            className="max-md:flex-1"
            items={WINDOWS.map((w) => ({
              label: `${w} days`,
              href: hrefFor(query, { window: w }),
              selected: window === w,
            }))}
          />
          <SegmentedLinks
            label="Interval"
            className="max-md:flex-1"
            items={INTERVALS.map((i) => ({
              label: i.label,
              href: hrefFor(query, { interval: i.value }),
              selected: query.interval === i.value,
            }))}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <div
          aria-hidden
          className="flex h-52 w-7 shrink-0 flex-col justify-between text-right text-caption text-ink-subtle tabular-nums md:h-65"
        >
          {scale.ticks.map((tick) => (
            <span key={tick} className="-my-1.5 leading-3">
              {tick}
            </span>
          ))}
        </div>
        <div className="relative h-52 min-w-0 flex-1 md:h-65">
          <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
            {scale.ticks.map((tick, index) => (
              <span
                key={tick}
                className={cn(
                  'block h-px w-full',
                  index === scale.ticks.length - 1 ? 'bg-border-input' : 'bg-border',
                )}
              />
            ))}
          </div>
          <ol
            className={cn(
              'absolute inset-0 flex items-end',
              series.points.length > 40 ? 'gap-px' : 'gap-0.5 md:gap-2',
            )}
          >
            {series.points.map((point, index) => {
              const bar = bars[index];
              return (
                <li
                  key={point.date}
                  aria-label={`${formatDay(point.date)}: ${plural(point.count, noun)}`}
                  className="group relative flex h-full min-w-0 flex-1 items-end"
                >
                  <span
                    className={cn(
                      'block w-full origin-bottom rounded-t-mark',
                      point.count === 0 ? 'bg-border-input' : 'bg-accent',
                      'animate-[bar-rise_480ms_var(--ease-out)_both]',
                    )}
                    style={{
                      height: point.count === 0 ? '2px' : `${bar?.height ?? 0}%`,
                      animationDelay: `${Math.min(index, 30) * 12}ms`,
                    }}
                  />
                  <span
                    role="presentation"
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-ui bg-ink px-2 py-1 text-caption whitespace-nowrap text-bg group-hover:block"
                  >
                    {formatDay(point.date)}: {point.count}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div aria-hidden className="flex justify-between pl-10 text-caption text-ink-subtle">
        {labels.map((index) => (
          <span key={index}>{formatDay(series.points[index]?.date ?? series.from)}</span>
        ))}
      </div>

      <details className="text-small">
        <summary className="w-fit cursor-pointer font-medium text-accent hover:underline">
          View as table
        </summary>
        <div className="mt-3 max-h-64 overflow-auto border-y border-border">
          <table className="w-full text-left text-small tabular-nums">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="text-caption tracking-[0.05em] text-ink-muted uppercase">
                <th scope="col" className="py-2 font-semibold">
                  {series.interval === 'day'
                    ? 'Day'
                    : series.interval === 'week'
                      ? 'Week starting'
                      : 'Month starting'}
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  {series.entity === 'patients' ? 'Patients' : 'Doctors'}
                </th>
              </tr>
            </thead>
            <tbody>
              {series.points.map((point) => (
                <tr key={point.date} className="border-t border-border">
                  <td className="py-1.5 text-ink-muted">{formatDay(point.date)}</td>
                  <td className="py-1.5 text-right text-ink">{point.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
