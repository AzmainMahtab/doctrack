import { v7 as uuidv7 } from 'uuid';
import { createContainer } from './container.ts';
import { ensureIndexes } from './platform/database/index.ts';
import { searchTokens, sortKey } from './shared/text/index.ts';
import './register-indexes.ts';

const flag = (name: string, fallback: number): number => {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? Number(arg.split('=')[1]) : fallback;
};

const DOCTORS = flag('doctors', 10_000);
const PATIENTS = flag('patients', 100_000);
const CHUNK = 5_000;
const DAY = 86_400_000;
const MARK = '@scale.example';

const SPECIALIZATIONS = [
  'Cardiology',
  'Neurology',
  'Pediatrics',
  'Oncology',
  'Orthopedics',
  'Dermatology',
  'Radiology',
  'Psychiatry',
  'Endocrinology',
  'Gastroenterology',
  'Nephrology',
  'Urology',
];
const HOSPITALS = [
  'St Mary General',
  'Riverside Medical Centre',
  'Northgate Clinic',
  'Harbour University Hospital',
  'Greenfield Health',
  'Lakeside Regional',
  'Mercy Heights',
  'Crestview Hospital',
  'Union Memorial',
  'Westbrook Care',
];
const FIRST = [
  'Amir',
  'Nadia',
  'Lucas',
  'Priya',
  'Omar',
  'Elena',
  'Tariq',
  'Mei',
  'Jonas',
  'Aisha',
  'Mateo',
  'Sana',
];
const LAST = [
  'Rahman',
  'Okafor',
  'Lindgren',
  'Sharma',
  'Haddad',
  'Moreau',
  'Kowalski',
  'Tanaka',
  'Silva',
  'Novak',
  'Hossain',
  'Reyes',
];
const CONDITIONS = ['stable', 'under_observation', 'critical', 'recovered'] as const;
const GENDERS = ['female', 'male', 'other'] as const;
const DIAGNOSES = [
  'Hypertension',
  'Migraine',
  'Fracture',
  'Asthma',
  'Diabetes',
  'Anaemia',
  'Arrhythmia',
  'Dermatitis',
];

const pick = <T>(list: readonly T[], i: number): T => list[i % list.length] as T;
const spread = (i: number, span: number): Date => {
  const u = ((Math.imul(i + 1, 2654435761) >>> 0) % 10_007) / 10_007;
  return new Date(Date.now() - Math.floor(span * u ** 1.7) * DAY - ((i * 7919) % DAY));
};

async function main(): Promise<void> {
  const container = await createContainer('api');
  const { db } = container.mongo;
  await ensureIndexes(db);
  const doctors = db.collection('doctors');
  const patients = db.collection('patients');

  const existing = await doctors.countDocuments({ email: { $regex: `${MARK}$` } }, { limit: 1 });
  if (existing > 0) {
    console.log('scale data already present; remove it with `make seed-scale RESET=1`');
    if (!process.argv.includes('--reset')) {
      for (const closer of container.closers) await closer.close();
      return;
    }
    await patients.deleteMany({ email: { $regex: `${MARK}$` } });
    await doctors.deleteMany({ email: { $regex: `${MARK}$` } });
  }

  const doctorIds: string[] = [];
  const doctorNames: string[] = [];
  const counts = new Map<string, number>();
  for (let start = 0; start < DOCTORS; start += CHUNK) {
    const docs = [];
    for (let i = start; i < Math.min(start + CHUNK, DOCTORS); i++) {
      const id = uuidv7();
      const name = `Dr ${pick(FIRST, i)} ${pick(LAST, Math.floor(i / FIRST.length))} ${i}`;
      const specialization = pick(SPECIALIZATIONS, i * 5);
      const hospital = pick(HOSPITALS, i * 3);
      const createdAt = spread(i, 365);
      doctorIds.push(id);
      doctorNames.push(name);
      docs.push({
        _id: id,
        name,
        nameLower: sortKey(name),
        specialization,
        hospital,
        phone: `+1415555${String(1000 + (i % 9000))}`,
        email: `doctor${i}${MARK}`,
        patientCount: 0,
        isActive: true,
        searchTokens: searchTokens(name, specialization, hospital),
        createdAt,
        updatedAt: createdAt,
      });
    }
    await doctors.insertMany(docs as never[], { ordered: false });
  }

  for (let start = 0; start < PATIENTS; start += CHUNK) {
    const docs = [];
    for (let i = start; i < Math.min(start + CHUNK, PATIENTS); i++) {
      const d = (i * 2654435761) % DOCTORS;
      const doctorId = doctorIds[d] as string;
      counts.set(doctorId, (counts.get(doctorId) ?? 0) + 1);
      const name = `${pick(FIRST, i * 7)} ${pick(LAST, i * 11)} ${i}`;
      const diagnosis = pick(DIAGNOSES, i);
      const createdAt = spread(i, 365);
      docs.push({
        _id: uuidv7(),
        doctorId,
        doctorName: doctorNames[d] as string,
        name,
        nameLower: sortKey(name),
        dateOfBirth: new Date(Date.UTC(1940 + (i % 70), i % 12, 1 + (i % 27))),
        gender: pick(GENDERS, i),
        phone: `+1415556${String(1000 + (i % 9000))}`,
        email: `patient${i}${MARK}`,
        condition: pick(CONDITIONS, i * 3),
        diagnosis,
        admittedAt: createdAt,
        searchTokens: searchTokens(name, diagnosis),
        createdAt,
        updatedAt: createdAt,
      });
    }
    await patients.insertMany(docs as never[], { ordered: false });
  }

  const ops = [...counts].map(([id, patientCount]) => ({
    updateOne: { filter: { _id: id }, update: { $set: { patientCount } } },
  }));
  for (let i = 0; i < ops.length; i += CHUNK) {
    await doctors.bulkWrite(ops.slice(i, i + CHUNK) as never[], { ordered: false });
  }

  console.log(`inserted ${DOCTORS} doctors and ${PATIENTS} patients`);
  for (const closer of container.closers) await closer.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
