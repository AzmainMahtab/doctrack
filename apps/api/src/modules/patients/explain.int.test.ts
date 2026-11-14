import { randomBytes } from 'node:crypto';
import type {
  DoctorPatientListQuery,
  DoctorListQuery,
  PatientListQuery,
} from '@doctrack/contracts';
import type { Document } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildDoctorFilter, doctorSort } from '../doctors/index.ts';
import { createHarness, type Harness } from '../../platform/testing/harness.ts';
import { searchTokens, sortKey } from '../../shared/text/index.ts';
import { buildPatientFilter, patientSort } from './index.ts';

const DOCTORS = 2_000;
const PATIENTS = 20_000;
const SPECIALIZATIONS = ['Cardiology', 'Neurology', 'Pediatrics', 'Oncology', 'Dermatology'];
const HOSPITALS = ['St. Mary Hospital', 'City General', 'Lakeside Clinic', 'North Point Medical'];
const FIRST = [
  'John',
  'Maria',
  'Ahmed',
  'Zoe',
  'Carlos',
  'Beatrice',
  'Alice',
  'Omar',
  'Nina',
  'Lars',
];
const LAST = [
  'Carter',
  'Perez',
  'Khan',
  'Adams',
  'Vega',
  'Bloom',
  'Heart',
  'Stone',
  'Lee',
  'Hansen',
];
const CONDITIONS = ['stable', 'under_observation', 'critical', 'recovered'];
const DIAGNOSES = ['Hypertension', 'Migraine', 'Arrhythmia', 'Seizure', 'Diabetes'];

const pick = <T>(list: readonly T[], i: number): T => list[i % list.length] as T;

describe('query plans on a seeded dataset', () => {
  let h: Harness;
  const doctorIds: string[] = [];

  beforeAll(async () => {
    h = await createHarness();
    const base = Date.now() - 90 * 24 * 3600 * 1000;
    const doctors: Document[] = [];
    for (let i = 0; i < DOCTORS; i++) {
      const name = `${pick(FIRST, i)} ${pick(LAST, i * 7)} ${i}`;
      const specialization = pick(SPECIALIZATIONS, i);
      const hospital = pick(HOSPITALS, i * 3);
      const id = `d-${i}-${randomBytes(3).toString('hex')}`;
      doctorIds.push(id);
      const created = new Date(base + i * 3_600_000);
      doctors.push({
        _id: id,
        name,
        nameLower: sortKey(name),
        specialization,
        hospital,
        phone: '+14155550123',
        email: `${id}@example.com`,
        patientCount: i % 50,
        isActive: true,
        searchTokens: searchTokens(name, specialization, hospital),
        createdAt: created,
        updatedAt: created,
      });
    }
    await h.mongo.db.collection('doctors').insertMany(doctors);

    for (let start = 0; start < PATIENTS; start += 5_000) {
      const patients: Document[] = [];
      for (let i = start; i < Math.min(start + 5_000, PATIENTS); i++) {
        const name = `${pick(FIRST, i)} ${pick(LAST, i * 3)} ${i}`;
        const diagnosis = pick(DIAGNOSES, i);
        const created = new Date(base + i * 400_000);
        patients.push({
          _id: `p-${i}`,
          doctorId: pick(doctorIds, i),
          doctorName: 'Seed Doctor',
          name,
          nameLower: sortKey(name),
          dateOfBirth: new Date('1980-01-01T00:00:00Z'),
          gender: 'other',
          phone: '+14155550199',
          email: `p${i}@example.com`,
          condition: pick(CONDITIONS, i),
          diagnosis,
          admittedAt: created,
          searchTokens: searchTokens(name, diagnosis),
          createdAt: created,
          updatedAt: created,
        });
      }
      await h.mongo.db.collection('patients').insertMany(patients);
    }
  }, 120_000);

  afterAll(async () => {
    await h.close();
  });

  const hasCollScan = (plan: unknown): boolean => JSON.stringify(plan).includes('COLLSCAN');

  async function assertIndexed(
    collection: string,
    filter: Document,
    sort: Record<string, 1 | -1>,
    label: string,
  ) {
    const col = h.mongo.db.collection(collection);
    const page = await col.find(filter).sort(sort).skip(20).limit(20).explain('executionStats');
    expect(hasCollScan(page.queryPlanner.winningPlan), `${label}: page`).toBe(false);
    if (Object.keys(filter).length > 0) {
      const count = await col
        .aggregate([{ $match: filter }, { $count: 'n' }])
        .explain('queryPlanner');
      expect(hasCollScan(JSON.stringify(count)), `${label}: count`).toBe(false);
    }
  }

  const dq = (over: Partial<DoctorListQuery>): DoctorListQuery => ({
    page: 1,
    limit: 20,
    sort: '-createdAt',
    ...over,
  });
  const pq = (over: Partial<PatientListQuery>): PatientListQuery => ({
    page: 1,
    limit: 20,
    sort: '-createdAt',
    ...over,
  });

  it('serves every doctor list shape from an index', async () => {
    const day = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const shapes: [string, Partial<DoctorListQuery>][] = [
      ['default', {}],
      ['search', { q: 'car' }],
      ['two-word search', { q: 'john ca' }],
      ['specialization', { specialization: 'Cardiology' }],
      ['hospital by name', { hospital: 'City General', sort: 'name' }],
      ['specialization + search', { specialization: 'Neurology', q: 'mar' }],
      ['date range', { from: day, sort: 'createdAt' }],
      ['patient count ranking', { sort: '-patientCount' }],
      ['name descending', { sort: '-name' }],
    ];
    for (const [label, over] of shapes) {
      const query = dq(over);
      await assertIndexed(
        'doctors',
        buildDoctorFilter(query),
        doctorSort(query.sort),
        `doctors ${label}`,
      );
    }
  });

  it('serves every patient list shape from an index', async () => {
    const day = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const doctorId = doctorIds[7] as string;
    const shapes: [string, Partial<PatientListQuery>][] = [
      ['default', {}],
      ['condition', { condition: 'critical' }],
      ['search name', { q: 'joh' }],
      ['search diagnosis', { q: 'hyper' }],
      ['search + condition', { q: 'mar', condition: 'stable' }],
      ['doctor', { doctorId }],
      ['doctor + condition', { doctorId, condition: 'critical' }],
      ['date range', { from: day, sort: 'createdAt' }],
      ['name sort', { sort: 'name' }],
      ['admitted sort', { sort: '-admittedAt' }],
    ];
    for (const [label, over] of shapes) {
      const query = pq(over);
      await assertIndexed(
        'patients',
        buildPatientFilter(query),
        patientSort(query.sort),
        `patients ${label}`,
      );
    }
    const scoped: DoctorPatientListQuery = {
      page: 1,
      limit: 20,
      sort: '-createdAt',
      condition: 'stable',
    };
    await assertIndexed(
      'patients',
      buildPatientFilter({ ...scoped, doctorId }),
      patientSort(scoped.sort),
      'doctor patients',
    );
  });

  it('answers a filtered, searched page quickly on the seeded set', async () => {
    const col = h.mongo.db.collection('patients');
    const query = pq({ q: 'joh', condition: 'stable' });
    const started = Date.now();
    await col
      .find(buildPatientFilter(query))
      .sort(patientSort(query.sort))
      .skip(0)
      .limit(20)
      .toArray();
    await col.countDocuments(buildPatientFilter(query));
    expect(Date.now() - started).toBeLessThan(300);
  });
});
