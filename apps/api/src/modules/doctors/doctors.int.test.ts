import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from '../../platform/testing/harness.ts';
import { API, Client, PASSWORD, signIn } from '../../platform/testing/http-helpers.ts';
import { createIdentityApp } from '../../platform/testing/identity-app.ts';

type Built = Awaited<ReturnType<typeof createIdentityApp>>;

const doctor = (over: Record<string, unknown> = {}) => ({
  name: 'Alice Heart',
  specialization: 'Cardiology',
  hospital: 'St. Mary Hospital',
  phone: '+14155550123',
  email: `alice-${randomBytes(4).toString('hex')}@example.com`,
  ...over,
});

describe('doctors API', () => {
  let h: Harness;
  let built: Built;
  let admin: Client;
  let viewer: Client;
  let anonymous: Client;

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
    anonymous = new Client(built.app);
  });
  afterAll(async () => {
    await h.close();
  });

  const outbox = (type: string) => h.mongo.db.collection('outbox').find({ type }).toArray();

  describe('create', () => {
    it('creates a doctor and writes a doctor.registered event', async () => {
      const body = doctor({ name: 'Grace Hopper', email: 'Grace@Example.com' });
      const res = await admin.post(`${API}/doctors`).send(body);
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        name: 'Grace Hopper',
        specialization: 'Cardiology',
        email: 'grace@example.com',
        patientCount: 0,
        isActive: true,
      });
      const events = await outbox('doctor.registered');
      expect(events.some((e) => e.aggregateId === res.body.data.id)).toBe(true);
      const event = events.find((e) => e.aggregateId === res.body.data.id);
      expect(JSON.stringify(event?.payload)).not.toContain('Grace');
    });

    it('rejects a duplicate email in any case with 409', async () => {
      const email = `dup-${randomBytes(3).toString('hex')}@example.com`;
      expect((await admin.post(`${API}/doctors`).send(doctor({ email }))).status).toBe(201);
      const again = await admin.post(`${API}/doctors`).send(doctor({ email: email.toUpperCase() }));
      expect(again.status).toBe(409);
      expect(again.body.code).toBe('CONFLICT');
      expect(await h.mongo.db.collection('doctors').countDocuments({ email })).toBe(1);
    });

    it('returns 422 with field errors for invalid input', async () => {
      const res = await admin
        .post(`${API}/doctors`)
        .send(doctor({ phone: '12345', name: 'A', email: 'nope' }));
      expect(res.status).toBe(422);
      expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual([
        'body.email',
        'body.name',
        'body.phone',
      ]);
    });

    it('rejects unknown content and missing fields', async () => {
      expect((await admin.post(`${API}/doctors`).send({})).status).toBe(422);
    });
  });

  describe('permissions', () => {
    it('lets a viewer read but not write, and blocks anonymous callers', async () => {
      expect((await viewer.post(`${API}/doctors`).send(doctor())).status).toBe(403);
      expect((await viewer.get(`${API}/doctors`)).status).toBe(200);
      expect((await anonymous.get(`${API}/doctors`)).status).toBe(401);
      expect((await anonymous.post(`${API}/doctors`).send(doctor())).status).toBe(401);
    });
  });

  describe('list', () => {
    const created: { id: string; name: string }[] = [];

    beforeAll(async () => {
      await h.mongo.db.collection('doctors').deleteMany({});
      const plan = [
        ['Alice Heart', 'Cardiology', 'St. Mary Hospital'],
        ['Albert Stone', 'Neurology', 'City General'],
        ['Álvaro Núñez', 'Cardiology', 'City General'],
        ['Beatrice Bloom', 'Pediatrics', 'St. Mary Hospital'],
        ['Carlos Vega', 'Neurology', 'Lakeside Clinic'],
      ] as const;
      for (let i = 0; i < 25; i++) {
        const [name, specialization, hospital] = plan[i % plan.length] ?? plan[0];
        const res = await admin
          .post(`${API}/doctors`)
          .send(doctor({ name: `${name} ${i}`, specialization, hospital }));
        created.push({ id: res.body.data.id, name: res.body.data.name });
      }
    });

    it('returns the newest first with page metadata', async () => {
      const res = await admin.get(`${API}/doctors?limit=10`);
      expect(res.status).toBe(200);
      expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 25, totalPages: 3 });
      expect(res.body.data).toHaveLength(10);
      expect(res.body.data[0].id).toBe(created[24]?.id);
      expect(Object.keys(res.body.data[0]).sort()).toEqual(
        ['createdAt', 'hospital', 'id', 'name', 'patientCount', 'specialization'].sort(),
      );
    });

    it('returns the last partial page and an empty page beyond it', async () => {
      const last = await admin.get(`${API}/doctors?limit=10&page=3`);
      expect(last.body.data).toHaveLength(5);
      expect(last.body.meta.page).toBe(3);
      const beyond = await admin.get(`${API}/doctors?limit=10&page=9`);
      expect(beyond.body.data).toEqual([]);
      expect(beyond.body.meta.total).toBe(25);
    });

    it('matches words by prefix, ignoring case and diacritics', async () => {
      const al = await admin.get(`${API}/doctors?q=al&limit=100`);
      const names: string[] = al.body.data.map((d: { name: string }) => d.name);
      expect(names.length).toBe(15);
      expect(names.every((n) => /^(alice|albert|álvaro)/i.test(n))).toBe(true);

      const two = await admin.get(`${API}/doctors?q=alice%20he&limit=100`);
      expect(two.body.meta.total).toBe(5);

      const accent = await admin.get(`${API}/doctors?q=ALVARO&limit=100`);
      expect(accent.body.meta.total).toBe(5);

      const hospital = await admin.get(`${API}/doctors?q=lakes`);
      expect(hospital.body.meta.total).toBe(5);

      expect((await admin.get(`${API}/doctors?q=zzz`)).body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });

    it('filters by specialization, hospital and combined', async () => {
      const spec = await admin.get(`${API}/doctors?specialization=Neurology&limit=100`);
      expect(spec.body.meta.total).toBe(10);
      const hosp = await admin.get(`${API}/doctors?hospital=City%20General&limit=100`);
      expect(hosp.body.meta.total).toBe(10);
      const both = await admin.get(
        `${API}/doctors?specialization=Cardiology&hospital=City%20General`,
      );
      expect(both.body.meta.total).toBe(5);
    });

    it('filters by created date range', async () => {
      const today = new Date().toISOString().slice(0, 10);
      expect((await admin.get(`${API}/doctors?from=${today}&to=${today}`)).body.meta.total).toBe(
        25,
      );
      expect((await admin.get(`${API}/doctors?from=2099-01-01`)).body.meta.total).toBe(0);
      expect((await admin.get(`${API}/doctors?to=2000-01-01`)).body.meta.total).toBe(0);
    });

    it('sorts by name and by patient count', async () => {
      const asc = await admin.get(`${API}/doctors?sort=name&limit=100`);
      const key = (name: string) =>
        name
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .toLowerCase();
      const names: string[] = asc.body.data.map((d: { name: string }) => key(d.name));
      expect(names).toEqual([...names].sort());

      await h.mongo.db
        .collection('doctors')
        .updateOne({ _id: created[3]?.id as never }, { $set: { patientCount: 7 } });
      const top = await admin.get(`${API}/doctors?sort=-patientCount&limit=1`);
      expect(top.body.data[0].id).toBe(created[3]?.id);
    });

    it('validates query parameters', async () => {
      const big = await admin.get(`${API}/doctors?limit=101`);
      expect(big.status).toBe(422);
      expect(big.body.errors[0].field).toBe('query.limit');
      const range = await admin.get(`${API}/doctors?from=2026-02-01&to=2026-01-01`);
      expect(range.status).toBe(422);
      expect((await admin.get(`${API}/doctors?sort=bogus`)).status).toBe(422);
      expect((await admin.get(`${API}/doctors?page=0`)).status).toBe(422);
    });
  });

  describe('get', () => {
    it('returns one doctor and 404 for an unknown id', async () => {
      const made = await admin.post(`${API}/doctors`).send(doctor());
      const found = await viewer.get(`${API}/doctors/${made.body.data.id}`);
      expect(found.status).toBe(200);
      expect(found.body.data.id).toBe(made.body.data.id);
      expect(found.body.data.phone).toBe('+14155550123');
      const missing = await viewer.get(`${API}/doctors/does-not-exist`);
      expect(missing.status).toBe(404);
      expect(missing.body.code).toBe('NOT_FOUND');
    });
  });
});
