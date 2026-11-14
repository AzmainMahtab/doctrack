import type { Document } from 'mongodb';
import { createContainer } from './container.ts';
import { buildDoctorFilter, doctorSort } from './modules/doctors/infrastructure/doctor-queries.ts';
import {
  buildPatientFilter,
  patientSort,
} from './modules/patients/infrastructure/patient-queries.ts';
import './register-indexes.ts';

interface Case {
  name: string;
  collection: 'doctors' | 'patients';
  filter: Document;
  sort: Record<string, 1 | -1>;
}

const hasStage = (node: unknown, stage: string): boolean => {
  if (!node || typeof node !== 'object') return false;
  const record = node as Record<string, unknown>;
  if (record.stage === stage) return true;
  return Object.values(record).some((value) =>
    Array.isArray(value) ? value.some((v) => hasStage(v, stage)) : hasStage(value, stage),
  );
};

async function main(): Promise<void> {
  const container = await createContainer('api');
  const { db } = container.mongo;
  const sampleDoctor = await db
    .collection('doctors')
    .findOne({}, { projection: { _id: 1, specialization: 1, hospital: 1 } });
  if (!sampleDoctor) throw new Error('No data; run `make seed-scale` first');

  const cases: Case[] = [
    {
      name: 'doctors default list',
      collection: 'doctors',
      filter: buildDoctorFilter({} as never),
      sort: doctorSort('-createdAt'),
    },
    {
      name: 'doctors search "dr amir"',
      collection: 'doctors',
      filter: buildDoctorFilter({ q: 'dr amir' } as never),
      sort: doctorSort('-createdAt'),
    },
    {
      name: 'doctors search + specialization',
      collection: 'doctors',
      filter: buildDoctorFilter({
        q: 'amir',
        specialization: sampleDoctor.specialization,
      } as never),
      sort: doctorSort('name'),
    },
    {
      name: 'doctors by hospital sorted by name',
      collection: 'doctors',
      filter: buildDoctorFilter({ hospital: sampleDoctor.hospital } as never),
      sort: doctorSort('name'),
    },
    {
      name: 'doctors by patient count',
      collection: 'doctors',
      filter: buildDoctorFilter({} as never),
      sort: doctorSort('-patientCount'),
    },
    {
      name: 'doctors created range',
      collection: 'doctors',
      filter: buildDoctorFilter({ from: '2026-06-01', to: '2026-08-31' } as never),
      sort: doctorSort('-createdAt'),
    },
    {
      name: 'patients default list',
      collection: 'patients',
      filter: buildPatientFilter({}),
      sort: patientSort('-createdAt'),
    },
    {
      name: 'patients search "amir"',
      collection: 'patients',
      filter: buildPatientFilter({ q: 'amir' }),
      sort: patientSort('-createdAt'),
    },
    {
      name: 'patients by condition',
      collection: 'patients',
      filter: buildPatientFilter({ condition: 'critical' }),
      sort: patientSort('-createdAt'),
    },
    {
      name: 'patients by doctor',
      collection: 'patients',
      filter: buildPatientFilter({ doctorId: sampleDoctor._id as unknown as string }),
      sort: patientSort('-createdAt'),
    },
    {
      name: 'patients doctor + condition',
      collection: 'patients',
      filter: buildPatientFilter({
        doctorId: sampleDoctor._id as unknown as string,
        condition: 'stable',
      }),
      sort: patientSort('name'),
    },
    {
      name: 'patients created range',
      collection: 'patients',
      filter: buildPatientFilter({ from: '2026-06-01', to: '2026-08-31' }),
      sort: patientSort('-createdAt'),
    },
    {
      name: 'patients sorted by admission',
      collection: 'patients',
      filter: buildPatientFilter({}),
      sort: patientSort('-admittedAt'),
    },
  ];

  let collscans = 0;
  console.log(
    'case'.padEnd(40),
    'plan'.padEnd(10),
    'keys'.padStart(8),
    'docs'.padStart(8),
    'ms'.padStart(6),
  );
  for (const c of cases) {
    const explain = (await db
      .collection(c.collection)
      .find(c.filter)
      .sort(c.sort)
      .limit(20)
      .explain('executionStats')) as Document;
    const scan = hasStage(explain.queryPlanner?.winningPlan, 'COLLSCAN');
    if (scan) collscans += 1;
    const stats = explain.executionStats as Document;
    console.log(
      c.name.padEnd(40),
      (scan ? 'COLLSCAN' : 'IXSCAN').padEnd(10),
      String(stats.totalKeysExamined).padStart(8),
      String(stats.totalDocsExamined).padStart(8),
      String(stats.executionTimeMillis).padStart(6),
    );
  }
  console.log(`\n${collscans} of ${cases.length} hot queries use COLLSCAN`);
  for (const closer of container.closers) await closer.close();
  if (collscans > 0) process.exit(2);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
