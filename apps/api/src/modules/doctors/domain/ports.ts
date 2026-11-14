import type { DoctorListQuery } from '@doctrack/contracts';
import type { Page } from '../../../shared/pagination/index.ts';
import type { Doctor, DoctorProps } from './doctor.ts';

export type DoctorRow = Pick<
  DoctorProps,
  'id' | 'name' | 'specialization' | 'hospital' | 'patientCount' | 'createdAt'
>;

export abstract class DoctorRepository {
  abstract insert(doctor: Doctor): Promise<void>;
  abstract findById(id: string): Promise<DoctorProps | null>;
  abstract list(query: DoctorListQuery): Promise<Page<DoctorRow>>;
  abstract adjustPatientCount(id: string, delta: number): Promise<void>;
}
