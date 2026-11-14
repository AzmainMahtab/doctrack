import { deltaFor } from '../domain/model.ts';
import type { AnalyticsRepository } from '../domain/ports.ts';

export class ProjectEvent {
  constructor(private readonly repository: AnalyticsRepository) {}

  async execute(event: { name: string; payload: Record<string, unknown> }): Promise<void> {
    const delta = deltaFor(event);
    if (delta) await this.repository.apply(delta);
  }
}
