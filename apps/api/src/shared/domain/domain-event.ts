import { v7 as uuidv7 } from 'uuid';

export abstract class DomainEvent<P extends Record<string, unknown> = Record<string, unknown>> {
  readonly id: string = uuidv7();
  readonly occurredAt: Date = new Date();
  readonly version: number = 1;
  abstract readonly name: string;

  constructor(
    readonly aggregateId: string,
    readonly payload: P,
  ) {}
}
