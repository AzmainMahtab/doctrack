import { z } from '../openapi.ts';

export const CONDITIONS = ['stable', 'under_observation', 'critical', 'recovered'] as const;
export const GENDERS = ['female', 'male', 'other'] as const;

export const ConditionSchema = z.enum(CONDITIONS).openapi('Condition');
export const GenderSchema = z.enum(GENDERS).openapi('Gender');

export type Condition = (typeof CONDITIONS)[number];
export type Gender = (typeof GENDERS)[number];

export const PhoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Must be in E.164 format, for example +14155550123')
  .openapi({ example: '+14155550123' });

export const EmailSchema = z.email().max(254).openapi({ example: 'ada@example.com' });

export const NameSchema = z.string().trim().min(2).max(100).openapi({ example: 'Ada Lovelace' });

export const MAX_AGE_YEARS = 130;

const startOfTodayUtc = (): number => {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
};

export const DateOfBirthSchema = z.iso
  .date()
  .refine((value) => Date.parse(value) < startOfTodayUtc(), 'Must be in the past')
  .refine((value) => {
    const born = new Date(value);
    const limit = new Date();
    limit.setUTCFullYear(limit.getUTCFullYear() - MAX_AGE_YEARS);
    return born.getTime() >= limit.getTime();
  }, `Age must be at most ${MAX_AGE_YEARS} years`)
  .openapi({ example: '1985-03-21' });

export const AdmittedAtSchema = z.iso
  .datetime()
  .refine((value) => Date.parse(value) <= Date.now() + 60_000, 'Must not be in the future')
  .openapi({ example: '2026-11-01T09:30:00.000Z' });

export const DateRangeQuery = {
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
};

export const rangeIsOrdered = (value: { from?: string | undefined; to?: string | undefined }) =>
  !value.from || !value.to || value.from <= value.to;

export const searchQuery = z.string().trim().min(1).max(100).optional();
