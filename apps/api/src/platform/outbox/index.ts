import { registerIndexes } from '../database/index.ts';
import { OUTBOX, outboxIndexes } from './outbox.ts';

registerIndexes({ collection: OUTBOX, indexes: outboxIndexes });

export * from './outbox.ts';
export * from './outbox-event-bus.ts';
export * from './relay.ts';
