import type { Collection, Db } from 'mongodb';
import { EventBus } from '../../shared/application/index.ts';
import type { DomainEvent } from '../../shared/domain/index.ts';
import type { TransactionContext } from '../database/index.ts';
import { requestContext } from '../logger/index.ts';
import { OUTBOX, type OutboxDoc } from './outbox.ts';

export class OutboxEventBus extends EventBus {
  private readonly collection: Collection<OutboxDoc>;

  constructor(
    db: Db,
    private readonly context: TransactionContext,
  ) {
    super();
    this.collection = db.collection<OutboxDoc>(OUTBOX);
  }

  publish(event: DomainEvent): Promise<void> {
    return this.publishAll([event]);
  }

  async publishAll(events: readonly DomainEvent[]): Promise<void> {
    if (events.length === 0) return;
    const session = this.context.current();
    if (!session) {
      throw new Error(
        'Events must be published inside a transaction (UnitOfWork.withTransaction).',
      );
    }
    const correlationId = requestContext.requestId() ?? null;
    const actorId = requestContext.actorId() ?? null;
    await this.collection.insertMany(
      events.map((event): OutboxDoc => ({
        _id: event.id,
        type: event.name,
        aggregateId: event.aggregateId,
        payload: event.payload,
        meta: {
          correlationId,
          occurredAt: event.occurredAt,
          version: event.version,
          actorId,
        },
        status: 'pending',
        attempts: 0,
        leaseUntil: null,
        claimToken: null,
        publishedAt: null,
      })),
      { session },
    );
  }
}
