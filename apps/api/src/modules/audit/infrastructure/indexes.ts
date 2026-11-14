import { registerIndexes } from '../../../platform/database/index.ts';
import { AUDIT_LOG } from './mongo-audit-log.ts';

const ONE_YEAR_S = 365 * 24 * 60 * 60;

registerIndexes({
  collection: AUDIT_LOG,
  indexes: [
    { key: { aggregateId: 1, occurredAt: -1 }, name: 'aggregate_time' },
    { key: { occurredAt: -1 }, name: 'time' },
    { key: { occurredAt: 1 }, name: 'retention_ttl', expireAfterSeconds: ONE_YEAR_S },
  ],
});
