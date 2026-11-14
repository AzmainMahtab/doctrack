import type { Redis } from 'ioredis';
import type { Db } from 'mongodb';
import type { TransactionContext } from '../../platform/database/index.ts';
import type { Clock, UnitOfWork } from '../../shared/application/index.ts';
import type { DoctorsModule } from '../doctors/index.ts';
import type { PatientsModule } from '../patients/index.ts';
import {
  GetConditions,
  GetPatientsPerDoctor,
  GetSummary,
  GetTimeseries,
  ProjectEvent,
  Reconcile,
} from './application/index.ts';
import { MongoAnalyticsRepository } from './infrastructure/mongo-analytics-repository.ts';
import { AnalyticsProjectionConsumer } from './infrastructure/projection.consumer.ts';
import { RedisDashboardCache } from './infrastructure/redis-dashboard-cache.ts';
import { DoctorRankingAdapter, ModuleAnalyticsSource } from './infrastructure/source-adapters.ts';
import { dashboardRoutes } from './presentation/dashboard.routes.ts';

export interface AnalyticsDeps {
  db: Db;
  redis: Redis;
  transactions: TransactionContext;
  uow: UnitOfWork;
  clock: Clock;
  doctors: DoctorsModule['api'];
  patients: PatientsModule['api'];
  cacheNamespace?: string;
}

export function createAnalyticsModule(deps: AnalyticsDeps) {
  const repository = new MongoAnalyticsRepository(deps.db, deps.transactions);
  const cache = new RedisDashboardCache(deps.redis, deps.cacheNamespace);
  const ranking = new DoctorRankingAdapter(deps.doctors);
  const source = new ModuleAnalyticsSource(deps.doctors, deps.patients);
  return {
    routes: dashboardRoutes({
      summary: new GetSummary(repository, cache),
      conditions: new GetConditions(repository, cache),
      perDoctor: new GetPatientsPerDoctor(ranking, cache),
      timeseries: new GetTimeseries(repository, cache, deps.clock),
    }),
    consumers: [new AnalyticsProjectionConsumer(new ProjectEvent(repository), cache)],
    reconcile: new Reconcile(repository, source, deps.uow),
    cache,
  };
}

export type AnalyticsModule = ReturnType<typeof createAnalyticsModule>;
