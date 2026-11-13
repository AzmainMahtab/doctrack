import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.int.test.ts'], testTimeout: 30000, hookTimeout: 60000 },
});
