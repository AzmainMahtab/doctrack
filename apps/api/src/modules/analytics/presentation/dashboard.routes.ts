import {
  ConditionCountsSchema,
  PatientsPerDoctorQuerySchema,
  PatientsPerDoctorRowSchema,
  SummarySchema,
  TimeseriesQuerySchema,
  TimeseriesSchema,
  single,
  z,
} from '@doctrack/contracts';
import { API_PREFIX, defineRoute, type RouteDefinition } from '../../../platform/http/index.ts';
import type {
  GetConditions,
  GetPatientsPerDoctor,
  GetSummary,
  GetTimeseries,
} from '../application/index.ts';

export interface DashboardRouteDeps {
  summary: GetSummary;
  conditions: GetConditions;
  perDoctor: GetPatientsPerDoctor;
  timeseries: GetTimeseries;
}

export function dashboardRoutes(deps: DashboardRouteDeps): RouteDefinition[] {
  const summary = defineRoute({
    method: 'get',
    path: `${API_PREFIX}/dashboard/summary`,
    summary: 'Total doctors and patients',
    tags: ['Dashboard'],
    permission: 'dashboard:read',
    responses: { 200: { description: 'Totals', schema: single(SummarySchema) } },
    handler: async () => ({ status: 200, data: await deps.summary.execute() }),
  });

  const perDoctor = defineRoute({
    method: 'get',
    path: `${API_PREFIX}/dashboard/patients-per-doctor`,
    summary: 'Doctors ranked by number of patients',
    tags: ['Dashboard'],
    permission: 'dashboard:read',
    request: { query: PatientsPerDoctorQuerySchema },
    responses: {
      200: {
        description: 'Top doctors by patient count',
        schema: single(z.array(PatientsPerDoctorRowSchema)),
      },
    },
    handler: async ({ query }) => ({
      status: 200,
      data: await deps.perDoctor.execute(query.limit),
    }),
  });

  const timeseries = defineRoute({
    method: 'get',
    path: `${API_PREFIX}/dashboard/timeseries`,
    summary: 'Registrations per day, week or month',
    tags: ['Dashboard'],
    permission: 'dashboard:read',
    request: { query: TimeseriesQuerySchema },
    responses: { 200: { description: 'A zero-filled series', schema: single(TimeseriesSchema) } },
    handler: async ({ query }) => ({ status: 200, data: await deps.timeseries.execute(query) }),
  });

  const conditions = defineRoute({
    method: 'get',
    path: `${API_PREFIX}/dashboard/conditions`,
    summary: 'Patients grouped by condition',
    tags: ['Dashboard'],
    permission: 'dashboard:read',
    responses: {
      200: { description: 'Counts per condition', schema: single(ConditionCountsSchema) },
    },
    handler: async () => ({ status: 200, data: await deps.conditions.execute() }),
  });

  return [summary, perDoctor, timeseries, conditions];
}
