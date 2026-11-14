import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/server.ts',
    'src/worker.ts',
    'src/migrate.ts',
    'src/seed.ts',
    'src/rebuild-analytics.ts',
  ],
  format: ['esm'],
  target: 'node24',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@doctrack/contracts'],
});
