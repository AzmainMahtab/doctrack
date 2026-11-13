import { generateKeyPairSync } from 'node:crypto';
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { Argon2Hasher } from './infrastructure/argon2-hasher.ts';
import { JoseTokenService } from './infrastructure/jose-token-service.ts';
import { PERMISSIONS, permissionsFor, ROLE_PERMISSIONS } from './domain/permissions.ts';
import { User } from './domain/user.ts';

const pem = () =>
  generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({
    type: 'pkcs8',
    format: 'pem',
  }) as string;

const user = new User({
  id: 'u-1',
  email: 'a@example.com',
  passwordHash: 'x',
  role: 'viewer',
  isActive: true,
  createdAt: new Date(),
});

const settings = { accessTtlSeconds: 900, refreshTtlSeconds: 604800 };

describe('role permissions', () => {
  it('gives admin everything and viewer read-only access', () => {
    expect(ROLE_PERMISSIONS.admin).toEqual(PERMISSIONS);
    expect(permissionsFor('viewer')).toEqual(['doctors:read', 'patients:read', 'dashboard:read']);
    expect(permissionsFor('viewer').some((p) => p.endsWith(':write'))).toBe(false);
  });

  it('gives an unknown role nothing', () => {
    expect(permissionsFor('root')).toEqual([]);
  });
});

describe('JoseTokenService', () => {
  it('issues an ES256 access token carrying sub, jti, sid, role and typ', async () => {
    const service = new JoseTokenService(pem(), settings);
    const issued = await service.issueAccess(user, 'sess-1');
    const header = JSON.parse(
      Buffer.from(issued.token.split('.')[0] ?? '', 'base64url').toString(),
    );
    expect(header.alg).toBe('ES256');
    const claims = await service.parseAccess(issued.token);
    expect(claims).toMatchObject({ sub: 'u-1', sid: 'sess-1', role: 'viewer', jti: issued.jti });
    expect(claims.exp - claims.iat).toBe(900);
  });

  it('refuses a refresh token as an access token and the reverse', async () => {
    const service = new JoseTokenService(pem(), settings);
    const access = await service.issueAccess(user, 's');
    const refresh = await service.issueRefresh('u-1', 's');
    await expect(service.parseAccess(refresh.token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await expect(service.parseRefresh(access.token)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('refuses a token signed by another key', async () => {
    const mine = new JoseTokenService(pem(), settings);
    const theirs = new JoseTokenService(pem(), settings);
    const token = (await theirs.issueAccess(user, 's')).token;
    await expect(mine.parseAccess(token)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('refuses an unsigned or HS256 token', async () => {
    const service = new JoseTokenService(pem(), settings);
    const hs = await new SignJWT({ typ: 'access', sid: 's', role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u-1')
      .setJti('j')
      .setIssuer('doctrack')
      .setAudience('doctrack-api')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('secret-secret-secret-secret-123456'));
    await expect(service.parseAccess(hs)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{}').toString('base64url')}.`;
    await expect(service.parseAccess(none)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('refuses a token for another audience', async () => {
    const key = pem();
    const other = new JoseTokenService(key, { ...settings, audience: 'someone-else' });
    const service = new JoseTokenService(key, settings);
    await expect(
      service.parseAccess((await other.issueAccess(user, 's')).token),
    ).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});

describe('Argon2Hasher', () => {
  const hasher = new Argon2Hasher();

  it('hashes with argon2id and verifies', async () => {
    const hash = await hasher.hash('correct-horse-battery');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await hasher.verify(hash, 'correct-horse-battery')).toBe(true);
    expect(await hasher.verify(hash, 'wrong')).toBe(false);
  });

  it('treats a malformed hash as a failed verification', async () => {
    expect(await hasher.verify('not-a-hash', 'anything')).toBe(false);
  });
});
