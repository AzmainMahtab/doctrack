import type { DoctorPatientListQuery, PatientListQuery } from '@doctrack/contracts';
import type { Page } from '../../../shared/pagination/index.ts';
import type { Patient, PatientProps } from './patient.ts';

export type PatientRow = Pick<
  PatientProps,
  'id' | 'name' | 'condition' | 'doctorId' | 'doctorName' | 'admittedAt'
>;

export abstract class PatientRepository {
  abstract insert(patient: Patient): Promise<void>;
  abstract save(patient: Patient): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract findById(id: string): Promise<Patient | null>;
  abstract list(query: PatientListQuery): Promise<Page<PatientRow>>;
  abstract listForDoctor(
    doctorId: string,
    query: DoctorPatientListQuery,
  ): Promise<Page<PatientRow>>;
}

export interface DoctorSummary {
  id: string;
  name: string;
}

export abstract class DoctorDirectory {
  abstract find(id: string): Promise<DoctorSummary | null>;
}
