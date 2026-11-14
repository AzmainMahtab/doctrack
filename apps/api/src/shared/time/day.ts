const DAY_MS = 86_400_000;

export const utcDay = (date: Date): string => date.toISOString().slice(0, 10);

const toMs = (day: string): number => Date.parse(`${day}T00:00:00.000Z`);

export const addDays = (day: string, days: number): string =>
  utcDay(new Date(toMs(day) + days * DAY_MS));

export const daysBetween = (from: string, to: string): number =>
  Math.round((toMs(to) - toMs(from)) / DAY_MS);

export const weekStart = (day: string): string => {
  const weekday = new Date(toMs(day)).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
};

export const monthStart = (day: string): string => `${day.slice(0, 7)}-01`;

export const nextMonthStart = (day: string): string => {
  const date = new Date(toMs(monthStart(day)));
  return utcDay(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)));
};
