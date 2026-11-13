import type { ChangeStream, Collection, Db } from 'mongodb';
import { v7 as uuidv7 } from 'uuid';
import type { MessagePublisher } from '../../shared/application/index.ts';
import type { Logger } from '../logger/index.ts';
import { eventSubject, type Topology } from '../messaging/topology.ts';
import { OUTBOX, retryDelayMs, toEnvelope, type OutboxDoc } from './outbox.ts';

export interface RelayOptions {
  batchSize: number;
  leaseMs: number;
  pollMs: number;
}

export const defaultRelayOptions: RelayOptions = { batchSize: 100, leaseMs: 30_000, pollMs: 1_000 };

export interface RelayHooks {
  beforeMark?: () => Promise<void>;
}

const encoder = new TextEncoder();

export class OutboxRelay {
  private readonly collection: Collection<OutboxDoc>;
  private readonly options: RelayOptions;
  private stopped = true;
  private wakeUp: (() => void) | undefined;
  private loopDone: Promise<void> = Promise.resolve();
  private watcher: ChangeStream | undefined;
  private watchTimer: NodeJS.Timeout | undefined;
  publishedCount = 0;

  constructor(
    db: Db,
    private readonly publisher: MessagePublisher,
    private readonly topology: Topology,
    private readonly logger: Logger,
    options: Partial<RelayOptions> = {},
    private readonly hooks: RelayHooks = {},
  ) {
    this.collection = db.collection<OutboxDoc>(OUTBOX);
    this.options = { ...defaultRelayOptions, ...options };
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.openWatcher();
    this.loopDone = this.loop();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.watchTimer) clearTimeout(this.watchTimer);
    await this.watcher?.close().catch(() => undefined);
    this.watcher = undefined;
    this.wake();
    await this.loopDone;
  }

  async runOnce(): Promise<number> {
    const claimToken = uuidv7();
    const rows = await this.claim(claimToken);
    if (rows.length === 0) return 0;

    const published: string[] = [];
    let failure: { row: OutboxDoc; error: unknown } | undefined;
    for (const row of rows) {
      try {
        await this.publisher.publish(
          eventSubject(this.topology, row.type),
          encoder.encode(JSON.stringify(toEnvelope(row))),
          row._id,
        );
        published.push(row._id);
      } catch (error) {
        failure = { row, error };
        break;
      }
    }

    if (failure) {
      this.logger.warn({ err: failure.error, eventId: failure.row._id }, 'outbox publish failed');
      await this.release(
        claimToken,
        rows.filter((r) => !published.includes(r._id)),
        failure.row,
      );
    }

    if (published.length > 0) {
      await this.hooks.beforeMark?.();
      await this.collection.updateMany(
        { _id: { $in: published }, claimToken },
        { $set: { status: 'published', publishedAt: new Date(), leaseUntil: null } },
      );
      this.publishedCount += published.length;
    }
    return published.length;
  }

  private async claim(claimToken: string): Promise<OutboxDoc[]> {
    const now = new Date();
    const claimable = {
      status: { $in: ['pending', 'claimed'] as OutboxDoc['status'][] },
      $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }],
    };
    const ids = await this.collection
      .find(claimable, { projection: { _id: 1 }, sort: { _id: 1 }, limit: this.options.batchSize })
      .map((doc) => doc._id)
      .toArray();
    if (ids.length === 0) return [];

    await this.collection.updateMany(
      { _id: { $in: ids }, ...claimable },
      {
        $set: {
          status: 'claimed',
          claimToken,
          leaseUntil: new Date(now.getTime() + this.options.leaseMs),
        },
      },
    );
    return this.collection.find({ claimToken, status: 'claimed' }).sort({ _id: 1 }).toArray();
  }

  private async release(
    claimToken: string,
    unpublished: OutboxDoc[],
    failed: OutboxDoc,
  ): Promise<void> {
    const retryAt = new Date(Date.now() + retryDelayMs(failed.attempts));
    await this.collection.updateMany(
      { _id: { $in: unpublished.map((r) => r._id) }, claimToken },
      { $set: { status: 'pending', claimToken: null, leaseUntil: retryAt } },
    );
    await this.collection.updateOne({ _id: failed._id }, { $inc: { attempts: 1 } });
  }

  private async loop(): Promise<void> {
    while (!this.stopped) {
      try {
        let count: number;
        do {
          count = await this.runOnce();
        } while (count > 0 && !this.stopped);
      } catch (error) {
        this.logger.error({ err: error }, 'outbox relay iteration failed');
      }
      if (this.stopped) break;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, this.options.pollMs);
        this.wakeUp = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      this.wakeUp = undefined;
    }
  }

  private wake(): void {
    this.wakeUp?.();
  }

  private openWatcher(): void {
    if (this.stopped) return;
    try {
      const watcher = this.collection.watch([{ $match: { operationType: 'insert' } }]);
      this.watcher = watcher;
      watcher.on('change', () => this.wake());
      watcher.on('error', (error) => {
        this.logger.warn({ err: error }, 'outbox change stream failed, reopening');
        void watcher.close().catch(() => undefined);
        this.scheduleReopen();
      });
    } catch (error) {
      this.logger.warn({ err: error }, 'outbox change stream unavailable, polling only');
      this.scheduleReopen();
    }
  }

  private scheduleReopen(): void {
    if (this.stopped) return;
    this.watchTimer = setTimeout(() => this.openWatcher(), 2_000);
    this.watchTimer.unref();
  }
}
