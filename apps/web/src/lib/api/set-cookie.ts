export interface ParsedCookie {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  path?: string;
  maxAge?: number;
}

export function parseSetCookie(header: string): ParsedCookie | null {
  const [pair, ...attrs] = header.split(';').map((part) => part.trim());
  if (!pair) return null;
  const eq = pair.indexOf('=');
  if (eq < 1) return null;
  const cookie: ParsedCookie = {
    name: pair.slice(0, eq),
    value: pair.slice(eq + 1),
    httpOnly: false,
    secure: false,
  };
  for (const attr of attrs) {
    const [rawKey, ...rest] = attr.split('=');
    const key = (rawKey ?? '').toLowerCase();
    const value = rest.join('=');
    if (key === 'httponly') cookie.httpOnly = true;
    else if (key === 'secure') cookie.secure = true;
    else if (key === 'path') cookie.path = value;
    else if (key === 'max-age') cookie.maxAge = Number(value);
    else if (key === 'samesite') {
      const v = value.toLowerCase();
      if (v === 'lax' || v === 'strict' || v === 'none') cookie.sameSite = v;
    }
  }
  return cookie;
}

export function jwtExpiry(token: string | undefined): number | null {
  if (!token) return null;
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export const isFresh = (token: string | undefined, skewMs = 10_000, now = Date.now()): boolean => {
  const exp = jwtExpiry(token);
  return exp !== null && exp - skewMs > now;
};

export const safeNext = (value: string | null | undefined): string => {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\'))
    return '/dashboard';
  return value;
};
