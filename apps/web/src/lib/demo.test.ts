import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoAccounts } from './demo';

describe('demoAccounts', () => {
  afterEach(() => vi.unstubAllEnvs());

  const configure = (mode: string) => {
    vi.stubEnv('DEMO_MODE', mode);
    vi.stubEnv('SEED_ADMIN_EMAIL', 'admin@x.dev');
    vi.stubEnv('SEED_ADMIN_PASSWORD', 'admin-pass-123');
    vi.stubEnv('SEED_VIEWER_EMAIL', 'viewer@x.dev');
    vi.stubEnv('SEED_VIEWER_PASSWORD', 'viewer-pass-123');
  };

  it('offers nothing unless demo mode is on', () => {
    configure('false');
    expect(demoAccounts()).toEqual([]);
    configure('');
    expect(demoAccounts()).toEqual([]);
  });

  it('lists admin then viewer with their seeded credentials', () => {
    configure('true');
    expect(demoAccounts().map((a) => [a.role, a.email, a.password])).toEqual([
      ['admin', 'admin@x.dev', 'admin-pass-123'],
      ['viewer', 'viewer@x.dev', 'viewer-pass-123'],
    ]);
  });

  it('skips a role whose credentials are not configured', () => {
    configure('true');
    vi.stubEnv('SEED_VIEWER_PASSWORD', '');
    expect(demoAccounts().map((a) => a.role)).toEqual(['admin']);
  });
});
