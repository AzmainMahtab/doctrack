import { createAuditModule } from '../../modules/audit/index.ts';
import { ConsumerRunner } from '../messaging/index.ts';
import { OutboxRelay } from '../outbox/index.ts';
import type { Harness } from './harness.ts';
import { waitFor } from './harness.ts';
import { API, Client, PASSWORD, signIn } from './http-helpers.ts';
import { createIdentityApp } from './identity-app.ts';

export type DomainApp = Awaited<ReturnType<typeof createIdentityApp>>;

export interface Actors {
  built: DomainApp;
  admin: Client;
  viewer: Client;
  anonymous: Client;
  adminId: string;
  audit: ReturnType<typeof createAuditModule>;
}

export async function setupDomain(h: Harness): Promise<Actors> {
  const built = await createIdentityApp(h, {
    policies: {
      'user-write': { name: 'user-write', limit: 100_000, windowSeconds: 60 },
      'user-read': { name: 'user-read', limit: 100_000, windowSeconds: 60 },
      'ip-global': { name: 'ip-global', limit: 100_000, windowSeconds: 60 },
    },
  });
  await built.identity.ensureUser.execute({
    email: 'admin@t.dev',
    password: PASSWORD,
    role: 'admin',
  });
  await built.identity.ensureUser.execute({
    email: 'viewer@t.dev',
    password: PASSWORD,
    role: 'viewer',
  });
  const admin = new Client(built.app, await signIn(built.app, 'admin@t.dev'));
  const viewer = new Client(built.app, await signIn(built.app, 'viewer@t.dev'));
  const me = await admin.get(`${API}/auth/me`);
  return {
    built,
    admin,
    viewer,
    anonymous: new Client(built.app),
    adminId: me.body.data.user.id as string,
    audit: createAuditModule({ db: h.mongo.db, transactions: h.transactions }),
  };
}

export function startPipeline(h: Harness, actors: Actors) {
  const relay = new OutboxRelay(h.mongo.db, h.publisher, h.topology, h.logger, { pollMs: 100 });
  const runner = new ConsumerRunner({
    connection: h.nats.connection,
    jsm: h.nats.jsm,
    db: h.mongo.db,
    uow: h.uow,
    context: h.transactions,
    logger: h.logger,
    topology: h.topology,
    handlers: [
      ...actors.built.doctors.consumers,
      ...actors.built.analytics.consumers,
      ...actors.audit.consumers,
    ],
    options: { maxDeliver: 3, backoffMs: [100, 100], ackWaitMs: 10_000 },
  });
  return {
    relay,
    runner,
    async start() {
      await runner.start();
      relay.start();
    },
    async stop() {
      await relay.stop();
      await runner.stop();
    },
  };
}

export async function consumersIdle(h: Harness, names: string[]): Promise<boolean> {
  const unpublished = await h.mongo.db
    .collection('outbox')
    .countDocuments({ status: { $in: ['pending', 'claimed'] } });
  if (unpublished > 0) return false;
  for (const name of names) {
    const info = await h.nats.jsm.consumers.info(h.topology.eventsStream, name);
    if (info.num_pending + info.num_ack_pending > 0) return false;
  }
  return true;
}

export const ALL_CONSUMERS = ['doctors-patient-count', 'analytics-projection', 'audit-log'];

export async function settle(h: Harness, actors: Actors): Promise<void> {
  await waitFor(
    async () =>
      (await consumersIdle(h, ALL_CONSUMERS)) &&
      (await actors.built.analytics.reconcile.verify()).consistent,
    20_000,
  );
}
