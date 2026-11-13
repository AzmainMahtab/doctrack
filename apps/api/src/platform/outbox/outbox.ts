import type { EventEnvelope } from '@doctrack/contracts';
import type { IndexDescription } from 'mongodb';

export const OUTBOX = 'outbox';

export type OutboxStatus = 'pending' | 'claimed' | 'published';

export interface OutboxDoc {
  _id: string;
  type: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  meta: {
    correlationId: string | null;
    occurredAt: Date;
    version: number;
    actorId: string | null;
  };
  status: OutboxStatus;
  attempts: number;
  leaseUntil: Date | null;
  claimToken: string | null;
  publishedAt: Date | null;
}

export const toEnvelope = (doc: OutboxDoc): EventEnvelope => ({
  id: doc._id,
  name: doc.type,
  version: doc.meta.version,
  aggregateId: doc.aggregateId,
  occurredAt: doc.meta.occurredAt.toISOString(),
  correlationId: doc.meta.correlationId,
  payload: doc.payload,
});

const SEVEN_DAYS_S = 7 * 24 * 60 * 60;

export const outboxIndexes: IndexDescription[] = [
  { key: { status: 1, _id: 1 }, name: 'status_id' },
  {
    key: { leaseUntil: 1 },
    name: 'lease_claimed',
    partialFilterExpression: { status: 'claimed' },
  },
  {
    key: { publishedAt: 1 },
    name: 'published_ttl',
    expireAfterSeconds: SEVEN_DAYS_S,
    partialFilterExpression: { status: 'published' },
  },
];

export const retryDelayMs = (attempts: number, maxMs = 60_000, baseMs = 500): number =>
  Math.min(maxMs, baseMs * 2 ** Math.max(0, attempts));
