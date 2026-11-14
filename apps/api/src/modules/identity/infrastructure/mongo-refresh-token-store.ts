import type { Collection, Db } from 'mongodb';
import { sessionOptions, type TransactionContext } from '../../../platform/database/index.ts';
import { RefreshTokenStore, type RefreshRecord, type RotateOutcome } from '../domain/ports.ts';

export const REFRESH_TOKENS = 'refresh_tokens';

export interface RefreshDoc {
  _id: string;
  userId: string;
  familyId: string;
  rotatedAt: Date | null;
  expiresAt: Date;
}

export class MongoRefreshTokenStore extends RefreshTokenStore {
  private readonly tokens: Collection<RefreshDoc>;

  constructor(
    db: Db,
    private readonly context: TransactionContext,
  ) {
    super();
    this.tokens = db.collection<RefreshDoc>(REFRESH_TOKENS);
  }

  async insert(record: RefreshRecord): Promise<void> {
    await this.tokens.insertOne(
      {
        _id: record.id,
        userId: record.userId,
        familyId: record.familyId,
        rotatedAt: null,
        expiresAt: record.expiresAt,
      },
      sessionOptions(this.context),
    );
  }

  async rotate(id: string, at: Date): Promise<RotateOutcome> {
    const options = sessionOptions(this.context);
    const rotated = await this.tokens.updateOne(
      { _id: id, rotatedAt: null },
      { $set: { rotatedAt: at } },
      options,
    );
    if (rotated.modifiedCount === 1) return 'rotated';
    const existing = await this.tokens.findOne({ _id: id }, options);
    return existing ? 'reused' : 'missing';
  }
}
