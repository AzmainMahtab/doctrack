import { CONDITIONS, type Condition } from '@doctrack/contracts';

export type ConditionCounts = Record<Condition, number>;

export const emptyConditions = (): ConditionCounts => ({
  stable: 0,
  under_observation: 0,
  critical: 0,
  recovered: 0,
});

export interface DayRow {
  date: string;
  patients: number;
  doctors: number;
}

export interface Totals {
  doctors: number;
  patients: number;
  conditions: ConditionCounts;
  updatedAt: Date | null;
}

export interface Snapshot {
  doctors: number;
  patients: number;
  conditions: ConditionCounts;
  daily: DayRow[];
}

export interface Delta {
  doctors: number;
  patients: number;
  conditions: Partial<ConditionCounts>;
  day: { date: string; patients: number; doctors: number } | null;
}

export const isCondition = (value: unknown): value is Condition =>
  typeof value === 'string' && (CONDITIONS as readonly string[]).includes(value);

const isDay = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

export function deltaFor(event: { name: string; payload: Record<string, unknown> }): Delta | null {
  const p = event.payload;
  switch (event.name) {
    case 'doctor.registered':
      if (!isDay(p.registeredOn)) return null;
      return {
        doctors: 1,
        patients: 0,
        conditions: {},
        day: { date: p.registeredOn, patients: 0, doctors: 1 },
      };
    case 'patient.registered':
      if (!isDay(p.registeredOn) || !isCondition(p.condition)) return null;
      return {
        doctors: 0,
        patients: 1,
        conditions: { [p.condition]: 1 },
        day: { date: p.registeredOn, patients: 1, doctors: 0 },
      };
    case 'patient.removed':
      if (!isDay(p.registeredOn) || !isCondition(p.condition)) return null;
      return {
        doctors: 0,
        patients: -1,
        conditions: { [p.condition]: -1 },
        day: { date: p.registeredOn, patients: -1, doctors: 0 },
      };
    case 'patient.condition_changed':
      if (!isCondition(p.from) || !isCondition(p.to) || p.from === p.to) return null;
      return {
        doctors: 0,
        patients: 0,
        conditions: { [p.from]: -1, [p.to]: 1 },
        day: null,
      };
    default:
      return null;
  }
}

export function normalize(snapshot: Snapshot): Snapshot {
  return {
    doctors: Math.max(0, snapshot.doctors),
    patients: Math.max(0, snapshot.patients),
    conditions: Object.fromEntries(
      CONDITIONS.map((c) => [c, Math.max(0, snapshot.conditions[c] ?? 0)]),
    ) as ConditionCounts,
    daily: snapshot.daily
      .map((d) => ({
        date: d.date,
        patients: Math.max(0, d.patients),
        doctors: Math.max(0, d.doctors),
      }))
      .filter((d) => d.patients !== 0 || d.doctors !== 0)
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function diffSnapshots(expected: Snapshot, actual: Snapshot): string[] {
  const a = normalize(expected);
  const b = normalize(actual);
  const out: string[] = [];
  if (a.doctors !== b.doctors) out.push(`doctors: expected ${a.doctors}, found ${b.doctors}`);
  if (a.patients !== b.patients) out.push(`patients: expected ${a.patients}, found ${b.patients}`);
  for (const c of CONDITIONS) {
    if (a.conditions[c] !== b.conditions[c]) {
      out.push(`condition ${c}: expected ${a.conditions[c]}, found ${b.conditions[c]}`);
    }
  }
  const foundByDate = new Map(b.daily.map((d) => [d.date, d]));
  const expectedByDate = new Map(a.daily.map((d) => [d.date, d]));
  for (const date of new Set([...foundByDate.keys(), ...expectedByDate.keys()])) {
    const e = expectedByDate.get(date) ?? { patients: 0, doctors: 0 };
    const f = foundByDate.get(date) ?? { patients: 0, doctors: 0 };
    if (e.patients !== f.patients || e.doctors !== f.doctors) {
      out.push(
        `day ${date}: expected ${e.patients} patients / ${e.doctors} doctors, found ${f.patients} / ${f.doctors}`,
      );
    }
  }
  return out;
}
