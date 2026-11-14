import type { Clock, EventBus, UnitOfWork } from '../../../shared/application/index.ts';
import { AppError } from '../../../shared/errors/index.ts';
import { UserDeactivated } from '../domain/events.ts';
import type { TokenBlacklist, UserRepository } from '../domain/ports.ts';
import type { AuthSettings } from './settings.ts';

export class DeactivateUserHandler {
  constructor(
    private readonly users: UserRepository,
    private readonly blacklist: TokenBlacklist,
    private readonly uow: UnitOfWork,
    private readonly eventBus: EventBus,
    private readonly clock: Clock,
    private readonly settings: AuthSettings,
  ) {}

  async execute(input: { userId: string }): Promise<void> {
    const user = await this.users.findById(input.userId);
    if (!user) throw AppError.notFound('User not found.');
    user.deactivate();
    await this.uow.withTransaction(async () => {
      await this.users.save(user);
      await this.eventBus.publish(new UserDeactivated(user.id, {}));
    });
    await this.blacklist.revokeUserBefore(
      user.id,
      this.clock.now(),
      this.settings.refreshTtlSeconds,
    );
  }
}
