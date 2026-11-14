export interface AuditEntry {
  id: string;
  eventType: string;
  aggregateId: string;
  actorId: string | null;
  correlationId: string | null;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export abstract class AuditLog {
  abstract append(entry: AuditEntry): Promise<void>;
}
