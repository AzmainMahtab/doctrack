import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, Page, PaginationParams } from './pagination.ts';

describe('PaginationParams', () => {
  it('applies defaults', () => {
    const p = new PaginationParams();
    expect(p.page).toBe(1);
    expect(p.limit).toBe(DEFAULT_PAGE_SIZE);
    expect(p.offset).toBe(0);
  });

  it('clamps page and limit', () => {
    expect(new PaginationParams(0, 0)).toMatchObject({ page: 1, limit: 1 });
    expect(new PaginationParams(-5, 10_000)).toMatchObject({ page: 1, limit: MAX_PAGE_SIZE });
    expect(new PaginationParams(Number.NaN, Number.NaN)).toMatchObject({ page: 1, limit: 20 });
  });

  it('computes the offset', () => {
    expect(new PaginationParams(3, 25).offset).toBe(50);
  });
});

describe('Page', () => {
  it('computes total pages and meta', () => {
    const page = Page.of(['a', 'b'], 45, new PaginationParams(3, 20));
    expect(page.meta).toEqual({ page: 3, limit: 20, total: 45, totalPages: 3 });
  });

  it('has zero pages when empty', () => {
    expect(Page.of([], 0, new PaginationParams()).totalPages).toBe(0);
  });

  it('maps items', () => {
    expect(Page.of([1, 2], 2, new PaginationParams()).map((n) => n * 2).items).toEqual([2, 4]);
  });
});
