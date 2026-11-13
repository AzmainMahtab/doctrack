import { z } from '../openapi.ts';

export const HealthSchema = z.object({ status: z.literal('ok') }).openapi('Health');

export const CheckStateSchema = z.enum(['up', 'down']);

export const ReadinessSchema = z
  .object({
    status: z.literal('ready'),
    checks: z.record(z.string(), CheckStateSchema),
  })
  .openapi('Readiness');

export type Readiness = z.infer<typeof ReadinessSchema>;
