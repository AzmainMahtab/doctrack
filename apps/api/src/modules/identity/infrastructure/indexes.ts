import { registerIndexes } from '../../../platform/database/index.ts';
import { REFRESH_TOKENS } from './mongo-refresh-token-store.ts';
import { USERS } from './mongo-user-repository.ts';

registerIndexes({
  collection: USERS,
  indexes: [{ key: { email: 1 }, name: 'email_unique', unique: true }],
});
registerIndexes({
  collection: REFRESH_TOKENS,
  indexes: [
    { key: { userId: 1 }, name: 'user' },
    { key: { familyId: 1 }, name: 'family' },
    { key: { expiresAt: 1 }, name: 'expires_ttl', expireAfterSeconds: 0 },
  ],
});
