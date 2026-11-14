import { DomainEvent } from '../../../shared/domain/index.ts';

export class UserLoggedIn extends DomainEvent<{ role: string }> {
  readonly name = 'user.logged_in';
}

export class UserDeactivated extends DomainEvent<Record<string, never>> {
  readonly name = 'user.deactivated';
}
