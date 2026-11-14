import type { Collection, Db } from 'mongodb';
import { sessionOptions, type TransactionContext } from '../../../platform/database/index.ts';
import { AuditLog, type AuditEntry } from '../domain/ports.ts';

export const AUDIT_LOG = 'audit_log';

interface AuditDoc {
  _id: string;
  eventType: string;
  aggregateId: string;
  actorId: string | null;
  correlationId: string | null;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export class MongoAuditLog extends AuditLog {
  private readonly entries: Collection<AuditDoc>;

  constructor(
    db: Db,
    private readonly context: TransactionContext,
  ) {
    super();
    this.entries = db.collection<AuditDoc>(AUDIT_LOG);
  }

  async append(entry: AuditEntry): Promise<void> {
    const { id, ...rest } = entry;
    await this.entries.replaceOne({ _id: id }, rest, {
      upsert: true,
      ...sessionOptions(this.context),
    });
  }
}
