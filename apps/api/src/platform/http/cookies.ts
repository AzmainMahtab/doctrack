import { parse, serialize } from 'cookie';
import type { Request, Response } from 'express';

export const ACCESS_COOKIE = 'dt_access';
export const REFRESH_COOKIE = 'dt_refresh';
export const API_PREFIX = '/api/v1';
export const AUTH_PATH = `${API_PREFIX}/auth`;

export interface CookieSettings {
  secure: boolean;
  domain?: string;
}

export interface CookieSet {
  name: string;
  value: string;
  maxAgeSeconds: number;
  path: string;
}

export interface CookieClear {
  name: string;
  path: string;
}

export interface CookieOps {
  set?: CookieSet[];
  clear?: CookieClear[];
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  return parse(header)[name];
}

export function applyCookies(res: Response, ops: CookieOps, settings: CookieSettings): void {
  const base = {
    httpOnly: true,
    secure: settings.secure,
    sameSite: 'lax' as const,
    ...(settings.domain ? { domain: settings.domain } : {}),
  };
  const header: string[] = [];
  for (const cookie of ops.set ?? []) {
    header.push(
      serialize(cookie.name, cookie.value, {
        ...base,
        path: cookie.path,
        maxAge: cookie.maxAgeSeconds,
      }),
    );
  }
  for (const cookie of ops.clear ?? []) {
    header.push(serialize(cookie.name, '', { ...base, path: cookie.path, maxAge: 0 }));
  }
  if (header.length > 0) res.setHeader('Set-Cookie', header);
}
