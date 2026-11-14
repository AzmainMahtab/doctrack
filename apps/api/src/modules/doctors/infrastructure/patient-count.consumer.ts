import type { EventEnvelope } from '@doctrack/contracts';
import { DurableEventHandler } from '../../../platform/messaging/index.ts';
import type { ApplyPatientCountChange } from '../application/index.ts';

export class PatientCountConsumer extends DurableEventHandler {
  readonly consumerName = 'doctors-patient-count';
  readonly subjects = ['patient.registered', 'patient.removed'];

  constructor(private readonly apply: ApplyPatientCountChange) {
    super();
  }

  handle(event: EventEnvelope): Promise<void> {
    return this.apply.execute(event);
  }
}
