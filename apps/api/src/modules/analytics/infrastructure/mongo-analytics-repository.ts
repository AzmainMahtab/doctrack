import { CONDITIONS } from '@doctrack/contracts';
import type { Collection, Db } from 'mongodb';
import { sessionOptions, type TransactionContext } from '../../../platform/database/index.ts';
import {
  emptyConditions,
  normalize,
  type Delta,
  type DayRow,
  type Snapshot,
  type Totals,
} from '../domain/model.ts';
import { AnalyticsRepository } from '../domain/ports.ts';

export const ANALYTICS_TOTALS = 'analytics_totals';
export const ANALYTICS_DAILY = 'analytics_daily';
const TOTALS_ID = 'totals';

interface TotalsDoc {
  _id: string;
  doctors: number;
  patients: number;
  conditions: Record<string, number>;
  updatedAt: Date;
}

interface DailyDoc {
  _id: string;
  patients: number;
  doctors: number;
}

export class MongoAnalyticsRepository extends AnalyticsRepository {
  private readonly totals: Collection<TotalsDoc>;
  private readonly daily: Collection<DailyDoc>;

  constructor(
    db: Db,
    private readonly context: TransactionContext,
  ) {
    super();
    this.totals = db.collection<TotalsDoc>(ANALYTICS_TOTALS);
    this.daily = db.collection<DailyDoc>(ANALYTICS_DAILY);
  }

  async apply(delta: Delta): Promise<void> {
    const options = sessionOptions(this.context);
    const inc: Record<string, number> = {};
    if (delta.doctors) inc.doctors = delta.doctors;
    if (delta.patients) inc.patients = delta.patients;
    for (const [condition, amount] of Object.entries(delta.conditions)) {
      if (amount) inc[`conditions.${condition}`] = amount;
    }
    if (Object.keys(inc).length > 0) {
      await this.totals.updateOne(
        { _id: TOTALS_ID },
        { $inc: inc, $set: { updatedAt: new Date() } },
        { upsert: true, ...options },
      );
    }
    if (delta.day && (delta.day.patients !== 0 || delta.day.doctors !== 0)) {
      const dayInc: Record<string, number> = {};
      if (delta.day.patients) dayInc.patients = delta.day.patients;
      if (delta.day.doctors) dayInc.doctors = delta.day.doctors;
      await this.daily.updateOne(
        { _id: delta.day.date },
        { $inc: dayInc },
        { upsert: true, ...options },
      );
    }
  }

  async readTotals(): Promise<Totals> {
    const doc = await this.totals.findOne({ _id: TOTALS_ID }, sessionOptions(this.context));
    const conditions = emptyConditions();
    for (const c of CONDITIONS) conditions[c] = doc?.conditions?.[c] ?? 0;
    return {
      doctors: doc?.doctors ?? 0,
      patients: doc?.patients ?? 0,
      conditions,
      updatedAt: doc?.updatedAt ?? null,
    };
  }

  async readDaily(from: string, to: string): Promise<DayRow[]> {
    const docs = await this.daily
      .find({ _id: { $gte: from, $lte: to } }, sessionOptions(this.context))
      .toArray();
    return docs.map((d) => ({ date: d._id, patients: d.patients, doctors: d.doctors }));
  }

  async readAll(): Promise<Snapshot> {
    const totals = await this.readTotals();
    const docs = await this.daily.find({}, sessionOptions(this.context)).toArray();
    return {
      doctors: totals.doctors,
      patients: totals.patients,
      conditions: totals.conditions,
      daily: docs.map((d) => ({ date: d._id, patients: d.patients, doctors: d.doctors })),
    };
  }

  async replaceAll(snapshot: Snapshot): Promise<void> {
    const options = sessionOptions(this.context);
    const clean = normalize(snapshot);
    await this.totals.replaceOne(
      { _id: TOTALS_ID },
      {
        doctors: clean.doctors,
        patients: clean.patients,
        conditions: clean.conditions,
        updatedAt: new Date(),
      },
      { upsert: true, ...options },
    );
    await this.daily.deleteMany({}, options);
    if (clean.daily.length > 0) {
      await this.daily.insertMany(
        clean.daily.map((d) => ({ _id: d.date, patients: d.patients, doctors: d.doctors })),
        options,
      );
    }
  }
}
