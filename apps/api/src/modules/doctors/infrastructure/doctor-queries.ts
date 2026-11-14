import type { DoctorListQuery } from '@doctrack/contracts';
import type { Document } from 'mongodb';
import { dayRange, rangeFilter } from '../../../shared/pagination/index.ts';
import { queryWords } from '../../../shared/text/index.ts';

export function buildDoctorFilter(query: DoctorListQuery): Document {
  const filter: Document = {};
  if (query.specialization) filter.specialization = query.specialization;
  if (query.hospital) filter.hospital = query.hospital;
  const created = rangeFilter(dayRange(query.from, query.to));
  if (created) filter.createdAt = created;
  const words = queryWords(query.q);
  if (words.length > 0) {
    filter.$and = words.map((word) => ({ searchTokens: { $regex: `^${word}` } }));
  }
  return filter;
}

export function doctorSort(sort: DoctorListQuery['sort']): Record<string, 1 | -1> {
  switch (sort) {
    case 'createdAt':
      return { createdAt: 1, _id: 1 };
    case 'name':
      return { nameLower: 1, _id: 1 };
    case '-name':
      return { nameLower: -1, _id: -1 };
    case '-patientCount':
      return { patientCount: -1, _id: -1 };
    default:
      return { createdAt: -1, _id: -1 };
  }
}
