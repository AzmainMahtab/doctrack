import type { EventEnvelope } from '@doctrack/contracts';
import { DurableEventHandler } from '../../../platform/messaging/index.ts';
import type { RecordEvent } from '../application/record-event.ts';

export class AuditConsumer extends DurableEventHandler {
  readonly consumerName = 'audit-log';
  readonly subjects = ['>'];

  constructor(private readonly record: RecordEvent) {
    super();
  }

  handle(event: EventEnvelope): Promise<void> {
    return this.record.execute(event);
  }
}
