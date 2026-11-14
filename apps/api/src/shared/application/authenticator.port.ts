import type { CurrentUser } from '../auth/index.ts';

export abstract class Authenticator {
  abstract authenticate(accessToken: string): Promise<CurrentUser>;
}
