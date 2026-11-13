const FRAMEWORK =
  'node_modules/(express|mongodb|ioredis|pino|helmet|swagger-ui-express|@nats-io/[^/]+|@asteasolutions/[^/]+)/';

module.exports = {
  forbidden: [
    {
      name: 'pure-core-no-framework',
      comment: 'shared/ and domain/ import no framework package',
      severity: 'error',
      from: { path: '^apps/api/src/(shared|modules/[^/]+/domain)/' },
      to: { path: FRAMEWORK },
    },
    {
      name: 'no-platform-from-core',
      severity: 'error',
      from: { path: '^apps/api/src/(shared|modules/[^/]+/(domain|application))/' },
      to: { path: '^apps/api/src/platform/' },
    },
    {
      name: 'domain-inward',
      severity: 'error',
      from: { path: '^apps/api/src/modules/[^/]+/domain/' },
      to: { path: '^apps/api/src/modules/[^/]+/(application|infrastructure|presentation)/' },
    },
    {
      name: 'application-inward',
      severity: 'error',
      from: { path: '^apps/api/src/modules/[^/]+/application/' },
      to: { path: '^apps/api/src/modules/[^/]+/(infrastructure|presentation)/' },
    },
    {
      name: 'module-boundary',
      comment: 'a module is reached only through its index.ts',
      severity: 'error',
      from: { path: '^apps/api/src/modules/([^/]+)/' },
      to: {
        path: '^apps/api/src/modules/[^/]+/',
        pathNot: ['^apps/api/src/modules/$1/', '^apps/api/src/modules/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'shared-not-from-platform-or-modules',
      severity: 'error',
      from: { path: '^apps/api/src/shared/' },
      to: { path: '^apps/api/src/(platform|modules)/' },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    tsConfig: { fileName: 'apps/api/tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.test\\.ts$' },
  },
};
