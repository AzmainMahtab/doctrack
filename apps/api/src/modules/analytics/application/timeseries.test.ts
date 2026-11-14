import { describe, expect, it } from 'vitest';
import { buildTimeseries, resolveRange } from './timeseries.ts';

const rows = [
  { date: '2026-01-05', patients: 3, doctors: 0 },
  { date: '2026-01-07', patients: 2, doctors: 1 },
  { date: '2026-01-12', patients: 4, doctors: 0 },
  { date: '2026-02-03', patients: 1, doctors: 2 },
];

describe('resolveRange', () => {
  it('ends today and spans exactly the window', () => {
    expect(resolveRange({ window: 7 }, '2026-11-14')).toEqual({
      from: '2026-11-08',
      to: '2026-11-14',
    });
    expect(resolveRange({}, '2026-11-14')).toEqual({ from: '2026-10-16', to: '2026-11-14' });
  });

  it('uses a custom range when both ends are given', () => {
    expect(resolveRange({ from: '2026-01-01', to: '2026-01-31' }, '2026-11-14')).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
    });
  });
});

describe('buildTimeseries', () => {
  it('returns one zero-filled point per day', () => {
    const series = buildTimeseries(
      { entity: 'patients', interval: 'day' },
      { from: '2026-01-05', to: '2026-01-09' },
      rows,
    );
    expect(series.points).toEqual([
      { date: '2026-01-05', count: 3 },
      { date: '2026-01-06', count: 0 },
      { date: '2026-01-07', count: 2 },
      { date: '2026-01-08', count: 0 },
      { date: '2026-01-09', count: 0 },
    ]);
  });

  it('has exactly 30 points for a 30-day window', () => {
    const range = resolveRange({ window: 30 }, '2026-11-14');
    expect(buildTimeseries({ entity: 'patients', interval: 'day' }, range, []).points).toHaveLength(
      30,
    );
    expect(
      buildTimeseries({ entity: 'patients', interval: 'day' }, range, []).points.every(
        (p) => p.count === 0,
      ),
    ).toBe(true);
  });

  it('groups by Monday-start weeks and counts only days inside the range', () => {
    const full = buildTimeseries(
      { entity: 'patients', interval: 'week' },
      { from: '2026-01-05', to: '2026-01-18' },
      rows,
    );
    expect(full.points).toEqual([
      { date: '2026-01-05', count: 5 },
      { date: '2026-01-12', count: 4 },
    ]);
    const partial = buildTimeseries(
      { entity: 'patients', interval: 'week' },
      { from: '2026-01-07', to: '2026-01-12' },
      rows,
    );
    expect(partial.points).toEqual([
      { date: '2026-01-05', count: 2 },
      { date: '2026-01-12', count: 4 },
    ]);
  });

  it('groups by calendar month', () => {
    const series = buildTimeseries(
      { entity: 'patients', interval: 'month' },
      { from: '2026-01-01', to: '2026-03-15' },
      rows,
    );
    expect(series.points).toEqual([
      { date: '2026-01-01', count: 9 },
      { date: '2026-02-01', count: 1 },
      { date: '2026-03-01', count: 0 },
    ]);
  });

  it('reads the doctors counter when asked and clamps negatives', () => {
    const series = buildTimeseries(
      { entity: 'doctors', interval: 'month' },
      { from: '2026-01-01', to: '2026-02-28' },
      [...rows, { date: '2026-02-10', patients: 0, doctors: -9 }],
    );
    expect(series.points).toEqual([
      { date: '2026-01-01', count: 1 },
      { date: '2026-02-01', count: 0 },
    ]);
  });
});
