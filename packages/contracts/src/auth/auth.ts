import { z } from '../openapi.ts';

export const ROLES = ['admin', 'viewer'] as const;
export const RoleSchema = z.enum(ROLES).openapi('Role');
export type Role = z.infer<typeof RoleSchema>;

export const LoginRequestSchema = z
  .object({
    email: z.email().max(254).openapi({ example: 'admin@doctrack.dev' }),
    password: z.string().min(1).max(128).openapi({ example: 'a-long-passphrase' }),
  })
  .openapi('LoginRequest');

export const AuthUserSchema = z
  .object({ id: z.string(), email: z.string(), role: RoleSchema })
  .openapi('AuthUser');

export const SessionSchema = z.object({ user: AuthUserSchema }).openapi('Session');

export const MeSchema = z
  .object({ user: AuthUserSchema, permissions: z.array(z.string()) })
  .openapi('Me');

export type AuthUser = z.infer<typeof AuthUserSchema>;
export type Me = z.infer<typeof MeSchema>;
