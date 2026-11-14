import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from '../../platform/testing/harness.ts';
import { setupDomain, type Actors } from '../../platform/testing/dashboard-setup.ts';
import { API } from '../../platform/testing/http-helpers.ts';
import { doctorDoc, insertInChunks, patientDoc } from '../../platform/testing/seed-data.ts';

const DOCTORS = 1_000;
const PATIENTS = 100_000;
const CALLS = 40;

const p95 = (samples: number[]): number => {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
};

describe('dashboard latency on 100,000 patients', () => {
  let h: Harness;
  let a: Actors;

  beforeAll(async () => {
    h = await createHarness();
    a = await setupDomain(h);
    await insertInChunks(
      h.mongo.db,
      'doctors',
      Array.from({ length: DOCTORS }, (_, i) => doctorDoc(i, { patientCount: i % 97 })),
    );
    await insertInChunks(
      h.mongo.db,
      'patients',
      Array.from({ length: PATIENTS }, (_, i) => patientDoc(i, `seed-doctor-${i % DOCTORS}`)),
    );
    await a.built.analytics.reconcile.rebuild();
  }, 240_000);

  afterAll(async () => {
    await h.close();
  });

  it('builds a projection that matches the source', async () => {
    expect((await a.built.analytics.reconcile.verify()).consistent).toBe(true);
    const summary = (await a.viewer.get(`${API}/dashboard/summary`)).body.data;
    expect(summary).toMatchObject({ doctors: DOCTORS, patients: PATIENTS });
  });

  it('answers every dashboard endpoint with a p95 under 200 ms', async () => {
    const endpoints = [
      'summary',
      'conditions',
      'patients-per-doctor',
      'timeseries?window=90',
      'timeseries?interval=week&from=2026-01-01&to=2026-10-27',
    ];
    for (const endpoint of endpoints) {
      const samples: number[] = [];
      for (let i = 0; i < CALLS; i++) {
        if (i % 4 === 0) await a.built.analytics.cache.invalidate();
        const started = performance.now();
        const res = await a.viewer.get(`${API}/dashboard/${endpoint}`);
        samples.push(performance.now() - started);
        expect(res.status).toBe(200);
      }
      expect(p95(samples), `${endpoint} p95`).toBeLessThan(200);
    }
  });

  it('answers cold (uncached) reads under 200 ms as well', async () => {
    const samples: number[] = [];
    for (let i = 0; i < CALLS; i++) {
      await a.built.analytics.cache.invalidate();
      const started = performance.now();
      await a.viewer.get(`${API}/dashboard/patients-per-doctor`);
      samples.push(performance.now() - started);
    }
    expect(p95(samples)).toBeLessThan(200);
  });
});
