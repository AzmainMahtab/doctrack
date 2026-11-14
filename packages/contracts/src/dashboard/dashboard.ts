import { z } from '../openapi.ts';
import { CONDITIONS, ConditionSchema } from '../common/fields.ts';

export const SummarySchema = z
  .object({
    doctors: z.number().int().min(0),
    patients: z.number().int().min(0),
    updatedAt: z.iso.datetime().nullable(),
  })
  .openapi('DashboardSummary');

export const ConditionCountsSchema = z
  .object({
    counts: z.record(ConditionSchema, z.number().int().min(0)),
    total: z.number().int().min(0),
  })
  .openapi('ConditionCounts');

export const PatientsPerDoctorQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const PatientsPerDoctorRowSchema = z
  .object({ doctorId: z.string(), name: z.string(), patientCount: z.number().int().min(0) })
  .openapi('PatientsPerDoctorRow');

export const TIMESERIES_ENTITIES = ['patients', 'doctors'] as const;
export const TIMESERIES_INTERVALS = ['day', 'week', 'month'] as const;
export const TIMESERIES_WINDOWS = [7, 30, 90] as const;
export const MAX_RANGE_DAYS = 366;

const spanDays = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

export const TimeseriesQuerySchema = z
  .object({
    entity: z.enum(TIMESERIES_ENTITIES).default('patients'),
    interval: z.enum(TIMESERIES_INTERVALS).default('day'),
    window: z.coerce
      .number()
      .int()
      .refine(
        (v): v is (typeof TIMESERIES_WINDOWS)[number] =>
          (TIMESERIES_WINDOWS as readonly number[]).includes(v),
        {
          message: 'Must be 7, 30 or 90',
        },
      )
      .optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .superRefine((value, ctx) => {
    const custom = value.from !== undefined || value.to !== undefined;
    if (custom && (value.from === undefined || value.to === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['from'], message: 'Provide both `from` and `to`' });
      return;
    }
    if (custom && value.window !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['window'],
        message: 'Use either `window` or `from` and `to`',
      });
      return;
    }
    if (value.from && value.to) {
      if (value.from > value.to) {
        ctx.addIssue({ code: 'custom', path: ['from'], message: '`from` must not be after `to`' });
      } else if (spanDays(value.from, value.to) > MAX_RANGE_DAYS) {
        ctx.addIssue({
          code: 'custom',
          path: ['to'],
          message: `The range must not exceed ${MAX_RANGE_DAYS} days`,
        });
      }
    }
  });

export const TimeseriesSchema = z
  .object({
    entity: z.enum(TIMESERIES_ENTITIES),
    interval: z.enum(TIMESERIES_INTERVALS),
    from: z.iso.date(),
    to: z.iso.date(),
    points: z.array(z.object({ date: z.iso.date(), count: z.number().int().min(0) })),
  })
  .openapi('Timeseries');

export type Summary = z.infer<typeof SummarySchema>;
export type ConditionCounts = z.infer<typeof ConditionCountsSchema>;
export type TimeseriesQuery = z.infer<typeof TimeseriesQuerySchema>;
export type Timeseries = z.infer<typeof TimeseriesSchema>;
export type PatientsPerDoctorRow = z.infer<typeof PatientsPerDoctorRowSchema>;
export { CONDITIONS };
