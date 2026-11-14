import { describe, expect, it } from 'vitest';
import { buildBars, labelIndexes, niceScale } from './chart';

describe('niceScale', () => {
  it('rounds the top up to a readable step', () => {
    expect(niceScale(0)).toEqual({ top: 4, ticks: [4, 3, 2, 1, 0] });
    expect(niceScale(37).top).toBe(40);
    expect(niceScale(37).ticks).toEqual([40, 30, 20, 10, 0]);
    expect(niceScale(1234).top).toBeGreaterThanOrEqual(1234);
  });
});

describe('buildBars', () => {
  it('scales heights to the top tick and keeps a visible sliver for small values', () => {
    const { scale, bars } = buildBars([0, 1, 40], 100);
    expect(scale.top).toBe(40);
    expect(bars.map((b) => b.height)).toEqual([0, 3, 100]);
  });

  it('handles an empty series', () => {
    expect(buildBars([], 100).bars).toEqual([]);
  });
});

describe('labelIndexes', () => {
  it('labels every point when there are few', () => {
    expect(labelIndexes(3, 5)).toEqual([0, 1, 2]);
  });
  it('spreads labels from the first to the last point', () => {
    const idx = labelIndexes(30, 5);
    expect(idx).toHaveLength(5);
    expect(idx[0]).toBe(0);
    expect(idx.at(-1)).toBe(29);
  });
});
