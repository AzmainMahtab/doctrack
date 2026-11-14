import type { Timeseries, TimeseriesQuery } from '@doctrack/contracts';
import type { DayRow } from '../domain/model.ts';
import { addDays, monthStart, nextMonthStart, weekStart } from '../../../shared/time/index.ts';

export function resolveRange(
  query: Pick<TimeseriesQuery, 'window' | 'from' | 'to'>,
  today: string,
): { from: string; to: string } {
  if (query.from && query.to) return { from: query.from, to: query.to };
  const window = query.window ?? 30;
  return { from: addDays(today, -(window - 1)), to: today };
}

function bucketStart(interval: TimeseriesQuery['interval'], day: string): string {
  if (interval === 'week') return weekStart(day);
  if (interval === 'month') return monthStart(day);
  return day;
}

function bucketStarts(interval: TimeseriesQuery['interval'], from: string, to: string): string[] {
  const out: string[] = [];
  if (interval === 'day') {
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  } else if (interval === 'week') {
    for (let d = weekStart(from); d <= to; d = addDays(d, 7)) out.push(d);
  } else {
    for (let d = monthStart(from); d <= to; d = nextMonthStart(d)) out.push(d);
  }
  return out;
}

export function buildTimeseries(
  query: Pick<TimeseriesQuery, 'entity' | 'interval'>,
  range: { from: string; to: string },
  rows: readonly DayRow[],
): Timeseries {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.date < range.from || row.date > range.to) continue;
    const key = bucketStart(query.interval, row.date);
    totals.set(key, (totals.get(key) ?? 0) + row[query.entity]);
  }
  return {
    entity: query.entity,
    interval: query.interval,
    from: range.from,
    to: range.to,
    points: bucketStarts(query.interval, range.from, range.to).map((date) => ({
      date,
      count: Math.max(0, totals.get(date) ?? 0),
    })),
  };
}
