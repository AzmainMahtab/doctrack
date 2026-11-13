import type { JetStreamManager } from '@nats-io/jetstream';
import type { Db } from 'mongodb';
import { Gauge, Registry } from 'prom-client';
import { OUTBOX, type OutboxDoc } from '../outbox/index.ts';
import type { OutboxRelay } from '../outbox/index.ts';
import type { Topology } from '../messaging/index.ts';

export interface MetricsDeps {
  db: Db;
  jsm: JetStreamManager;
  topology: Topology;
  relay: OutboxRelay;
  consumers: readonly string[];
}

export function createMetrics(deps: MetricsDeps): Registry {
  const registry = new Registry();
  const outbox = deps.db.collection<OutboxDoc>(OUTBOX);
  const unpublished = { status: { $in: ['pending', 'claimed'] as OutboxDoc['status'][] } };

  new Gauge({
    name: 'doctrack_outbox_pending',
    help: 'Outbox rows not yet published',
    registers: [registry],
    async collect() {
      this.set(await outbox.countDocuments(unpublished));
    },
  });

  new Gauge({
    name: 'doctrack_outbox_oldest_pending_age_seconds',
    help: 'Age of the oldest unpublished outbox row',
    registers: [registry],
    async collect() {
      const oldest = await outbox.findOne(unpublished, { sort: { _id: 1 } });
      this.set(oldest ? Math.max(0, (Date.now() - oldest.meta.occurredAt.getTime()) / 1000) : 0);
    },
  });

  new Gauge({
    name: 'doctrack_outbox_published_total',
    help: 'Outbox rows published by this relay since it started',
    registers: [registry],
    collect() {
      this.set(deps.relay.publishedCount);
    },
  });

  new Gauge({
    name: 'doctrack_consumer_pending',
    help: 'Messages waiting for or being processed by a durable consumer',
    labelNames: ['consumer'],
    registers: [registry],
    async collect() {
      for (const consumer of deps.consumers) {
        const info = await deps.jsm.consumers.info(deps.topology.eventsStream, consumer);
        this.set({ consumer }, info.num_pending + info.num_ack_pending);
      }
    },
  });

  new Gauge({
    name: 'doctrack_dlq_messages',
    help: 'Messages in the dead-letter stream',
    registers: [registry],
    async collect() {
      const info = await deps.jsm.streams.info(deps.topology.dlqStream);
      this.set(info.state.messages);
    },
  });

  return registry;
}
