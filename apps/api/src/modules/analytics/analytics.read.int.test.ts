import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from '../../platform/testing/harness.ts';
import { setupDomain, type Actors } from '../../platform/testing/dashboard-setup.ts';
import { API } from '../../platform/testing/http-helpers.ts';
import { dayOffset, doctorDoc, patientDoc } from '../../platform/testing/seed-data.ts';

describe('dashboard read endpoints and rebuild', () => {
  let h: Harness;
  let a: Actors;

  const dashboard = (path: string) => a.viewer.get(`${API}/dashboard/${path}`);
  const clearProjection = async () => {
    await h.mongo.db.collection('analytics_totals').deleteMany({});
    await h.mongo.db.collection('analytics_daily').deleteMany({});
    await a.built.analytics.cache.invalidate();
  };
  const clearSources = async () => {
    await h.mongo.db.collection('doctors').deleteMany({});
    await h.mongo.db.collection('patients').deleteMany({});
  };

  beforeAll(async () => {
    h = await createHarness();
    a = await setupDomain(h);
  });
  afterAll(async () => {
    await h.close();
  });

  describe('empty projection', () => {
    it('returns zeros with no update time', async () => {
      await clearProjection();
      const summary = await dashboard('summary');
      expect(summary.status).toBe(200);
      expect(summary.body.data).toEqual({ doctors: 0, patients: 0, updatedAt: null });
      expect((await dashboard('conditions')).body.data).toEqual({
        counts: { stable: 0, under_observation: 0, critical: 0, recovered: 0 },
        total: 0,
      });
      const series = (await dashboard('timeseries')).body.data;
      expect(series.points).toHaveLength(30);
      expect(series.points.every((p: { count: number }) => p.count === 0)).toBe(true);
    });
  });

  describe('timeseries', () => {
    beforeAll(async () => {
      await clearProjection();
      await h.mongo.db.collection('analytics_daily').insertMany([
        { _id: '2026-01-05' as never, patients: 3, doctors: 0 },
        { _id: '2026-01-07' as never, patients: 2, doctors: 1 },
        { _id: '2026-01-12' as never, patients: 4, doctors: 0 },
        { _id: '2026-02-03' as never, patients: 1, doctors: 2 },
      ]);
      await a.built.analytics.cache.invalidate();
    });

    it('returns exactly one point per day for the default and the other windows', async () => {
      for (const [window, count] of [
        [undefined, 30],
        [7, 7],
        [30, 30],
        [90, 90],
      ] as const) {
        const res = await dashboard(`timeseries${window ? `?window=${window}` : ''}`);
        expect(res.status).toBe(200);
        expect(res.body.data.points).toHaveLength(count);
        expect(res.body.data.interval).toBe('day');
      }
    });

    it('fills gaps with zeros for a custom range', async () => {
      const res = await dashboard('timeseries?from=2026-01-05&to=2026-01-09');
      expect(res.body.data.points).toEqual([
        { date: '2026-01-05', count: 3 },
        { date: '2026-01-06', count: 0 },
        { date: '2026-01-07', count: 2 },
        { date: '2026-01-08', count: 0 },
        { date: '2026-01-09', count: 0 },
      ]);
    });

    it('groups by week and by month, and reads the doctors counter', async () => {
      const week = await dashboard('timeseries?interval=week&from=2026-01-05&to=2026-01-18');
      expect(week.body.data.points).toEqual([
        { date: '2026-01-05', count: 5 },
        { date: '2026-01-12', count: 4 },
      ]);
      const month = await dashboard('timeseries?interval=month&from=2026-01-01&to=2026-02-28');
      expect(month.body.data.points).toEqual([
        { date: '2026-01-01', count: 9 },
        { date: '2026-02-01', count: 1 },
      ]);
      const doctors = await dashboard(
        'timeseries?entity=doctors&interval=month&from=2026-01-01&to=2026-02-28',
      );
      expect(doctors.body.data.points).toEqual([
        { date: '2026-01-01', count: 1 },
        { date: '2026-02-01', count: 2 },
      ]);
    });

    it('rejects invalid ranges and windows', async () => {
      for (const query of [
        'from=2026-01-01&to=2027-01-02',
        'from=2026-02-01&to=2026-01-01',
        'from=2026-01-01',
        'window=15',
        'window=7&from=2026-01-01&to=2026-01-05',
        'interval=year',
        'entity=nurses',
      ]) {
        const res = await dashboard(`timeseries?${query}`);
        expect(res.status, query).toBe(422);
        expect(res.body.code).toBe('VALIDATION_FAILED');
      }
      expect((await dashboard('timeseries?from=2026-01-01&to=2026-12-31')).status).toBe(200);
    });
  });

  describe('patients per doctor', () => {
    it('ranks doctors, caps the list and shows only existing doctors when there are few', async () => {
      await clearSources();
      await h.mongo.db
        .collection('doctors')
        .insertMany(Array.from({ length: 15 }, (_, i) => doctorDoc(i, { patientCount: i })));
      await a.built.analytics.cache.invalidate();

      const top = (await dashboard('patients-per-doctor')).body.data;
      expect(top).toHaveLength(10);
      expect(top.map((r: { patientCount: number }) => r.patientCount)).toEqual([
        14, 13, 12, 11, 10, 9, 8, 7, 6, 5,
      ]);
      expect(top[0]).toEqual({
        doctorId: 'seed-doctor-14',
        name: 'Seed Doctor 14',
        patientCount: 14,
      });

      expect((await dashboard('patients-per-doctor?limit=3')).body.data).toHaveLength(3);
      expect((await dashboard('patients-per-doctor?limit=21')).status).toBe(422);

      await h.mongo.db.collection('doctors').deleteMany({ patientCount: { $gte: 4 } });
      await a.built.analytics.cache.invalidate();
      expect((await dashboard('patients-per-doctor')).body.data).toHaveLength(4);
    });
  });

  describe('permissions', () => {
    const paths = ['summary', 'patients-per-doctor', 'timeseries', 'conditions'];

    it('lets a viewer read every dashboard endpoint and blocks anonymous callers', async () => {
      for (const path of paths) {
        expect((await a.viewer.get(`${API}/dashboard/${path}`)).status, path).toBe(200);
        expect((await a.admin.get(`${API}/dashboard/${path}`)).status, path).toBe(200);
        const anon = await a.anonymous.get(`${API}/dashboard/${path}`);
        expect(anon.status, path).toBe(401);
      }
    });
  });

  describe('rebuild', () => {
    const seed = async () => {
      await clearSources();
      await clearProjection();
      await h.mongo.db
        .collection('doctors')
        .insertMany([
          doctorDoc(1, { createdAt: dayOffset(0) }),
          doctorDoc(2, { createdAt: dayOffset(0) }),
          doctorDoc(3, { createdAt: dayOffset(10) }),
        ]);
      await h.mongo.db
        .collection('patients')
        .insertMany(
          Array.from({ length: 7 }, (_, i) =>
            patientDoc(i, 'seed-doctor-1', { createdAt: dayOffset(i < 4 ? 0 : 5) }),
          ),
        );
    };

    it('reports drift, repairs it, and reproduces identical numbers on a second run', async () => {
      await seed();
      const before = await a.built.analytics.reconcile.verify();
      expect(before.consistent).toBe(false);
      expect(before.differences).toContain('doctors: expected 3, found 0');
      expect(before.differences).toContain('patients: expected 7, found 0');

      const repaired = await a.built.analytics.reconcile.rebuild();
      expect(repaired.consistent).toBe(false);
      expect((await a.built.analytics.reconcile.verify()).consistent).toBe(true);

      const first = await h.mongo.db
        .collection('analytics_daily')
        .find({})
        .sort({ _id: 1 })
        .toArray();
      const firstTotals = await h.mongo.db.collection('analytics_totals').findOne({});
      const again = await a.built.analytics.reconcile.rebuild();
      expect(again).toEqual({ consistent: true, differences: [] });
      expect(
        await h.mongo.db.collection('analytics_daily').find({}).sort({ _id: 1 }).toArray(),
      ).toEqual(first);
      const secondTotals = await h.mongo.db.collection('analytics_totals').findOne({});
      expect({ ...secondTotals, updatedAt: 0 }).toEqual({ ...firstTotals, updatedAt: 0 });

      expect(first).toEqual([
        { _id: '2026-01-01', patients: 4, doctors: 2 },
        { _id: '2026-01-06', patients: 3, doctors: 0 },
        { _id: '2026-01-11', patients: 0, doctors: 1 },
      ]);
      expect(firstTotals).toMatchObject({
        doctors: 3,
        patients: 7,
        conditions: { stable: 2, under_observation: 2, critical: 2, recovered: 1 },
      });
    });

    it('moves a deleted patient out of the day it was registered', async () => {
      await h.mongo.db.collection('patients').deleteOne({ _id: 'seed-patient-5' as never });
      expect((await a.built.analytics.reconcile.verify()).consistent).toBe(false);
      await a.built.analytics.reconcile.rebuild();
      const day = await h.mongo.db
        .collection('analytics_daily')
        .findOne({ _id: '2026-01-06' as never });
      expect(day).toMatchObject({ patients: 2 });
      const all = await a.built.analytics.reconcile.verify();
      expect(all.consistent).toBe(true);
      const sum = (await h.mongo.db.collection('analytics_daily').find({}).toArray()).reduce(
        (n, d) => n + d.patients,
        0,
      );
      expect(sum).toBe(6);
    });

    it('serves fresh numbers after a rebuild invalidates the cache', async () => {
      await a.built.analytics.cache.invalidate();
      const summary = await dashboard('summary');
      expect(summary.body.data).toMatchObject({ doctors: 3, patients: 6 });
    });
  });

  describe('documentation', () => {
    it('documents the four dashboard routes with their permission', () => {
      const doc = a.built.document as unknown as {
        paths: Record<string, Record<string, { description?: string }>>;
      };
      for (const path of ['summary', 'patients-per-doctor', 'timeseries', 'conditions']) {
        const op = doc.paths[`/api/v1/dashboard/${path}`]?.get;
        expect(op, path).toBeDefined();
        expect(op?.description).toContain('Permission: `dashboard:read`');
      }
    });
  });
});
