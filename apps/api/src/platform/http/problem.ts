import { PROBLEM_BASE_URI, type Problem } from '@doctrack/contracts';
import type { AppError } from '../../shared/errors/index.ts';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

const kebab = (code: string): string => code.toLowerCase().replaceAll('_', '-');

export function toProblem(error: AppError, instance: string, requestId: string): Problem {
  const problem: Problem = {
    type: `${PROBLEM_BASE_URI}${kebab(error.code)}`,
    title: error.title,
    status: error.status,
    detail: error.message,
    instance,
    code: error.code,
    requestId,
  };
  if (error.code === 'VALIDATION_FAILED') problem.errors = error.errors;
  if (error.retryAfter !== undefined) problem.retryAfter = error.retryAfter;
  return problem;
}
