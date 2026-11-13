import type { Role } from '@doctrack/contracts';

export const PERMISSIONS = [
  'doctors:read',
  'doctors:write',
  'patients:read',
  'patients:write',
  'dashboard:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const READ: readonly Permission[] = ['doctors:read', 'patients:read', 'dashboard:read'];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  viewer: READ,
};

export const permissionsFor = (role: string): readonly Permission[] =>
  ROLE_PERMISSIONS[role as Role] ?? [];
