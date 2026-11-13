import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, ThingHappened, type Harness } from '../testing/harness.ts';
import { OUTBOX } from './outbox.ts';

describe('transactional outbox', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h.close();
  });

  const things = () => h.mongo.db.collection('things');
  const outbox = () => h.mongo.db.collection(OUTBOX);
  const session = () => {
    const current = h.transactions.current();
    return current ? { session: current } : {};
  };

  it('commits the domain write and the outbox row together', async () => {
    const event = new ThingHappened('thing-1', { n: 1 });
    await h.uow.withTransaction(async () => {
      await things().insertOne({ _id: 'thing-1' } as never, session());
      await h.bus.publish(event);
    });
    expect(await things().countDocuments({ _id: 'thing-1' as never })).toBe(1);
    const row = await outbox().findOne({ _id: event.id as never });
    expect(row).toMatchObject({
      type: 'thing.happened',
      status: 'pending',
      aggregateId: 'thing-1',
    });
  });

  it('rolls both back when the work throws after publishing', async () => {
    const event = new ThingHappened('thing-2', {});
    await expect(
      h.uow.withTransaction(async () => {
        await things().insertOne({ _id: 'thing-2' } as never, session());
        await h.bus.publish(event);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await things().countDocuments({ _id: 'thing-2' as never })).toBe(0);
    expect(await outbox().countDocuments({ _id: event.id as never })).toBe(0);
  });

  it('refuses to publish outside a transaction', async () => {
    await expect(h.bus.publish(new ThingHappened('thing-3', {}))).rejects.toThrow(
      /inside a transaction/,
    );
  });

  it('joins an outer transaction when nested', async () => {
    const event = new ThingHappened('thing-4', {});
    await expect(
      h.uow.withTransaction(async () => {
        await h.uow.withTransaction(async () => {
          await h.bus.publish(event);
        });
        throw new Error('outer fails');
      }),
    ).rejects.toThrow('outer fails');
    expect(await outbox().countDocuments({ _id: event.id as never })).toBe(0);
  });
});
