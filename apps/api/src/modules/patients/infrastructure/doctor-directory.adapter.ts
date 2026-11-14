import type { DoctorsModule } from '../../doctors/index.ts';
import { DoctorDirectory, type DoctorSummary } from '../domain/ports.ts';

export class DoctorDirectoryAdapter extends DoctorDirectory {
  constructor(private readonly doctors: DoctorsModule['api']) {
    super();
  }

  find(id: string): Promise<DoctorSummary | null> {
    return this.doctors.find(id);
  }
}
