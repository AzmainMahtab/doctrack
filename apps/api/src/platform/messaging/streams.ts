import { RetentionPolicy, StorageType, type JetStreamManager } from '@nats-io/jetstream';
import type { Topology } from './topology.ts';

const MINUTE_NS = 60 * 1e9;
const DAY_NS = 24 * 60 * MINUTE_NS;

interface StreamSpec {
  name: string;
  subjects: string[];
  maxAgeNs: number;
  duplicateWindowNs: number;
}

async function upsert(jsm: JetStreamManager, spec: StreamSpec): Promise<void> {
  const config = {
    name: spec.name,
    subjects: spec.subjects,
    retention: RetentionPolicy.Limits,
    storage: StorageType.File,
    max_age: spec.maxAgeNs,
    duplicate_window: spec.duplicateWindowNs,
  };
  try {
    await jsm.streams.info(spec.name);
    await jsm.streams.update(spec.name, config);
  } catch {
    await jsm.streams.add(config);
  }
}

export async function ensureStreams(jsm: JetStreamManager, topology: Topology): Promise<void> {
  await upsert(jsm, {
    name: topology.eventsStream,
    subjects: [`${topology.eventPrefix}.>`],
    maxAgeNs: 7 * DAY_NS,
    duplicateWindowNs: 10 * MINUTE_NS,
  });
  await upsert(jsm, {
    name: topology.dlqStream,
    subjects: [`${topology.dlqPrefix}.>`],
    maxAgeNs: 30 * DAY_NS,
    duplicateWindowNs: 2 * MINUTE_NS,
  });
}
