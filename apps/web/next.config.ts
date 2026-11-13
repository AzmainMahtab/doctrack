import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  transpilePackages: ['@doctrack/contracts'],
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
};

export default config;
