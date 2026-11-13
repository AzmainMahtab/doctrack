import type { DomainEvent } from './domain-event.ts';

export abstract class AggregateRoot {
  private pending: DomainEvent[] = [];

  protected record(event: DomainEvent): void {
    this.pending.push(event);
  }

  pullEvents(): DomainEvent[] {
    const events = this.pending;
    this.pending = [];
    return events;
  }
}
