import { registerIndexes } from '../database/index.ts';

export const PROCESSED_EVENTS_COLLECTION = 'processed_events';

const THIRTY_DAYS_S = 30 * 24 * 60 * 60;

registerIndexes({
  collection: PROCESSED_EVENTS_COLLECTION,
  indexes: [
    { key: { consumer: 1, eventId: 1 }, name: 'consumer_event', unique: true },
    { key: { processedAt: 1 }, name: 'processed_ttl', expireAfterSeconds: THIRTY_DAYS_S },
  ],
});
