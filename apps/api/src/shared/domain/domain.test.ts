import { describe, expect, it } from 'vitest';
import { AggregateRoot } from './aggregate-root.ts';
import { DomainEvent } from './domain-event.ts';

class Happened extends DomainEvent {
  readonly name = 'thing.happened';
}

class Thing extends AggregateRoot {
  happen(n: number): void {
    this.record(new Happened('thing-1', { n }));
  }
}

describe('DomainEvent', () => {
  it('gets a time-ordered id and a timestamp', () => {
    const ids = Array.from({ length: 50 }, () => new Happened('a', {}).id);
    expect([...ids].sort()).toEqual(ids);
    expect(new Happened('a', {}).occurredAt).toBeInstanceOf(Date);
    expect(new Happened('a', {}).version).toBe(1);
  });
});

describe('AggregateRoot', () => {
  it('collects events and clears them when pulled', () => {
    const thing = new Thing();
    thing.happen(1);
    thing.happen(2);
    const events = thing.pullEvents();
    expect(events.map((e) => e.payload)).toEqual([{ n: 1 }, { n: 2 }]);
    expect(thing.pullEvents()).toEqual([]);
  });
});
