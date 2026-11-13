import type { DomainEvent } from '../domain/index.ts';

export abstract class EventBus {
  abstract publish(event: DomainEvent): Promise<void>;
  abstract publishAll(events: readonly DomainEvent[]): Promise<void>;
}
