import type { NextRequest } from 'next/server';
import { apiOrigin, API_PREFIX } from '@/lib/api/config';
import { clientIp } from '@/lib/api/client-ip';

const FORWARD_REQUEST = ['content-type', 'cookie', 'accept', 'user-agent', 'x-request-id'];
const FORWARD_RESPONSE = [
  'content-type',
  'retry-after',
  'ratelimit',
  'ratelimit-policy',
  'x-request-id',
  'cache-control',
];

async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const url = new URL(request.url);
  const headers = new Headers();
  for (const name of FORWARD_REQUEST) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-forwarded-for', clientIp(request.headers));

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let upstream: Response;
  try {
    upstream = await fetch(`${apiOrigin()}${API_PREFIX}/${path.join('/')}${url.search}`, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return Response.json(
      {
        type: 'https://doctrack.app/problems/unavailable',
        title: 'Service unavailable',
        status: 503,
        detail: 'The service is not reachable. Try again in a moment.',
        instance: url.pathname,
        code: 'UNAVAILABLE',
        requestId: '',
        retryAfter: 5,
      },
      { status: 503, headers: { 'content-type': 'application/problem+json', 'retry-after': '5' } },
    );
  }

  const out = new Headers();
  for (const name of FORWARD_RESPONSE) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  for (const cookie of upstream.headers.getSetCookie()) out.append('set-cookie', cookie);
  const bodyless = upstream.status === 204 || upstream.status === 304;
  return new Response(bodyless ? null : upstream.body, { status: upstream.status, headers: out });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
