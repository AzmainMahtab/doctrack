import type { Role } from '@doctrack/contracts';
import { v7 as uuidv7 } from 'uuid';
import type { Clock } from '../../../shared/application/index.ts';
import type { PasswordHasher, UserRepository } from '../domain/ports.ts';
import { normalizeEmail, User } from '../domain/user.ts';

export class EnsureUserHandler {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    email: string;
    password: string;
    role: Role;
  }): Promise<'created' | 'exists'> {
    const email = normalizeEmail(input.email);
    if (await this.users.findByEmail(email)) return 'exists';
    await this.users.save(
      new User({
        id: uuidv7(),
        email,
        passwordHash: await this.hasher.hash(input.password),
        role: input.role,
        isActive: true,
        createdAt: this.clock.now(),
      }),
    );
    return 'created';
  }
}
