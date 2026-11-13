import { z } from '../openapi.ts';

export const ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHENTICATED',
  'TOKEN_REVOKED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION_FAILED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'UNAVAILABLE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const PROBLEM_BASE_URI = 'https://doctrack.app/problems/';

export const FieldErrorSchema = z
  .object({ field: z.string(), message: z.string() })
  .openapi('FieldError');

export const ProblemSchema = z
  .object({
    type: z.string().openapi({ example: `${PROBLEM_BASE_URI}validation-failed` }),
    title: z.string().openapi({ example: 'Request validation failed' }),
    status: z.number().int().openapi({ example: 422 }),
    detail: z.string().openapi({ example: '2 fields are invalid.' }),
    instance: z.string().openapi({ example: '/api/v1/doctors' }),
    code: z.enum(ERROR_CODES),
    requestId: z.string(),
    errors: z.array(FieldErrorSchema).optional(),
    retryAfter: z.number().int().positive().optional(),
  })
  .openapi('Problem');

export type Problem = z.infer<typeof ProblemSchema>;
