import type { DoctorListQuery } from '@doctrack/contracts';
import { describe, expect, it } from 'vitest';
import { buildDoctorFilter, doctorSort } from './doctor-queries.ts';

const base: DoctorListQuery = { page: 1, limit: 20, sort: '-createdAt' };

describe('buildDoctorFilter', () => {
  it('is empty without filters', () => {
    expect(buildDoctorFilter(base)).toEqual({});
  });

  it('turns every search word into an anchored prefix match', () => {
    expect(buildDoctorFilter({ ...base, q: 'Joh CAR' })).toEqual({
      $and: [{ searchTokens: { $regex: '^joh' } }, { searchTokens: { $regex: '^car' } }],
    });
  });

  it('combines equality filters and an inclusive day range in UTC', () => {
    const filter = buildDoctorFilter({
      ...base,
      specialization: 'Cardiology',
      hospital: 'City General',
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(filter).toEqual({
      specialization: 'Cardiology',
      hospital: 'City General',
      createdAt: {
        $gte: new Date('2026-01-01T00:00:00.000Z'),
        $lte: new Date('2026-01-31T23:59:59.999Z'),
      },
    });
  });

  it('supports an open-ended range', () => {
    expect(buildDoctorFilter({ ...base, from: '2026-01-01' })).toEqual({
      createdAt: { $gte: new Date('2026-01-01T00:00:00.000Z') },
    });
  });
});

describe('doctorSort', () => {
  it('always ends with _id so pages are stable', () => {
    for (const sort of ['-createdAt', 'createdAt', 'name', '-name', '-patientCount'] as const) {
      expect(Object.keys(doctorSort(sort)).at(-1)).toBe('_id');
    }
  });

  it('maps names to the normalized sort key', () => {
    expect(doctorSort('name')).toEqual({ nameLower: 1, _id: 1 });
    expect(doctorSort('-patientCount')).toEqual({ patientCount: -1, _id: -1 });
  });
});
