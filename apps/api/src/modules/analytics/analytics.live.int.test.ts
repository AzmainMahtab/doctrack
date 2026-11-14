import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eventSubject } from '../../platform/messaging/index.ts';
import { toEnvelope, type OutboxDoc } from '../../platform/outbox/index.ts';
import { createHarness, waitFor, type Harness } from '../../platform/testing/harness.ts';
import {
  ALL_CONSUMERS,
  consumersIdle,
  setupDomain,
  settle,
  startPipeline,
  type Actors,
} from '../../platform/testing/dashboard-setup.ts';
import type { Client } from '../../platform/testing/http-helpers.ts';
import { API } from '../../platform/testing/http-helpers.ts';

const today = () => new Date().toISOString().slice(0, 10);

const doctorBody = (n: number) => ({
  name: `Doctor ${n}`,
  specialization: 'Cardiology',
  hospital: 'St. Mary Hospital',
  phone: '+14155550123',
  email: `doctor${n}@t.dev`,
});

const patientBody = (n: number, condition: string) => ({
  name: `Patient ${n}`,
  dateOfBirth: '1985-03-21',
  gender: 'female',
  phone: '+14155550199',
  email: `patient${n}@t.dev`,
  condition,
  diagnosis: 'Checkup',
  admittedAt: '2026-11-01T09:30:00.000Z',
});

describe('analytics projection (live pipeline)', () => {
  let h: Harness;
  let actors: Actors;
  let pipeline: ReturnType<typeof startPipeline>;
  let admin: Client;
  const patientIds: string[] = [];
  let doctorA = '';
  let doctorB = '';

  const summary = async () => (await actors.viewer.get(`${API}/dashboard/summary`)).body.data;
  const conditions = async () => (await actors.viewer.get(`${API}/dashboard/conditions`)).body.data;
  const readAll = () => actors.built.analytics.reconcile.verify();

  beforeAll(async () => {
    h = await createHarness();
    actors = await setupDomain(h);
    admin = actors.admin;
    pipeline = startPipeline(h, actors);
    await pipeline.start();
  });
  afterAll(async () => {
    await pipeline.stop();
    await h.close();
  });

  it('projects doctors and patients created through the API and equals a fresh aggregation', async () => {
    doctorA = (await admin.post(`${API}/doctors`).send(doctorBody(1))).body.data.id;
    doctorB = (await admin.post(`${API}/doctors`).send(doctorBody(2))).body.data.id;
    const plan: [string, string][] = [
      [doctorA, 'stable'],
      [doctorA, 'stable'],
      [doctorA, 'critical'],
      [doctorB, 'recovered'],
      [doctorB, 'under_observation'],
    ];
    for (const [i, [doctorId, condition]] of plan.entries()) {
      const res = await admin
        .post(`${API}/doctors/${doctorId}/patients`)
        .send(patientBody(i, condition));
      patientIds.push(res.body.data.id);
    }
    await settle(h, actors);

    expect(await summary()).toMatchObject({ doctors: 2, patients: 5 });
    expect((await summary()).updatedAt).not.toBeNull();
    expect(await conditions()).toEqual({
      counts: { stable: 2, under_observation: 1, critical: 1, recovered: 1 },
      total: 5,
    });
    const series = (await actors.viewer.get(`${API}/dashboard/timeseries?window=7`)).body.data;
    expect(series.points).toHaveLength(7);
    expect(series.points.at(-1)).toEqual({ date: today(), count: 5 });
    const doctors = (await actors.viewer.get(`${API}/dashboard/timeseries?entity=doctors&window=7`))
      .body.data;
    expect(doctors.points.at(-1)).toEqual({ date: today(), count: 2 });
    expect((await readAll()).consistent).toBe(true);
  });

  it('follows condition changes and deletions, on the registration day', async () => {
    await admin.patch(`${API}/patients/${patientIds[2]}`).send({ condition: 'stable' });
    await admin.delete(`${API}/patients/${patientIds[3]}`);
    await admin.delete(`${API}/doctors/${doctorB}/patients/${patientIds[4]}`);
    await settle(h, actors);

    expect(await summary()).toMatchObject({ doctors: 2, patients: 3 });
    expect((await conditions()).counts).toEqual({
      stable: 3,
      under_observation: 0,
      critical: 0,
      recovered: 0,
    });
    const daily = await h.mongo.db.collection('analytics_daily').find({}).toArray();
    expect(daily).toEqual([{ _id: today(), patients: 3, doctors: 2 }]);
    const rank = (await actors.viewer.get(`${API}/dashboard/patients-per-doctor`)).body.data;
    expect(
      rank.map((r: { name: string; patientCount: number }) => [r.name, r.patientCount]),
    ).toEqual([
      ['Doctor 1', 3],
      ['Doctor 2', 0],
    ]);
  });

  it('ignores a duplicate delivery of an event it already applied', async () => {
    const row = (await h.mongo.db
      .collection<OutboxDoc>('outbox')
      .findOne({ type: 'patient.registered', aggregateId: patientIds[0] as string })) as OutboxDoc;
    const body = new TextEncoder().encode(JSON.stringify(toEnvelope(row)));
    const subject = eventSubject(h.topology, 'patient.registered');
    await h.publisher.publish(subject, body, 'dup-a');
    await h.publisher.publish(subject, body, 'dup-b');
    await waitFor(() => consumersIdle(h, ALL_CONSUMERS), 10_000);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await summary()).toMatchObject({ patients: 3 });
    expect((await readAll()).consistent).toBe(true);
  });

  it('converges when a removal arrives before its registration', async () => {
    const base = { version: 1, aggregateId: 'ghost', correlationId: null, actorId: null };
    const registered = {
      ...base,
      id: 'ghost-registered',
      name: 'patient.registered',
      occurredAt: new Date().toISOString(),
      payload: { doctorId: doctorA, condition: 'critical', registeredOn: today() },
    };
    const removed = {
      ...base,
      id: 'ghost-removed',
      name: 'patient.removed',
      occurredAt: new Date().toISOString(),
      payload: { doctorId: doctorA, condition: 'critical', registeredOn: today() },
    };
    const send = (e: typeof registered) =>
      h.publisher.publish(
        eventSubject(h.topology, e.name),
        new TextEncoder().encode(JSON.stringify(e)),
        e.id,
      );

    await send(removed);
    await waitFor(
      async () =>
        (await h.mongo.db
          .collection('processed_events')
          .countDocuments({ eventId: 'ghost-removed', consumer: 'analytics-projection' })) === 1,
    );
    expect((await summary()).patients).toBeGreaterThanOrEqual(0);
    expect((await conditions()).counts.critical).toBeGreaterThanOrEqual(0);

    await send(registered);
    await waitFor(() => consumersIdle(h, ALL_CONSUMERS), 10_000);
    await waitFor(async () => (await readAll()).consistent, 10_000);
    expect(await summary()).toMatchObject({ patients: 3 });
  });

  it('serves repeated reads from the cache and refreshes right after a consumed event', async () => {
    const before = (await summary()).patients;
    await h.mongo.db
      .collection('analytics_totals')
      .updateOne({ _id: 'totals' as never }, { $inc: { patients: 1000 } });
    expect((await summary()).patients).toBe(before);

    const started = Date.now();
    await admin.post(`${API}/doctors/${doctorA}/patients`).send(patientBody(99, 'stable'));
    await waitFor(async () => (await summary()).patients !== before, 10_000);
    expect(Date.now() - started).toBeLessThan(10_000);
    expect((await summary()).patients).toBe(before + 1001);

    await actors.built.analytics.reconcile.rebuild();
    await actors.built.analytics.cache.invalidate();
    expect((await summary()).patients).toBe(before + 1);
  });

  it('records one audit row per event with the acting user', async () => {
    await settle(h, actors);
    const outbox = await h.mongo.db.collection('outbox').find({}).toArray();
    const audit = await h.mongo.db.collection('audit_log').find({}).toArray();
    const synthetic = ['ghost-registered', 'ghost-removed'];
    const outboxIds = [...outbox.map((o) => String(o._id)), ...synthetic].sort();
    expect(audit.map((a) => String(a._id)).sort()).toEqual(outboxIds);

    const byType = (type: string) =>
      audit.filter((a) => a.eventType === type && !String(a._id).startsWith('ghost-'));
    expect(byType('doctor.registered').every((a) => a.actorId === actors.adminId)).toBe(true);
    expect(byType('patient.registered').every((a) => a.actorId === actors.adminId)).toBe(true);
    expect(byType('patient.removed').every((a) => a.actorId === actors.adminId)).toBe(true);
    const logins = byType('user.logged_in');
    expect(logins.length).toBeGreaterThan(0);
    expect(logins.every((a) => a.actorId === a.aggregateId)).toBe(true);
    expect(JSON.stringify(audit)).not.toMatch(/@t\.dev|Patient \d|Doctor \d/);
    const sample = audit.find((a) => a.eventType === 'patient.registered');
    expect(sample?.correlationId).toBeTruthy();
    expect(sample?.occurredAt).toBeInstanceOf(Date);
  });

  it('does not duplicate audit rows when an event is delivered twice', async () => {
    const row = (await h.mongo.db
      .collection<OutboxDoc>('outbox')
      .findOne({ type: 'doctor.registered' })) as OutboxDoc;
    const before = await h.mongo.db
      .collection('audit_log')
      .countDocuments({ _id: row._id as never });
    const body = new TextEncoder().encode(JSON.stringify(toEnvelope(row)));
    const subject = eventSubject(h.topology, 'doctor.registered');
    await h.publisher.publish(subject, body, 'audit-dup-1');
    await h.publisher.publish(subject, body, 'audit-dup-2');
    await waitFor(() => consumersIdle(h, ALL_CONSUMERS), 10_000);
    expect(before).toBe(1);
    expect(await h.mongo.db.collection('audit_log').countDocuments({ _id: row._id as never })).toBe(
      1,
    );
  });

  it('has a one-year retention index on the audit log', async () => {
    const indexes = await h.mongo.db.collection('audit_log').indexes();
    const ttl = indexes.find((i) => i.name === 'retention_ttl');
    expect(ttl?.expireAfterSeconds).toBe(365 * 24 * 60 * 60);
  });

  it('keeps the dead-letter stream empty', async () => {
    expect((await h.nats.jsm.streams.info(h.topology.dlqStream)).state.messages).toBe(0);
  });
});
