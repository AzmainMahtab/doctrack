import { describe, expect, it } from 'vitest';
import { AuditLog, type AuditEntry } from '../domain/ports.ts';
import { RecordEvent } from './record-event.ts';

class Memory extends AuditLog {
  entries: AuditEntry[] = [];
  async append(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

const event = (over: Record<string, unknown> = {}) => ({
  id: 'e-1',
  name: 'patient.registered',
  aggregateId: 'p-1',
  actorId: 'admin-1',
  correlationId: 'req-1',
  occurredAt: '2026-11-14T10:00:00.000Z',
  payload: { doctorId: 'd-1' },
  ...over,
});

describe('RecordEvent', () => {
  it('records the event with its actor and time', async () => {
    const log = new Memory();
    await new RecordEvent(log).execute(event());
    expect(log.entries[0]).toEqual({
      id: 'e-1',
      eventType: 'patient.registered',
      aggregateId: 'p-1',
      actorId: 'admin-1',
      correlationId: 'req-1',
      occurredAt: new Date('2026-11-14T10:00:00.000Z'),
      payload: { doctorId: 'd-1' },
    });
  });

  it('attributes user events to the user when no actor is known', async () => {
    const log = new Memory();
    await new RecordEvent(log).execute(
      event({ name: 'user.logged_in', aggregateId: 'u-9', actorId: null }),
    );
    expect(log.entries[0]?.actorId).toBe('u-9');
  });

  it('leaves the actor empty for other events without one', async () => {
    const log = new Memory();
    await new RecordEvent(log).execute(event({ actorId: null }));
    expect(log.entries[0]?.actorId).toBeNull();
  });
});
