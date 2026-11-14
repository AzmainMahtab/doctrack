import type { DoctorPatientListQuery, PatientListQuery } from '@doctrack/contracts';
import { AppError } from '../../../shared/errors/index.ts';
import type { Page } from '../../../shared/pagination/index.ts';
import type { PatientProps } from '../domain/index.ts';
import type { DoctorDirectory, PatientRepository, PatientRow } from '../domain/ports.ts';

export class ListPatientsQuery {
  constructor(private readonly patients: PatientRepository) {}

  execute(query: PatientListQuery): Promise<Page<PatientRow>> {
    return this.patients.list(query);
  }
}

export class ListDoctorPatientsQuery {
  constructor(
    private readonly patients: PatientRepository,
    private readonly doctors: DoctorDirectory,
  ) {}

  async execute(doctorId: string, query: DoctorPatientListQuery): Promise<Page<PatientRow>> {
    if (!(await this.doctors.find(doctorId))) throw AppError.notFound('Doctor not found.');
    return this.patients.listForDoctor(doctorId, query);
  }
}

export class GetPatientQuery {
  constructor(private readonly patients: PatientRepository) {}

  async execute(id: string): Promise<PatientProps> {
    const patient = await this.patients.findById(id);
    if (!patient) throw AppError.notFound('Patient not found.');
    return patient.props;
  }
}
