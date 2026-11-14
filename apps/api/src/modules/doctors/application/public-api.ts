import type { DoctorRepository } from '../domain/ports.ts';

export interface DoctorSummary {
  id: string;
  name: string;
}

export class DoctorsPublicApi {
  constructor(private readonly doctors: DoctorRepository) {}

  async find(id: string): Promise<DoctorSummary | null> {
    const doctor = await this.doctors.findById(id);
    return doctor ? { id: doctor.id, name: doctor.name } : null;
  }
}
