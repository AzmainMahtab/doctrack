import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, monthStart, nextMonthStart, utcDay, weekStart } from './day.ts';

describe('day helpers', () => {
  it('formats and shifts UTC days across month and year boundaries', () => {
    expect(utcDay(new Date('2026-11-14T23:59:59Z'))).toBe('2026-11-14');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364);
  });

  it('finds the Monday of a week, including Sundays', () => {
    expect(weekStart('2026-01-05')).toBe('2026-01-05');
    expect(weekStart('2026-01-07')).toBe('2026-01-05');
    expect(weekStart('2026-01-11')).toBe('2026-01-05');
    expect(weekStart('2026-01-12')).toBe('2026-01-12');
  });

  it('finds month starts', () => {
    expect(monthStart('2026-02-17')).toBe('2026-02-01');
    expect(nextMonthStart('2026-12-17')).toBe('2027-01-01');
    expect(nextMonthStart('2026-01-31')).toBe('2026-02-01');
  });
});
