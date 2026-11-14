import type { Role } from '@doctrack/contracts';

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}

export class User {
  constructor(private props: UserProps) {}

  get id(): string {
    return this.props.id;
  }
  get email(): string {
    return this.props.email;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get role(): Role {
    return this.props.role;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  deactivate(): void {
    this.props = { ...this.props, isActive: false };
  }

  snapshot(): UserProps {
    return { ...this.props };
  }
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
