import type { Delta, DayRow, Snapshot, Totals } from './model.ts';

export abstract class AnalyticsRepository {
  abstract apply(delta: Delta): Promise<void>;
  abstract readTotals(): Promise<Totals>;
  abstract readDaily(from: string, to: string): Promise<DayRow[]>;
  abstract readAll(): Promise<Snapshot>;
  abstract replaceAll(snapshot: Snapshot): Promise<void>;
}

export abstract class AnalyticsSource {
  abstract compute(): Promise<Snapshot>;
}

export interface RankedDoctor {
  id: string;
  name: string;
  patientCount: number;
}

export abstract class DoctorRanking {
  abstract top(limit: number): Promise<RankedDoctor[]>;
}

export abstract class DashboardCache {
  abstract remember<T>(endpoint: string, params: string, compute: () => Promise<T>): Promise<T>;
  abstract invalidate(): Promise<void>;
}
