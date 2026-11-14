import type { AuditLog } from '../domain/ports.ts';

export interface RecordableEvent {
  id: string;
  name: string;
  aggregateId: string;
  actorId: string | null;
  correlationId: string | null;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export class RecordEvent {
  constructor(private readonly log: AuditLog) {}

  async execute(event: RecordableEvent): Promise<void> {
    const actorId = event.actorId ?? (event.name.startsWith('user.') ? event.aggregateId : null);
    await this.log.append({
      id: event.id,
      eventType: event.name,
      aggregateId: event.aggregateId,
      actorId,
      correlationId: event.correlationId,
      occurredAt: new Date(event.occurredAt),
      payload: event.payload,
    });
  }
}
