import type { DayCount, DoctorRepository, RankedDoctor } from '../domain/ports.ts';

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

  countAll(): Promise<number> {
    return this.doctors.countAll();
  }

  registrationsByDay(): Promise<DayCount[]> {
    return this.doctors.registrationsByDay();
  }

  topByPatientCount(limit: number): Promise<RankedDoctor[]> {
    return this.doctors.topByPatientCount(limit);
  }
}
