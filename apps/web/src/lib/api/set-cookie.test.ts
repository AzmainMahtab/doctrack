import { describe, expect, it } from 'vitest';
import { isFresh, jwtExpiry, parseSetCookie, safeNext } from './set-cookie';

const jwt = (exp: number) => `h.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.s`;

describe('parseSetCookie', () => {
  it('reads name, value and attributes', () => {
    expect(
      parseSetCookie('dt_access=abc.def.ghi; Max-Age=899; Path=/; HttpOnly; SameSite=Lax'),
    ).toEqual({
      name: 'dt_access',
      value: 'abc.def.ghi',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 899,
    });
  });

  it('keeps equals signs inside the value and reads Secure', () => {
    const cookie = parseSetCookie('a=b=c==; Secure; Path=/api/v1/auth');
    expect(cookie).toMatchObject({ name: 'a', value: 'b=c==', secure: true, path: '/api/v1/auth' });
  });

  it('rejects a header with no name', () => {
    expect(parseSetCookie('=oops')).toBeNull();
    expect(parseSetCookie('')).toBeNull();
  });
});

describe('token expiry', () => {
  const now = Date.UTC(2026, 10, 14, 10, 0, 0);

  it('decodes exp in milliseconds', () => {
    expect(jwtExpiry(jwt(1000))).toBe(1_000_000);
    expect(jwtExpiry('garbage')).toBeNull();
    expect(jwtExpiry(undefined)).toBeNull();
  });

  it('treats a token as fresh only with a skew margin left', () => {
    expect(isFresh(jwt(now / 1000 + 600), 10_000, now)).toBe(true);
    expect(isFresh(jwt(now / 1000 + 5), 10_000, now)).toBe(false);
    expect(isFresh(jwt(now / 1000 - 5), 10_000, now)).toBe(false);
    expect(isFresh(undefined, 10_000, now)).toBe(false);
  });
});

describe('safeNext', () => {
  it('allows local paths and rejects everything that could leave the site', () => {
    expect(safeNext('/doctors?page=2')).toBe('/doctors?page=2');
    expect(safeNext('//evil.example')).toBe('/dashboard');
    expect(safeNext('/\\evil.example')).toBe('/dashboard');
    expect(safeNext('https://evil.example')).toBe('/dashboard');
    expect(safeNext('')).toBe('/dashboard');
    expect(safeNext(null)).toBe('/dashboard');
  });
});
