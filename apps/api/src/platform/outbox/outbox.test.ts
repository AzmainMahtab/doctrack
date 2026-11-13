import { EventEnvelopeSchema } from '@doctrack/contracts';
import { describe, expect, it } from 'vitest';
import { retryDelayMs, toEnvelope, type OutboxDoc } from './outbox.ts';

const doc: OutboxDoc = {
  _id: '0190a3d4-7c1e-7a2b-8f3e-1234567890ab',
  type: 'patient.registered',
  aggregateId: 'p-1',
  payload: { name: 'Ada' },
  meta: {
    correlationId: 'req-1',
    occurredAt: new Date('2026-11-14T10:00:00Z'),
    version: 1,
    actorId: null,
  },
  status: 'pending',
  attempts: 0,
  leaseUntil: null,
  claimToken: null,
  publishedAt: null,
};

describe('retryDelayMs', () => {
  it('doubles from the base and caps', () => {
    expect(retryDelayMs(0)).toBe(500);
    expect(retryDelayMs(1)).toBe(1000);
    expect(retryDelayMs(3)).toBe(4000);
    expect(retryDelayMs(30)).toBe(60_000);
  });
});

describe('toEnvelope', () => {
  it('produces a valid wire envelope', () => {
    const envelope = toEnvelope(doc);
    expect(EventEnvelopeSchema.parse(envelope)).toEqual({
      id: doc._id,
      name: 'patient.registered',
      version: 1,
      aggregateId: 'p-1',
      occurredAt: '2026-11-14T10:00:00.000Z',
      correlationId: 'req-1',
      payload: { name: 'Ada' },
    });
  });
});

describe('EventEnvelopeSchema', () => {
  it('rejects a malformed envelope', () => {
    expect(EventEnvelopeSchema.safeParse({ id: 'x' }).success).toBe(false);
    expect(
      EventEnvelopeSchema.safeParse({ ...toEnvelope(doc), occurredAt: 'yesterday' }).success,
    ).toBe(false);
  });
});
