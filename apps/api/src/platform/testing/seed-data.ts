import type { Db, Document } from 'mongodb';

const CONDITIONS = ['stable', 'under_observation', 'critical', 'recovered'] as const;

export const dayOffset = (offsetDays: number): Date =>
  new Date(Date.UTC(2026, 0, 1) + offsetDays * 86_400_000 + 3_600_000);

export function doctorDoc(i: number, over: Partial<Document> = {}): Document {
  const created = over.createdAt ?? dayOffset(i % 300);
  return {
    _id: `seed-doctor-${i}`,
    name: `Seed Doctor ${i}`,
    nameLower: `seed doctor ${i}`,
    specialization: 'Seeding',
    hospital: 'Seed Hospital',
    phone: '+14155550123',
    email: `seed-doctor-${i}@example.com`,
    patientCount: 0,
    isActive: true,
    searchTokens: ['seed', 'doctor', String(i)],
    createdAt: created,
    updatedAt: created,
    ...over,
  };
}

export function patientDoc(i: number, doctorId: string, over: Partial<Document> = {}): Document {
  const created = over.createdAt ?? dayOffset(i % 300);
  return {
    _id: `seed-patient-${i}`,
    doctorId,
    doctorName: 'Seed Doctor',
    name: `Seed Patient ${i}`,
    nameLower: `seed patient ${i}`,
    dateOfBirth: new Date('1980-01-01T00:00:00Z'),
    gender: 'other',
    phone: '+14155550199',
    email: `seed-patient-${i}@example.com`,
    condition: CONDITIONS[i % CONDITIONS.length],
    diagnosis: 'Seeded',
    admittedAt: created,
    searchTokens: ['seed', 'patient', String(i)],
    createdAt: created,
    updatedAt: created,
    ...over,
  };
}

export async function insertInChunks(
  db: Db,
  collection: string,
  docs: Document[],
  size = 10_000,
): Promise<void> {
  for (let i = 0; i < docs.length; i += size) {
    await db.collection(collection).insertMany(docs.slice(i, i + size));
  }
}
