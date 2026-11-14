import { createContainer } from './container.ts';
import { createAnalyticsModule } from './modules/analytics/index.ts';
import { createDoctorsModule } from './modules/doctors/index.ts';
import { createPatientsModule } from './modules/patients/index.ts';
import { OUTBOX } from './platform/outbox/index.ts';
import { defaultTopology } from './platform/messaging/index.ts';
import './register-indexes.ts';

const IDLE_TIMEOUT_MS = 30_000;
const CONSUMER = 'analytics-projection';

async function main(): Promise<void> {
  const checkOnly = process.argv.includes('--check');
  const container = await createContainer('worker');
  const { mongo, nats, redis } = container;

  const domain = {
    db: mongo.db,
    transactions: container.transactions,
    uow: container.uow,
    eventBus: container.eventBus,
    clock: container.clock,
  };
  const doctors = createDoctorsModule(domain);
  const patients = createPatientsModule({ ...domain, doctors: doctors.api });
  const analytics = createAnalyticsModule({
    db: mongo.db,
    redis: redis.client,
    transactions: container.transactions,
    uow: container.uow,
    clock: container.clock,
    doctors: doctors.api,
    patients: patients.api,
  });

  const isIdle = async (): Promise<boolean> => {
    const unpublished = await mongo.db
      .collection(OUTBOX)
      .countDocuments({ status: { $in: ['pending', 'claimed'] } });
    if (unpublished > 0) return false;
    try {
      const info = await nats.jsm.consumers.info(defaultTopology.eventsStream, CONSUMER);
      return info.num_pending + info.num_ack_pending === 0;
    } catch {
      return true;
    }
  };

  const deadline = Date.now() + IDLE_TIMEOUT_MS;
  while (!(await isIdle())) {
    if (Date.now() > deadline) {
      throw new Error('Events are still in flight; try again when the system is quiet.');
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const drift = checkOnly
    ? await analytics.reconcile.verify()
    : await analytics.reconcile.rebuild();
  if (!checkOnly) await analytics.cache.invalidate();

  console.log(
    drift.consistent
      ? `analytics projection ${checkOnly ? 'matches' : 'already matched'} the source data`
      : `analytics projection ${checkOnly ? 'differs from' : 'was repaired against'} the source data:`,
  );
  for (const line of drift.differences) console.log(`  - ${line}`);
  for (const closer of container.closers) await closer.close();
  if (checkOnly && !drift.consistent) process.exit(2);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
