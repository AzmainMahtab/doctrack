import { CONDITIONS } from '@doctrack/contracts';
import type { DoctorsModule } from '../../doctors/index.ts';
import type { PatientsModule } from '../../patients/index.ts';
import { emptyConditions, type Snapshot } from '../domain/model.ts';
import { AnalyticsSource, DoctorRanking, type RankedDoctor } from '../domain/ports.ts';

export class DoctorRankingAdapter extends DoctorRanking {
  constructor(private readonly doctors: DoctorsModule['api']) {
    super();
  }

  top(limit: number): Promise<RankedDoctor[]> {
    return this.doctors.topByPatientCount(limit);
  }
}

export class ModuleAnalyticsSource extends AnalyticsSource {
  constructor(
    private readonly doctors: DoctorsModule['api'],
    private readonly patients: PatientsModule['api'],
  ) {
    super();
  }

  async compute(): Promise<Snapshot> {
    const doctorCount = await this.doctors.countAll();
    const doctorDays = await this.doctors.registrationsByDay();
    const patientCount = await this.patients.countAll();
    const byCondition = await this.patients.countByCondition();
    const patientDays = await this.patients.registrationsByDay();

    const conditions = emptyConditions();
    for (const c of CONDITIONS) conditions[c] = byCondition[c] ?? 0;

    const days = new Map<string, { patients: number; doctors: number }>();
    for (const d of patientDays) days.set(d.date, { patients: d.count, doctors: 0 });
    for (const d of doctorDays) {
      const row = days.get(d.date) ?? { patients: 0, doctors: 0 };
      row.doctors = d.count;
      days.set(d.date, row);
    }
    return {
      doctors: doctorCount,
      patients: patientCount,
      conditions,
      daily: [...days.entries()].map(([date, row]) => ({ date, ...row })),
    };
  }
}
