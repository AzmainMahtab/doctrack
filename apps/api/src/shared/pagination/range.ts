export interface DateRange {
  from?: Date;
  to?: Date;
}

export function dayRange(from?: string, to?: string): DateRange {
  const range: DateRange = {};
  if (from) range.from = new Date(`${from}T00:00:00.000Z`);
  if (to) range.to = new Date(`${to}T23:59:59.999Z`);
  return range;
}

export function rangeFilter(range: DateRange): { $gte?: Date; $lte?: Date } | undefined {
  if (!range.from && !range.to) return undefined;
  const out: { $gte?: Date; $lte?: Date } = {};
  if (range.from) out.$gte = range.from;
  if (range.to) out.$lte = range.to;
  return out;
}
