import { v7 as uuidv7 } from 'uuid';
import { createContainer } from './container.ts';
import { ensureIndexes } from './platform/database/index.ts';
import { searchTokens, sortKey } from './shared/text/index.ts';
import './register-indexes.ts';

const DOCTOR_MARK = '@clinic.example';
const PATIENT_MARK = '@mail.example';
const DAY = 86_400_000;
const PATIENTS = 320;

interface DoctorSeed {
  name: string;
  specialization: string;
  hospital: string;
}

const HOSPITALS = [
  'St Mary General',
  'Riverside Medical Centre',
  'Northgate Clinic',
  'Harbour University Hospital',
  'Lakeside Regional',
];

const DOCTORS: DoctorSeed[] = [
  ['Dr Amelia Hartwell', 'Cardiology', 0],
  ['Dr Rohan Mehta', 'Cardiology', 3],
  ['Dr Lucia Fernandez', 'Cardiology', 1],
  ['Dr Samuel Okafor', 'Neurology', 0],
  ['Dr Ingrid Lindqvist', 'Neurology', 4],
  ['Dr Priya Nair', 'Pediatrics', 2],
  ['Dr Tomas Novak', 'Pediatrics', 0],
  ['Dr Hannah Brooks', 'Pediatrics', 3],
  ['Dr Kwame Mensah', 'Oncology', 3],
  ['Dr Elena Petrova', 'Oncology', 1],
  ['Dr Daniel Reyes', 'Orthopedics', 2],
  ['Dr Mei Tanaka', 'Orthopedics', 4],
  ['Dr Omar Haddad', 'Orthopedics', 0],
  ['Dr Sofia Marchetti', 'Dermatology', 1],
  ['Dr Jonas Eriksen', 'Dermatology', 4],
  ['Dr Aisha Rahman', 'Psychiatry', 2],
  ['Dr Peter Walsh', 'Psychiatry', 3],
  ['Dr Nadia Cohen', 'Endocrinology', 1],
  ['Dr Victor Alves', 'Endocrinology', 0],
  ['Dr Grace Kim', 'Gastroenterology', 4],
  ['Dr Mateo Silva', 'Gastroenterology', 2],
  ['Dr Fatima Zahra', 'Pulmonology', 3],
  ['Dr Henry Fischer', 'Pulmonology', 1],
  ['Dr Leila Hosseini', 'Pulmonology', 0],
].map(([name, specialization, hospital]) => ({
  name: name as string,
  specialization: specialization as string,
  hospital: HOSPITALS[hospital as number] as string,
}));

const DIAGNOSES: Record<string, string[]> = {
  Cardiology: ['Hypertension', 'Atrial fibrillation', 'Heart failure', 'Angina', 'Arrhythmia'],
  Neurology: ['Migraine', 'Epilepsy', 'Parkinsonism', 'Neuropathy', 'Concussion'],
  Pediatrics: ['Asthma', 'Ear infection', 'Bronchiolitis', 'Eczema', 'Growth monitoring'],
  Oncology: ['Breast cancer follow-up', 'Lymphoma', 'Colorectal cancer', 'Chemotherapy review'],
  Orthopedics: ['Fracture of the wrist', 'Knee replacement', 'Lumbar strain', 'Rotator cuff tear'],
  Dermatology: ['Psoriasis', 'Dermatitis', 'Acne', 'Skin lesion review'],
  Psychiatry: ['Anxiety disorder', 'Depression', 'Insomnia', 'Bipolar disorder'],
  Endocrinology: ['Type 2 diabetes', 'Hypothyroidism', 'Type 1 diabetes', 'Metabolic review'],
  Gastroenterology: ['Reflux disease', 'Crohn disease', 'Gallstones', 'Irritable bowel'],
  Pulmonology: ['COPD', 'Asthma', 'Pneumonia recovery', 'Sleep apnoea'],
};

const FIRST = [
  'Alice',
  'Ben',
  'Carla',
  'David',
  'Elif',
  'Farid',
  'Grace',
  'Hugo',
  'Ines',
  'Jamal',
  'Keiko',
  'Liam',
  'Maya',
  'Noah',
  'Olivia',
  'Pavel',
  'Quinn',
  'Rosa',
  'Stefan',
  'Tara',
  'Umar',
  'Vera',
  'Wei',
  'Ximena',
  'Yusuf',
  'Zoe',
  'Aaron',
  'Bianca',
  'Callum',
  'Dina',
  'Emre',
  'Freya',
  'Gustavo',
  'Hana',
  'Isaac',
  'Jada',
  'Kofi',
  'Lena',
  'Marcus',
  'Nia',
];
const LAST = [
  'Abbott',
  'Bianchi',
  'Chen',
  'Dubois',
  'Evans',
  'Farouk',
  'Garcia',
  'Hansen',
  'Ibrahim',
  'Jensen',
  'Khan',
  'Lopez',
  'Murphy',
  'Nguyen',
  'Ortiz',
  'Patel',
  'Quinn',
  'Rossi',
  'Schmidt',
  'Tanaka',
  'Usman',
  'Vasquez',
  'Walker',
  'Yamamoto',
  'Zielinski',
  'Adeyemi',
  'Becker',
  'Costa',
  'Dimitrov',
  'Eriksson',
];
const GENDERS = ['female', 'male', 'other'] as const;

const prng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pickWeighted = <T>(items: readonly T[], weights: readonly number[], r: number): T => {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i] as number;
    if (x < 0) return items[i] as T;
  }
  return items[items.length - 1] as T;
};

const businessMoment = (daysAgo: number, r: () => number): Date => {
  let d = daysAgo;
  const base = new Date(Date.now() - d * DAY);
  while ([0, 6].includes(base.getUTCDay()) && r() < 0.75) {
    d += 1;
    base.setTime(Date.now() - d * DAY);
  }
  base.setUTCHours(8 + Math.floor(r() * 9), Math.floor(r() * 60), 0, 0);
  return base;
};

async function main(): Promise<void> {
  const container = await createContainer('api');
  const { db } = container.mongo;
  await ensureIndexes(db);
  const doctors = db.collection('doctors');
  const patients = db.collection('patients');

  const present = await doctors.countDocuments(
    { email: { $regex: `${DOCTOR_MARK}$` } },
    { limit: 1 },
  );
  if (present > 0 && !process.argv.includes('--reset')) {
    console.log('demo data already present; run `make seed-demo RESET=1` to replace it');
    for (const closer of container.closers) await closer.close();
    return;
  }
  if (present > 0) {
    await patients.deleteMany({ email: { $regex: `${PATIENT_MARK}$` } });
    await doctors.deleteMany({ email: { $regex: `${DOCTOR_MARK}$` } });
  }

  const r = prng(20261114);
  const doctorDocs = DOCTORS.map((d, i) => {
    const registered = businessMoment(60 + Math.floor(r() * 90), r);
    const [first, ...rest] = d.name.replace(/^Dr /, '').split(' ');
    return {
      _id: uuidv7(),
      name: d.name,
      nameLower: sortKey(d.name),
      specialization: d.specialization,
      hospital: d.hospital,
      phone: `+1415555${String(100 + i).padStart(4, '0')}`,
      email: `${(first ?? '').toLowerCase()}.${rest.join('').toLowerCase()}${DOCTOR_MARK}`,
      patientCount: 0,
      isActive: true,
      searchTokens: searchTokens(d.name, d.specialization, d.hospital),
      createdAt: registered,
      updatedAt: registered,
    };
  });
  await doctors.insertMany(doctorDocs as never[], { ordered: false });

  const load = doctorDocs.map(() => 0.4 + r() * 2.6);
  const counts = new Map<string, number>();
  const patientDocs = [];
  for (let i = 0; i < PATIENTS; i++) {
    const doctor = pickWeighted(doctorDocs, load, r());
    const maxAge = Math.floor((Date.now() - doctor.createdAt.getTime()) / DAY);
    const daysAgo = Math.min(Math.floor(90 * r() ** 1.5), maxAge);
    const createdAt = businessMoment(daysAgo, r);
    const condition = pickWeighted(
      ['stable', 'under_observation', 'critical', 'recovered'] as const,
      daysAgo < 10 ? [30, 45, 20, 5] : daysAgo < 40 ? [45, 25, 10, 20] : [40, 5, 3, 52],
      r(),
    );
    const first = FIRST[Math.floor(r() * FIRST.length)] as string;
    const last = LAST[Math.floor(r() * LAST.length)] as string;
    const name = `${first} ${last}`;
    const diagnoses = DIAGNOSES[doctor.specialization] ?? ['General review'];
    const diagnosis = diagnoses[Math.floor(r() * diagnoses.length)] as string;
    const age =
      doctor.specialization === 'Pediatrics' ? Math.floor(r() * 16) : 18 + Math.floor(r() * 72);
    const dob = new Date(
      Date.UTC(new Date().getUTCFullYear() - age, Math.floor(r() * 12), 1 + Math.floor(r() * 27)),
    );
    counts.set(doctor._id, (counts.get(doctor._id) ?? 0) + 1);
    patientDocs.push({
      _id: uuidv7(),
      doctorId: doctor._id,
      doctorName: doctor.name,
      name,
      nameLower: sortKey(name),
      dateOfBirth: dob,
      gender: GENDERS[Math.floor(r() * GENDERS.length)],
      phone: `+1415556${String(100 + (i % 100)).padStart(4, '0')}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}${PATIENT_MARK}`,
      condition,
      diagnosis,
      admittedAt: createdAt,
      searchTokens: searchTokens(name, diagnosis),
      createdAt,
      updatedAt: createdAt,
    });
  }
  await patients.insertMany(patientDocs as never[], { ordered: false });
  await doctors.bulkWrite(
    [...counts].map(([id, patientCount]) => ({
      updateOne: { filter: { _id: id }, update: { $set: { patientCount } } },
    })) as never[],
    { ordered: false },
  );

  console.log(`inserted ${doctorDocs.length} doctors and ${patientDocs.length} patients`);
  for (const closer of container.closers) await closer.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
