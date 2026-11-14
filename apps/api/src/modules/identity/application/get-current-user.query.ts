import type { Me } from '@doctrack/contracts';
import type { CurrentUser } from '../../../shared/auth/index.ts';
import { AppError } from '../../../shared/errors/index.ts';
import type { UserRepository } from '../domain/ports.ts';

export class GetCurrentUserQuery {
  constructor(private readonly users: UserRepository) {}

  async execute(auth: CurrentUser): Promise<Me> {
    const user = await this.users.findById(auth.id);
    if (!user || !user.isActive) throw AppError.unauthenticated();
    return {
      user: { id: user.id, email: user.email, role: user.role },
      permissions: [...auth.permissions],
    };
  }
}
