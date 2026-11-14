import { NextResponse, type NextRequest } from 'next/server';
import { apiOrigin, API_PREFIX, ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/api/config';
import { clientIp } from '@/lib/api/client-ip';
import { isFresh, parseSetCookie } from '@/lib/api/set-cookie';

const dev = process.env.NODE_ENV !== 'production';

function policy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

function secure(response: NextResponse, csp: string): NextResponse {
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = policy(nonce);

  const forwarded = new Headers(request.headers);
  forwarded.set('x-nonce', nonce);
  forwarded.set('content-security-policy', csp);

  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const onLogin = pathname === '/login';

  const toLogin = () => {
    const target = new URL('/login', request.url);
    if (pathname !== '/' && !onLogin) target.searchParams.set('next', `${pathname}${search}`);
    const response = NextResponse.redirect(target);
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete({ name: REFRESH_COOKIE, path: `${API_PREFIX}/auth` });
    return secure(response, csp);
  };

  if (onLogin) {
    if (isFresh(access))
      return secure(NextResponse.redirect(new URL('/dashboard', request.url)), csp);
    return secure(NextResponse.next({ request: { headers: forwarded } }), csp);
  }

  if (isFresh(access)) return secure(NextResponse.next({ request: { headers: forwarded } }), csp);
  if (!refresh) return toLogin();

  let upstream: Response;
  try {
    upstream = await fetch(`${apiOrigin()}${API_PREFIX}/auth/refresh`, {
      method: 'POST',
      headers: {
        cookie: `${REFRESH_COOKIE}=${refresh}`,
        'x-forwarded-for': clientIp(request.headers),
      },
      cache: 'no-store',
    });
  } catch {
    return toLogin();
  }
  if (!upstream.ok) return toLogin();

  const fresh = upstream.headers
    .getSetCookie()
    .map(parseSetCookie)
    .filter((c) => c !== null);
  const jar = new Map<string, string>(request.cookies.getAll().map((c) => [c.name, c.value]));
  for (const cookie of fresh) jar.set(cookie.name, cookie.value);
  forwarded.set('cookie', [...jar].map(([name, value]) => `${name}=${value}`).join('; '));

  const response = NextResponse.next({ request: { headers: forwarded } });
  for (const cookie of fresh) {
    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite ?? 'lax',
      ...(cookie.path ? { path: cookie.path } : {}),
      ...(cookie.maxAge !== undefined ? { maxAge: cookie.maxAge } : {}),
    });
  }
  return secure(response, csp);
}

export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
