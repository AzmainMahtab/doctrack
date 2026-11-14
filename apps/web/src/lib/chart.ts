const STEPS = [1, 2, 3, 5, 10];

export interface Scale {
  top: number;
  ticks: number[];
}

export function niceScale(maxValue: number, tickCount = 4): Scale {
  const raw = Math.max(tickCount, maxValue) / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = (STEPS.find((s) => s * magnitude >= raw) ?? 10) * magnitude;
  const top = step * tickCount;
  return { top, ticks: Array.from({ length: tickCount + 1 }, (_, i) => top - i * step) };
}

export interface Bar {
  value: number;
  height: number;
}

export function buildBars(
  values: readonly number[],
  height: number,
  tickCount = 4,
): { scale: Scale; bars: Bar[] } {
  const scale = niceScale(Math.max(0, ...values), tickCount);
  return {
    scale,
    bars: values.map((value) => ({
      value,
      height: value <= 0 ? 0 : Math.max(2, Math.round((value / scale.top) * height)),
    })),
  };
}

export function labelIndexes(length: number, count: number): number[] {
  if (length <= count) return Array.from({ length }, (_, i) => i);
  return Array.from({ length: count }, (_, i) => Math.round((i * (length - 1)) / (count - 1)));
}
