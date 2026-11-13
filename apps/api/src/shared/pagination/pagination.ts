export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

const clampInt = (
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number => {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
};

export class PaginationParams {
  readonly page: number;
  readonly limit: number;

  constructor(page?: number, limit?: number) {
    this.page = clampInt(page, 1, Number.MAX_SAFE_INTEGER, 1);
    this.limit = clampInt(limit, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
  }

  get offset(): number {
    return (this.page - 1) * this.limit;
  }
}

export class Page<T> {
  readonly totalPages: number;

  constructor(
    readonly items: readonly T[],
    readonly total: number,
    readonly page: number,
    readonly limit: number,
  ) {
    this.totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  }

  static of<T>(items: readonly T[], total: number, params: PaginationParams): Page<T> {
    return new Page(items, total, params.page, params.limit);
  }

  map<U>(fn: (item: T) => U): Page<U> {
    return new Page(this.items.map(fn), this.total, this.page, this.limit);
  }

  get meta() {
    return { page: this.page, limit: this.limit, total: this.total, totalPages: this.totalPages };
  }
}
