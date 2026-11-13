import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.ts';

const valid = {
  MONGO_URI: 'mongodb://localhost:27017',
  REDIS_URL: 'redis://localhost:6379',
  NATS_URL: 'nats://localhost:4222',
};

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig(valid);
    expect(config).toMatchObject({
      port: 8080,
      mongoDb: 'doctrack',
      trustProxyHops: 1,
      env: 'development',
    });
  });

  it('lists every missing variable', () => {
    try {
      loadConfig({});
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const issues = (error as ConfigError).issues.join('\n');
      expect(issues).toContain('MONGO_URI');
      expect(issues).toContain('REDIS_URL');
      expect(issues).toContain('NATS_URL');
    }
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ ...valid, PORT: '99999' })).toThrow(ConfigError);
  });
});
