import type {
  ConditionCounts as ConditionCountsDto,
  PatientsPerDoctorRow,
  Summary,
  Timeseries,
  TimeseriesQuery,
} from '@doctrack/contracts';
import type { Clock } from '../../../shared/application/index.ts';
import { utcDay } from '../../../shared/time/index.ts';
import { normalize } from '../domain/model.ts';
import type { AnalyticsRepository, DashboardCache, DoctorRanking } from '../domain/ports.ts';
import { buildTimeseries, resolveRange } from './timeseries.ts';

export class GetSummary {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly cache: DashboardCache,
  ) {}

  execute(): Promise<Summary> {
    return this.cache.remember('summary', '', async () => {
      const totals = await this.repository.readTotals();
      return {
        doctors: Math.max(0, totals.doctors),
        patients: Math.max(0, totals.patients),
        updatedAt: totals.updatedAt ? totals.updatedAt.toISOString() : null,
      };
    });
  }
}

export class GetConditions {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly cache: DashboardCache,
  ) {}

  execute(): Promise<ConditionCountsDto> {
    return this.cache.remember('conditions', '', async () => {
      const totals = await this.repository.readTotals();
      const counts = normalize({ ...totals, daily: [] }).conditions;
      return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
    });
  }
}

export class GetPatientsPerDoctor {
  constructor(
    private readonly ranking: DoctorRanking,
    private readonly cache: DashboardCache,
  ) {}

  execute(limit: number): Promise<PatientsPerDoctorRow[]> {
    return this.cache.remember('patients-per-doctor', String(limit), async () =>
      (await this.ranking.top(limit)).map((d) => ({
        doctorId: d.id,
        name: d.name,
        patientCount: Math.max(0, d.patientCount),
      })),
    );
  }
}

export class GetTimeseries {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly cache: DashboardCache,
    private readonly clock: Clock,
  ) {}

  execute(query: TimeseriesQuery): Promise<Timeseries> {
    const today = utcDay(this.clock.now());
    const range = resolveRange(query, today);
    const params = `${query.entity}:${query.interval}:${range.from}:${range.to}:${today}`;
    return this.cache.remember('timeseries', params, async () =>
      buildTimeseries(query, range, await this.repository.readDaily(range.from, range.to)),
    );
  }
}
