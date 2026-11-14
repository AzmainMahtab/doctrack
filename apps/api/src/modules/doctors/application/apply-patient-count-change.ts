import type { DoctorRepository } from '../domain/ports.ts';

const DELTAS: Record<string, number> = { 'patient.registered': 1, 'patient.removed': -1 };

export class ApplyPatientCountChange {
  constructor(private readonly doctors: DoctorRepository) {}

  async execute(event: { name: string; payload: Record<string, unknown> }): Promise<void> {
    const delta = DELTAS[event.name];
    const doctorId = event.payload.doctorId;
    if (delta === undefined || typeof doctorId !== 'string') return;
    await this.doctors.adjustPatientCount(doctorId, delta);
  }
}
