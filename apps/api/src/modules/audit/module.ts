import type { Db } from 'mongodb';
import type { TransactionContext } from '../../platform/database/index.ts';
import { RecordEvent } from './application/record-event.ts';
import { AuditConsumer } from './infrastructure/audit.consumer.ts';
import { MongoAuditLog } from './infrastructure/mongo-audit-log.ts';

export interface AuditDeps {
  db: Db;
  transactions: TransactionContext;
}

export function createAuditModule(deps: AuditDeps) {
  const log = new MongoAuditLog(deps.db, deps.transactions);
  return { consumers: [new AuditConsumer(new RecordEvent(log))] };
}

export type AuditModule = ReturnType<typeof createAuditModule>;
