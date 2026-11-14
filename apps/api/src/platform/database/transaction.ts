import { AsyncLocalStorage } from 'node:async_hooks';
import type { ClientSession, Db, MongoClient } from 'mongodb';
import { UnitOfWork } from '../../shared/application/index.ts';

export class TransactionContext {
  private readonly storage = new AsyncLocalStorage<ClientSession>();

  current(): ClientSession | undefined {
    return this.storage.getStore();
  }

  run<T>(session: ClientSession, work: () => Promise<T>): Promise<T> {
    return this.storage.run(session, work);
  }
}

export class MongoUnitOfWork extends UnitOfWork {
  constructor(
    private readonly client: MongoClient,
    private readonly context: TransactionContext,
  ) {
    super();
  }

  async withTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.context.current()) return work();
    return this.client.withSession((session) =>
      session.withTransaction(() => this.context.run(session, work), {
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary',
      }),
    );
  }
}

export const sessionOptions = (context: TransactionContext): { session?: ClientSession } => {
  const session = context.current();
  return session ? { session } : {};
};

export abstract class MongoRepository {
  constructor(
    protected readonly db: Db,
    protected readonly context: TransactionContext,
  ) {}

  protected options(): { session?: ClientSession } {
    const session = this.context.current();
    return session ? { session } : {};
  }
}
