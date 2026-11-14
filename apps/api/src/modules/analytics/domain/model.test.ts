import { describe, expect, it } from 'vitest';
import { deltaFor, diffSnapshots, emptyConditions, normalize, type Snapshot } from './model.ts';

const snapshot = (over: Partial<Snapshot> = {}): Snapshot => ({
  doctors: 0,
  patients: 0,
  conditions: emptyConditions(),
  daily: [],
  ...over,
});

describe('deltaFor', () => {
  it('counts a registered doctor in the totals and on its day', () => {
    expect(
      deltaFor({ name: 'doctor.registered', payload: { registeredOn: '2026-11-14' } }),
    ).toEqual({
      doctors: 1,
      patients: 0,
      conditions: {},
      day: { date: '2026-11-14', patients: 0, doctors: 1 },
    });
  });

  it('counts a registered patient by condition and registration day', () => {
    expect(
      deltaFor({
        name: 'patient.registered',
        payload: { condition: 'critical', registeredOn: '2026-11-14' },
      }),
    ).toEqual({
      doctors: 0,
      patients: 1,
      conditions: { critical: 1 },
      day: { date: '2026-11-14', patients: 1, doctors: 0 },
    });
  });

  it('reverses a removed patient on the day it was registered, not today', () => {
    expect(
      deltaFor({
        name: 'patient.removed',
        payload: { condition: 'stable', registeredOn: '2026-10-01' },
      }),
    ).toEqual({
      doctors: 0,
      patients: -1,
      conditions: { stable: -1 },
      day: { date: '2026-10-01', patients: -1, doctors: 0 },
    });
  });

  it('moves a patient between conditions without touching totals or days', () => {
    expect(
      deltaFor({ name: 'patient.condition_changed', payload: { from: 'critical', to: 'stable' } }),
    ).toEqual({ doctors: 0, patients: 0, conditions: { critical: -1, stable: 1 }, day: null });
  });

  it('ignores unknown events and malformed payloads', () => {
    expect(deltaFor({ name: 'user.logged_in', payload: {} })).toBeNull();
    expect(
      deltaFor({
        name: 'patient.registered',
        payload: { condition: 'dead', registeredOn: '2026-11-14' },
      }),
    ).toBeNull();
    expect(
      deltaFor({
        name: 'patient.registered',
        payload: { condition: 'stable', registeredOn: 'yesterday' },
      }),
    ).toBeNull();
    expect(
      deltaFor({ name: 'patient.condition_changed', payload: { from: 'stable', to: 'stable' } }),
    ).toBeNull();
  });
});

describe('normalize', () => {
  it('clamps negatives, drops empty days and sorts', () => {
    const result = normalize(
      snapshot({
        patients: -2,
        conditions: { ...emptyConditions(), stable: -1 },
        daily: [
          { date: '2026-02-01', patients: 1, doctors: 0 },
          { date: '2026-01-01', patients: -3, doctors: 0 },
          { date: '2026-03-01', patients: 2, doctors: 1 },
        ],
      }),
    );
    expect(result.patients).toBe(0);
    expect(result.conditions.stable).toBe(0);
    expect(result.daily.map((d) => d.date)).toEqual(['2026-02-01', '2026-03-01']);
  });
});

describe('diffSnapshots', () => {
  const base = snapshot({
    doctors: 2,
    patients: 3,
    conditions: { ...emptyConditions(), stable: 3 },
    daily: [{ date: '2026-11-14', patients: 3, doctors: 2 }],
  });

  it('is empty for equal snapshots, ignoring empty days and order', () => {
    const other = snapshot({
      ...base,
      daily: [{ date: '2026-01-01', patients: 0, doctors: 0 }, ...base.daily],
    });
    expect(diffSnapshots(base, other)).toEqual([]);
  });

  it('names every difference', () => {
    const actual = snapshot({
      doctors: 1,
      patients: 3,
      conditions: { ...emptyConditions(), stable: 2, critical: 1 },
      daily: [{ date: '2026-11-13', patients: 3, doctors: 1 }],
    });
    const out = diffSnapshots(base, actual);
    expect(out).toContain('doctors: expected 2, found 1');
    expect(out).toContain('condition stable: expected 3, found 2');
    expect(out).toContain('condition critical: expected 0, found 1');
    expect(out.some((l) => l.startsWith('day 2026-11-14'))).toBe(true);
    expect(out.some((l) => l.startsWith('day 2026-11-13'))).toBe(true);
  });
});
