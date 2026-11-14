import type { DoctorListQuery } from '@doctrack/contracts';
import { AppError } from '../../../shared/errors/index.ts';
import type { Page } from '../../../shared/pagination/index.ts';
import type { DoctorProps } from '../domain/index.ts';
import type { DoctorRepository, DoctorRow } from '../domain/ports.ts';

export class ListDoctorsQuery {
  constructor(private readonly doctors: DoctorRepository) {}

  execute(query: DoctorListQuery): Promise<Page<DoctorRow>> {
    return this.doctors.list(query);
  }
}

export class GetDoctorQuery {
  constructor(private readonly doctors: DoctorRepository) {}

  async execute(id: string): Promise<DoctorProps> {
    const doctor = await this.doctors.findById(id);
    if (!doctor) throw AppError.notFound('Doctor not found.');
    return doctor;
  }
}
