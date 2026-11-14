import { DomainEvent } from '../../../shared/domain/index.ts';

export class UserLoggedIn extends DomainEvent<{ email: string; role: string }> {
  readonly name = 'user.logged_in';
}

export class UserDeactivated extends DomainEvent<{ email: string }> {
  readonly name = 'user.deactivated';
}
