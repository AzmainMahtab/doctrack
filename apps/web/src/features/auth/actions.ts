'use server';

import { LoginRequestSchema } from '@doctrack/contracts';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { clientIp } from '@/lib/api/client-ip';
import { apiOrigin, API_PREFIX, ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/api/config';
import type { ApiError } from '@/lib/api/problem';
import { parseProblem } from '@/lib/api/problem';
import { parseSetCookie, safeNext } from '@/lib/api/set-cookie';

export interface LoginState {
  error?: string;
  retryAfter?: number;
  fieldErrors?: { email?: string; password?: string };
  email?: string;
}

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(String(formData.get('next') ?? ''));

  const parsed = LoginRequestSchema.safeParse({ email, password });
  if (!parsed.success) {
    const fieldErrors: LoginState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === 'email') fieldErrors.email ??= 'Enter a valid email address.';
      if (key === 'password') fieldErrors.password ??= 'Enter your password.';
    }
    return { fieldErrors, email };
  }

  let response: Response;
  try {
    response = await fetch(`${apiOrigin()}${API_PREFIX}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': clientIp(await headers()) },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });
  } catch {
    return { error: 'The service is not reachable. Try again in a moment.', email };
  }

  if (!response.ok) {
    const problem: ApiError = await parseProblem(response);
    if (problem.status === 429) {
      return {
        error: `Too many attempts. Try again in ${problem.retryAfter ?? 60} seconds.`,
        ...(problem.retryAfter ? { retryAfter: problem.retryAfter } : {}),
        email,
      };
    }
    if (problem.status === 503)
      return { error: 'The service is unavailable. Try again in a moment.', email };
    return { error: 'Invalid email or password.', email };
  }

  const jar = await cookies();
  for (const raw of response.headers.getSetCookie()) {
    const cookie = parseSetCookie(raw);
    if (!cookie) continue;
    jar.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite ?? 'lax',
      ...(cookie.path ? { path: cookie.path } : {}),
      ...(cookie.maxAge !== undefined ? { maxAge: cookie.maxAge } : {}),
    });
  }
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  const jar = await cookies();
  try {
    await fetch(`${apiOrigin()}${API_PREFIX}/auth/logout`, {
      method: 'POST',
      headers: { cookie: jar.toString(), 'x-forwarded-for': clientIp(await headers()) },
      cache: 'no-store',
    });
  } catch {
    jar.delete(ACCESS_COOKIE);
  }
  jar.delete(ACCESS_COOKIE);
  jar.delete({ name: REFRESH_COOKIE, path: `${API_PREFIX}/auth` });
  redirect('/login');
}
