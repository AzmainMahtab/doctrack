import type { EventEnvelope } from '@doctrack/contracts';
import { DurableEventHandler } from '../../../platform/messaging/index.ts';
import type { ProjectEvent } from '../application/index.ts';
import type { DashboardCache } from '../domain/ports.ts';

export class AnalyticsProjectionConsumer extends DurableEventHandler {
  readonly consumerName = 'analytics-projection';
  readonly subjects = [
    'doctor.registered',
    'patient.registered',
    'patient.removed',
    'patient.condition_changed',
  ];

  constructor(
    private readonly project: ProjectEvent,
    private readonly cache: DashboardCache,
  ) {
    super();
  }

  handle(event: EventEnvelope): Promise<void> {
    return this.project.execute(event);
  }

  override afterCommit(): Promise<void> {
    return this.cache.invalidate();
  }
}
