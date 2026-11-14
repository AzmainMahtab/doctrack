import { z } from '../openapi.ts';

export const EventEnvelopeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.number().int().min(1),
  aggregateId: z.string().min(1),
  occurredAt: z.iso.datetime(),
  correlationId: z.string().nullable(),
  actorId: z.string().nullable().default(null),
  payload: z.record(z.string(), z.unknown()),
});

export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
