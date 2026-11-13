import type { Collection, Db } from 'mongodb';
import { sessionOptions, type TransactionContext } from '../../../platform/database/index.ts';
import { UserRepository } from '../domain/ports.ts';
import { User, type UserProps } from '../domain/user.ts';

export const USERS = 'users';

export interface UserDoc {
  _id: string;
  email: string;
  passwordHash: string;
  role: UserProps['role'];
  isActive: boolean;
  createdAt: Date;
}

const toUser = (doc: UserDoc): User =>
  new User({
    id: doc._id,
    email: doc.email,
    passwordHash: doc.passwordHash,
    role: doc.role,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
  });

export class MongoUserRepository extends UserRepository {
  private readonly users: Collection<UserDoc>;

  constructor(
    db: Db,
    private readonly context: TransactionContext,
  ) {
    super();
    this.users = db.collection<UserDoc>(USERS);
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await this.users.findOne({ email }, sessionOptions(this.context));
    return doc ? toUser(doc) : null;
  }

  async findById(id: string): Promise<User | null> {
    const doc = await this.users.findOne({ _id: id }, sessionOptions(this.context));
    return doc ? toUser(doc) : null;
  }

  async save(user: User): Promise<void> {
    const s = user.snapshot();
    await this.users.replaceOne(
      { _id: s.id },
      {
        email: s.email,
        passwordHash: s.passwordHash,
        role: s.role,
        isActive: s.isActive,
        createdAt: s.createdAt,
      },
      { upsert: true, ...sessionOptions(this.context) },
    );
  }
}
