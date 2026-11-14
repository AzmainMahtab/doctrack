import { randomBytes } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';

export const PASSWORD = 'correct-horse-battery';
export const API = '/api/v1';

export const randomIp = (): string =>
  `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}`;

export const cookiesOf = (res: request.Response): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const line of (res.headers['set-cookie'] as unknown as string[] | undefined) ?? []) {
    const [pair] = line.split(';');
    const [name, ...rest] = (pair ?? '').split('=');
    if (name) out[name] = rest.join('=');
  }
  return out;
};

export const cookieHeader = (jar: Record<string, string>): string =>
  Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

export async function signIn(app: Express, email: string): Promise<string> {
  const res = await request(app)
    .post(`${API}/auth/login`)
    .set('X-Forwarded-For', randomIp())
    .send({ email, password: PASSWORD });
  if (res.status !== 200)
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return cookieHeader(cookiesOf(res));
}

export class Client {
  constructor(
    private readonly app: Express,
    private readonly cookie?: string,
  ) {}

  private with(test: request.Test): request.Test {
    test.set('X-Forwarded-For', randomIp());
    return this.cookie ? test.set('Cookie', this.cookie) : test;
  }

  get(path: string) {
    return this.with(request(this.app).get(path));
  }
  post(path: string) {
    return this.with(request(this.app).post(path));
  }
  patch(path: string) {
    return this.with(request(this.app).patch(path));
  }
  delete(path: string) {
    return this.with(request(this.app).delete(path));
  }
}
