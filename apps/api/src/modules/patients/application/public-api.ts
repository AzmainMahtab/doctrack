import type { DayCount, PatientRepository } from '../domain/ports.ts';

export class PatientsPublicApi {
  constructor(private readonly patients: PatientRepository) {}

  countAll(): Promise<number> {
    return this.patients.countAll();
  }

  countByCondition(): Promise<Record<string, number>> {
    return this.patients.countByCondition();
  }

  registrationsByDay(): Promise<DayCount[]> {
    return this.patients.registrationsByDay();
  }
}
