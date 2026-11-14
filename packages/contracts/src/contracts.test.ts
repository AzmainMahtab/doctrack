import { describe, expect, it } from 'vitest';
import {
  CreateDoctorSchema,
  CreatePatientSchema,
  DoctorListQuerySchema,
  PatientListQuerySchema,
  PatientsPerDoctorQuerySchema,
  TimeseriesQuerySchema,
  UpdatePatientSchema,
} from './index.ts';

const patient = {
  name: 'John Carter',
  dateOfBirth: '1985-03-21',
  gender: 'male',
  phone: '+14155550199',
  email: 'john@example.com',
  condition: 'stable',
  admittedAt: '2026-11-01T09:30:00.000Z',
};

const fields = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((i) => i.path.join('.')).sort() ?? [];

describe('CreateDoctorSchema', () => {
  const ok = {
    name: 'Alice Heart',
    specialization: 'Cardiology',
    hospital: 'St. Mary Hospital',
    phone: '+14155550123',
    email: 'alice@example.com',
  };

  it('accepts a valid doctor', () => {
    expect(CreateDoctorSchema.safeParse(ok).success).toBe(true);
  });

  it('requires E.164 phone numbers', () => {
    for (const phone of ['4155550123', '+0123456789', '+1', '+1415555012345678', 'phone']) {
      expect(fields(CreateDoctorSchema.safeParse({ ...ok, phone }))).toEqual(['phone']);
    }
  });

  it('trims names and enforces length limits', () => {
    expect(CreateDoctorSchema.parse({ ...ok, name: '  Alice Heart  ' }).name).toBe('Alice Heart');
    expect(fields(CreateDoctorSchema.safeParse({ ...ok, name: 'A' }))).toEqual(['name']);
    expect(fields(CreateDoctorSchema.safeParse({ ...ok, hospital: 'x'.repeat(121) }))).toEqual([
      'hospital',
    ]);
  });
});

describe('CreatePatientSchema', () => {
  it('accepts a valid patient and defaults the diagnosis', () => {
    expect(CreatePatientSchema.parse(patient).diagnosis).toBe('');
  });

  it('rejects dates of birth in the future or beyond 130 years', () => {
    expect(
      fields(CreatePatientSchema.safeParse({ ...patient, dateOfBirth: '2999-01-01' })),
    ).toEqual(['dateOfBirth']);
    expect(
      fields(CreatePatientSchema.safeParse({ ...patient, dateOfBirth: '1800-01-01' })),
    ).toEqual(['dateOfBirth']);
    expect(CreatePatientSchema.safeParse({ ...patient, dateOfBirth: '1900-01-01' }).success).toBe(
      true,
    );
  });

  it('rejects an admission date in the future', () => {
    expect(
      fields(CreatePatientSchema.safeParse({ ...patient, admittedAt: '2999-01-01T00:00:00.000Z' })),
    ).toEqual(['admittedAt']);
  });

  it('rejects unknown conditions and genders', () => {
    expect(
      fields(CreatePatientSchema.safeParse({ ...patient, condition: 'dead', gender: 'x' })),
    ).toEqual(['condition', 'gender']);
  });
});

describe('UpdatePatientSchema', () => {
  it('accepts any subset and rejects an empty object', () => {
    expect(UpdatePatientSchema.safeParse({ condition: 'critical' }).success).toBe(true);
    expect(UpdatePatientSchema.safeParse({}).success).toBe(false);
  });

  it('applies the same field rules', () => {
    expect(UpdatePatientSchema.safeParse({ email: 'bad' }).success).toBe(false);
  });
});

describe('list queries', () => {
  it('apply defaults and coerce numbers', () => {
    const q = DoctorListQuerySchema.parse({ page: '2', limit: '50' });
    expect(q).toMatchObject({ page: 2, limit: 50, sort: '-createdAt' });
  });

  it('cap the page size and reject unknown sorts', () => {
    expect(DoctorListQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(PatientListQuerySchema.safeParse({ sort: 'bogus' }).success).toBe(false);
    expect(PatientListQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });

  it('reject a range whose start is after its end', () => {
    expect(DoctorListQuerySchema.safeParse({ from: '2026-02-01', to: '2026-01-01' }).success).toBe(
      false,
    );
    expect(PatientListQuerySchema.safeParse({ from: '2026-01-01', to: '2026-01-01' }).success).toBe(
      true,
    );
  });

  it('accept the documented sort values per resource', () => {
    expect(DoctorListQuerySchema.safeParse({ sort: '-patientCount' }).success).toBe(true);
    expect(PatientListQuerySchema.safeParse({ sort: '-patientCount' }).success).toBe(false);
    expect(PatientListQuerySchema.safeParse({ sort: '-admittedAt' }).success).toBe(true);
  });
});

describe('TimeseriesQuerySchema', () => {
  const parse = (value: Record<string, unknown>) => TimeseriesQuerySchema.safeParse(value);

  it('defaults to patients per day and accepts the documented windows', () => {
    expect(parse({}).data).toMatchObject({ entity: 'patients', interval: 'day' });
    for (const window of ['7', '30', '90']) expect(parse({ window }).success).toBe(true);
    expect(parse({ window: '15' }).success).toBe(false);
  });

  it('accepts a custom range of at most 366 days', () => {
    expect(parse({ from: '2026-01-01', to: '2026-12-31' }).success).toBe(true);
    expect(parse({ from: '2024-01-01', to: '2024-12-31' }).success).toBe(true);
    expect(parse({ from: '2026-01-01', to: '2027-01-02' }).success).toBe(false);
  });

  it('rejects an inverted, half-open or doubly specified range', () => {
    expect(parse({ from: '2026-02-01', to: '2026-01-01' }).success).toBe(false);
    expect(parse({ from: '2026-01-01' }).success).toBe(false);
    expect(parse({ from: '2026-01-01', to: '2026-01-31', window: '7' }).success).toBe(false);
  });
});

describe('PatientsPerDoctorQuerySchema', () => {
  it('defaults to 10 and caps at 20', () => {
    expect(PatientsPerDoctorQuerySchema.parse({}).limit).toBe(10);
    expect(PatientsPerDoctorQuerySchema.safeParse({ limit: '21' }).success).toBe(false);
    expect(PatientsPerDoctorQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });
});
