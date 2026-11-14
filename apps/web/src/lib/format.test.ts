import { describe, expect, it } from 'vitest';
import { formatDate, formatDay, plural, share } from './format';

describe('format', () => {
  it('formats dates in UTC', () => {
    expect(formatDate('2026-11-14T23:30:00.000Z')).toBe('14 Nov 2026');
    expect(formatDay('2026-11-04')).toBe('4 Nov');
  });
  it('pluralises with grouped numbers', () => {
    expect(plural(1, 'patient')).toBe('1 patient');
    expect(plural(1234, 'patient')).toBe('1,234 patients');
    expect(plural(2, 'person', 'people')).toBe('2 people');
  });
  it('computes shares', () => {
    expect(share(1, 4)).toBe('25.0%');
    expect(share(0, 0)).toBe('0.0%');
  });
});
