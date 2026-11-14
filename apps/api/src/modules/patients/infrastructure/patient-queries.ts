import type { PatientListQuery } from '@doctrack/contracts';
import type { Document } from 'mongodb';
import { dayRange, rangeFilter } from '../../../shared/pagination/index.ts';
import { queryWords } from '../../../shared/text/index.ts';

export interface PatientFilterInput {
  q?: string | undefined;
  condition?: string | undefined;
  doctorId?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export function buildPatientFilter(query: PatientFilterInput): Document {
  const filter: Document = {};
  if (query.doctorId) filter.doctorId = query.doctorId;
  if (query.condition) filter.condition = query.condition;
  const created = rangeFilter(dayRange(query.from, query.to));
  if (created) filter.createdAt = created;
  const words = queryWords(query.q);
  if (words.length > 0) {
    filter.$and = words.map((word) => ({ searchTokens: { $regex: `^${word}` } }));
  }
  return filter;
}

export function patientSort(sort: PatientListQuery['sort']): Record<string, 1 | -1> {
  switch (sort) {
    case 'createdAt':
      return { createdAt: 1, _id: 1 };
    case 'name':
      return { nameLower: 1, _id: 1 };
    case '-name':
      return { nameLower: -1, _id: -1 };
    case '-admittedAt':
      return { admittedAt: -1, _id: -1 };
    default:
      return { createdAt: -1, _id: -1 };
  }
}
