import type { UnitOfWork } from '../../../shared/application/index.ts';
import { diffSnapshots } from '../domain/model.ts';
import type { AnalyticsRepository, AnalyticsSource } from '../domain/ports.ts';

export interface Drift {
  consistent: boolean;
  differences: string[];
}

export class Reconcile {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly source: AnalyticsSource,
    private readonly uow: UnitOfWork,
  ) {}

  verify(): Promise<Drift> {
    return this.uow.withTransaction(async () => {
      const expected = await this.source.compute();
      const actual = await this.repository.readAll();
      const differences = diffSnapshots(expected, actual);
      return { consistent: differences.length === 0, differences };
    });
  }

  rebuild(): Promise<Drift> {
    return this.uow.withTransaction(async () => {
      const expected = await this.source.compute();
      const before = await this.repository.readAll();
      const differences = diffSnapshots(expected, before);
      await this.repository.replaceAll(expected);
      return { consistent: differences.length === 0, differences };
    });
  }
}
