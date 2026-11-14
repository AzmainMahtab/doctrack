import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConsumerRunner, eventSubject } from '../../platform/messaging/index.ts';
import { OutboxRelay, toEnvelope, type OutboxDoc } from '../../platform/outbox/index.ts';
import { createHarness, waitFor, type Harness } from '../../platform/testing/harness.ts';
import { API, Client, PASSWORD, signIn } from '../../platform/testing/http-helpers.ts';
import { createIdentityApp } from '../../platform/testing/identity-app.ts';

type Built = Awaited<ReturnType<typeof createIdentityApp>>;

const patient = (over: Record<string, unknown> = {}) => ({
  name: 'John Carter',
  dateOfBirth: '1985-03-21',
  gender: 'male',
  phone: '+14155550199',
  email: `john-${randomBytes(4).toString('hex')}@example.com`,
  condition: 'stable',
  diagnosis: 'Hypertension',
  admittedAt: '2026-11-01T09:30:00.000Z',
  ...over,
});

describe('patients API', () => {
  let h: Harness;
  let built: Built;
  let admin: Client;
  let viewer: Client;
  let d1: string;
  let d2: string;

  beforeAll(async () => {
    h = await createHarness();
    built = await createIdentityApp(h, {
      policies: { 'user-write': { name: 'user-write', limit: 10_000, windowSeconds: 60 } },
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
    admin = new Client(built.app, await signIn(built.app, 'admin@t.dev'));
    viewer = new Client(built.app, await signIn(built.app, 'viewer@t.dev'));
    const make = async (name: string, email: string) =>
      (
        await admin.post(`${API}/doctors`).send({
          name,
          specialization: 'Cardiology',
          hospital: 'St. Mary Hospital',
          phone: '+14155550123',
          email,
        })
      ).body.data.id as string;
    d1 = await make('Alice Heart', 'alice@t.dev');
    d2 = await make('Bob Brain', 'bob@t.dev');
  });
  afterAll(async () => {
    await h.close();
  });

  const events = (type: string) => h.mongo.db.collection('outbox').find({ type }).toArray();
  const add = (doctorId: string, over: Record<string, unknown> = {}) =>
    admin.post(`${API}/doctors/${doctorId}/patients`).send(patient(over));

  describe('add under a doctor', () => {
    it('creates the patient with the doctor name and writes patient.registered without personal data', async () => {
      const res = await add(d1);
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        doctorId: d1,
        doctorName: 'Alice Heart',
        name: 'John Carter',
        dateOfBirth: '1985-03-21',
        condition: 'stable',
      });
      const event = (await events('patient.registered')).find(
        (e) => e.aggregateId === res.body.data.id,
      );
      expect(event?.payload).toEqual({
        doctorId: d1,
        condition: 'stable',
        admittedAt: '2026-11-01T09:30:00.000Z',
        registeredOn: new Date().toISOString().slice(0, 10),
      });
    });

    it('returns 404 for an unknown doctor and writes nothing', async () => {
      const patientsBefore = await h.mongo.db.collection('patients').countDocuments();
      const outboxBefore = await h.mongo.db.collection('outbox').countDocuments();
      const res = await add('no-such-doctor');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(await h.mongo.db.collection('patients').countDocuments()).toBe(patientsBefore);
      expect(await h.mongo.db.collection('outbox').countDocuments()).toBe(outboxBefore);
    });

    it('validates every field', async () => {
      const res = await add(d1, {
        name: 'J',
        dateOfBirth: '2999-01-01',
        gender: 'robot',
        phone: 'abc',
        email: 'bad',
        condition: 'dead',
        admittedAt: '2999-01-01T00:00:00.000Z',
        diagnosis: 'x'.repeat(501),
      });
      expect(res.status).toBe(422);
      expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(
        [
          'body.admittedAt',
          'body.condition',
          'body.dateOfBirth',
          'body.diagnosis',
          'body.email',
          'body.gender',
          'body.name',
          'body.phone',
        ].sort(),
      );
    });

    it('rejects a patient older than 130 years and defaults the diagnosis to empty', async () => {
      expect((await add(d1, { dateOfBirth: '1800-01-01' })).status).toBe(422);
      const res = await admin
        .post(`${API}/doctors/${d1}/patients`)
        .send({ ...patient(), diagnosis: undefined });
      expect(res.status).toBe(201);
      expect(res.body.data.diagnosis).toBe('');
    });

    it('blocks viewers and anonymous callers', async () => {
      expect((await viewer.post(`${API}/doctors/${d1}/patients`).send(patient())).status).toBe(403);
      expect(
        (await new Client(built.app).post(`${API}/doctors/${d1}/patients`).send(patient())).status,
      ).toBe(401);
    });
  });

  describe('lists', () => {
    beforeAll(async () => {
      await h.mongo.db.collection('patients').deleteMany({});
      await add(d1, { name: 'John Carter', condition: 'stable', diagnosis: 'Hypertension' });
      await add(d1, { name: 'Johanna Lee', condition: 'critical', diagnosis: 'Arrhythmia' });
      await add(d1, { name: 'María Pérez', condition: 'recovered', diagnosis: 'Hypertension' });
      await add(d2, { name: 'Ahmed Khan', condition: 'critical', diagnosis: 'Migraine' });
      await add(d2, { name: 'Zoe Adams', condition: 'under_observation', diagnosis: 'Seizure' });
    });

    it('lists all patients with rows that carry no contact data', async () => {
      const res = await viewer.get(`${API}/patients?limit=100`);
      expect(res.status).toBe(200);
      expect(res.body.meta).toEqual({ page: 1, limit: 100, total: 5, totalPages: 1 });
      expect(Object.keys(res.body.data[0]).sort()).toEqual(
        ['admittedAt', 'condition', 'doctorId', 'doctorName', 'id', 'name'].sort(),
      );
    });

    it('filters by condition, doctor and combinations', async () => {
      expect((await admin.get(`${API}/patients?condition=critical`)).body.meta.total).toBe(2);
      expect((await admin.get(`${API}/patients?doctorId=${d2}`)).body.meta.total).toBe(2);
      const both = await admin.get(`${API}/patients?doctorId=${d1}&condition=critical`);
      expect(both.body.meta.total).toBe(1);
      expect(both.body.data[0].name).toBe('Johanna Lee');
    });

    it('searches names and diagnoses by word prefix', async () => {
      expect((await admin.get(`${API}/patients?q=joh`)).body.meta.total).toBe(2);
      expect((await admin.get(`${API}/patients?q=maria`)).body.meta.total).toBe(1);
      expect((await admin.get(`${API}/patients?q=hyper`)).body.meta.total).toBe(2);
      expect((await admin.get(`${API}/patients?q=joh%20hyper`)).body.meta.total).toBe(1);
      expect((await admin.get(`${API}/patients?q=nothing`)).body.meta.total).toBe(0);
    });

    it('filters by created date, sorts and paginates', async () => {
      const today = new Date().toISOString().slice(0, 10);
      expect((await admin.get(`${API}/patients?from=${today}&to=${today}`)).body.meta.total).toBe(
        5,
      );
      expect((await admin.get(`${API}/patients?from=2099-01-01`)).body.meta.total).toBe(0);
      const sorted = await admin.get(`${API}/patients?sort=name&limit=100`);
      const names: string[] = sorted.body.data.map((p: { name: string }) => p.name);
      expect(names[0]).toBe('Ahmed Khan');
      expect(names.at(-1)).toBe('Zoe Adams');
      const page = await admin.get(`${API}/patients?limit=2&page=3`);
      expect(page.body.data).toHaveLength(1);
      expect(page.body.meta).toEqual({ page: 3, limit: 2, total: 5, totalPages: 3 });
    });

    it("lists one doctor's patients and 404s for an unknown doctor", async () => {
      const res = await admin.get(`${API}/doctors/${d1}/patients`);
      expect(res.body.meta.total).toBe(3);
      expect(res.body.data.every((p: { doctorId: string }) => p.doctorId === d1)).toBe(true);
      expect(
        (await admin.get(`${API}/doctors/${d1}/patients?condition=critical`)).body.meta.total,
      ).toBe(1);
      expect((await admin.get(`${API}/doctors/${d1}/patients?q=maria`)).body.meta.total).toBe(1);
      expect((await admin.get(`${API}/doctors/nope/patients`)).status).toBe(404);
    });

    it('validates query parameters', async () => {
      expect((await admin.get(`${API}/patients?condition=dead`)).status).toBe(422);
      expect((await admin.get(`${API}/patients?limit=500`)).status).toBe(422);
    });
  });

  describe('read, edit and delete', () => {
    it('returns one patient and 404 for an unknown id', async () => {
      const made = await add(d1);
      const found = await viewer.get(`${API}/patients/${made.body.data.id}`);
      expect(found.status).toBe(200);
      expect(found.body.data.email).toBe(made.body.data.email);
      expect((await viewer.get(`${API}/patients/nope`)).status).toBe(404);
    });

    it('edits a patient and records updated and condition_changed events', async () => {
      const made = await add(d1, { condition: 'critical' });
      const id = made.body.data.id as string;
      const res = await admin
        .patch(`${API}/patients/${id}`)
        .send({ condition: 'stable', phone: '+14155550000' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ condition: 'stable', phone: '+14155550000' });
      expect(res.body.data.updatedAt >= res.body.data.createdAt).toBe(true);

      const updated = (await events('patient.updated')).find((e) => e.aggregateId === id);
      expect((updated?.payload as { changed: string[] }).changed.sort()).toEqual([
        'condition',
        'phone',
      ]);
      const changed = (await events('patient.condition_changed')).find((e) => e.aggregateId === id);
      expect(changed?.payload).toEqual({ doctorId: d1, from: 'critical', to: 'stable' });
    });

    it('writes no event when nothing changes', async () => {
      const made = await add(d1, { name: 'Static Person' });
      const id = made.body.data.id as string;
      const before = await h.mongo.db.collection('outbox').countDocuments({ aggregateId: id });
      const res = await admin.patch(`${API}/patients/${id}`).send({ name: 'Static Person' });
      expect(res.status).toBe(200);
      expect(res.body.data.updatedAt).toBe(made.body.data.updatedAt);
      expect(await h.mongo.db.collection('outbox').countDocuments({ aggregateId: id })).toBe(
        before,
      );
    });

    it('rejects invalid edits and leaves the record unchanged', async () => {
      const made = await add(d1);
      const id = made.body.data.id as string;
      const bad = await admin.patch(`${API}/patients/${id}`).send({ email: 'not-an-email' });
      expect(bad.status).toBe(422);
      expect(bad.body.errors[0].field).toBe('body.email');
      expect((await admin.patch(`${API}/patients/${id}`).send({})).status).toBe(422);
      const stored = await admin.get(`${API}/patients/${id}`);
      expect(stored.body.data.email).toBe(made.body.data.email);
      expect((await admin.patch(`${API}/patients/nope`).send({ name: 'Someone' })).status).toBe(
        404,
      );
    });

    it('deletes a patient, then 404s, and records patient.removed', async () => {
      const made = await add(d1, { condition: 'recovered' });
      const id = made.body.data.id as string;
      const del = await admin.delete(`${API}/patients/${id}`);
      expect(del.status).toBe(204);
      expect(del.text).toBe('');
      expect((await admin.get(`${API}/patients/${id}`)).status).toBe(404);
      const removed = (await events('patient.removed')).find((e) => e.aggregateId === id);
      expect(removed?.payload).toEqual({
        doctorId: d1,
        condition: 'recovered',
        registeredOn: new Date().toISOString().slice(0, 10),
      });
      expect((await admin.delete(`${API}/patients/${id}`)).status).toBe(404);
    });

    it("refuses to delete another doctor's patient through the doctor route", async () => {
      const made = await add(d1);
      const id = made.body.data.id as string;
      const wrong = await admin.delete(`${API}/doctors/${d2}/patients/${id}`);
      expect(wrong.status).toBe(404);
      expect((await admin.get(`${API}/patients/${id}`)).status).toBe(200);
      expect((await admin.delete(`${API}/doctors/${d1}/patients/${id}`)).status).toBe(204);
      expect((await admin.get(`${API}/patients/${id}`)).status).toBe(404);
    });

    it('blocks viewers from editing and deleting', async () => {
      const made = await add(d1);
      const id = made.body.data.id as string;
      expect(
        (await viewer.patch(`${API}/patients/${id}`).send({ name: 'Changed Name' })).status,
      ).toBe(403);
      expect((await viewer.delete(`${API}/patients/${id}`)).status).toBe(403);
      expect((await admin.get(`${API}/patients/${id}`)).body.data.name).toBe('John Carter');
    });
  });

  describe('patientCount consumer', () => {
    it('keeps patientCount equal to the real count and ignores duplicate deliveries', async () => {
      const made = await admin.post(`${API}/doctors`).send({
        name: 'Counter Doc',
        specialization: 'Counting',
        hospital: 'Tally Clinic',
        phone: '+14155550123',
        email: 'counter@t.dev',
      });
      const doctorId = made.body.data.id as string;

      const relay = new OutboxRelay(h.mongo.db, h.publisher, h.topology, h.logger, { pollMs: 100 });
      const runner = new ConsumerRunner({
        connection: h.nats.connection,
        jsm: h.nats.jsm,
        db: h.mongo.db,
        uow: h.uow,
        context: h.transactions,
        logger: h.logger,
        topology: h.topology,
        handlers: built.doctors.consumers,
        options: { maxDeliver: 3, backoffMs: [100, 100] },
      });
      await runner.start();
      relay.start();
      try {
        const ids: string[] = [];
        for (let i = 0; i < 5; i++) ids.push((await add(doctorId)).body.data.id);
        await admin.delete(`${API}/patients/${ids[0]}`);
        await admin.delete(`${API}/doctors/${doctorId}/patients/${ids[1]}`);

        const count = async () =>
          (await admin.get(`${API}/doctors/${doctorId}`)).body.data.patientCount;
        await waitFor(async () => (await count()) === 3, 10_000);
        expect(await h.mongo.db.collection('patients').countDocuments({ doctorId })).toBe(3);

        const row = (await h.mongo.db
          .collection<OutboxDoc>('outbox')
          .findOne({ type: 'patient.registered', aggregateId: ids[2] as string })) as OutboxDoc;
        const body = new TextEncoder().encode(JSON.stringify(toEnvelope(row)));
        const subject = eventSubject(h.topology, 'patient.registered');
        await h.publisher.publish(subject, body, 'dup-delivery-1');
        await h.publisher.publish(subject, body, 'dup-delivery-2');
        await new Promise((resolve) => setTimeout(resolve, 800));
        expect(await count()).toBe(3);

        const metrics = await h.nats.jsm.consumers.info(
          h.topology.eventsStream,
          'doctors-patient-count',
        );
        expect(metrics.num_pending + metrics.num_ack_pending).toBe(0);
      } finally {
        await relay.stop();
        await runner.stop();
      }
    });
  });

  describe('documentation', () => {
    it('documents every doctor and patient endpoint with its permission', () => {
      const doc = built.document as unknown as {
        paths: Record<
          string,
          Record<string, { description?: string; responses: Record<string, unknown> }>
        >;
      };
      const expected: [string, string, string][] = [
        ['get', '/api/v1/doctors', 'doctors:read'],
        ['post', '/api/v1/doctors', 'doctors:write'],
        ['get', '/api/v1/doctors/{id}', 'doctors:read'],
        ['get', '/api/v1/doctors/{id}/patients', 'patients:read'],
        ['post', '/api/v1/doctors/{id}/patients', 'patients:write'],
        ['delete', '/api/v1/doctors/{id}/patients/{patientId}', 'patients:write'],
        ['get', '/api/v1/patients', 'patients:read'],
        ['get', '/api/v1/patients/{id}', 'patients:read'],
        ['patch', '/api/v1/patients/{id}', 'patients:write'],
        ['delete', '/api/v1/patients/{id}', 'patients:write'],
      ];
      for (const [method, path, permission] of expected) {
        const op = doc.paths[path]?.[method];
        expect(op, `${method} ${path}`).toBeDefined();
        expect(op?.description).toContain(`Permission: \`${permission}\``);
        expect(op?.responses['401']).toBeDefined();
        expect(op?.responses['403']).toBeDefined();
        expect(op?.responses['429']).toBeDefined();
      }
    });
  });
});
