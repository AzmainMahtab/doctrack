export const API_PREFIX = '/api/v1';

export const apiOrigin = (): string => process.env.API_URL ?? 'http://localhost:8080';

export const ACCESS_COOKIE = 'dt_access';
export const REFRESH_COOKIE = 'dt_refresh';
