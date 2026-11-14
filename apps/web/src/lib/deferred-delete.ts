export interface DeferredJob {
  optimistic: () => void;
  restore: () => void;
  commit: (options: { keepalive: boolean }) => Promise<void>;
  onCommitted: () => void;
  onFailed: (error: unknown) => void;
}

interface Pending {
  timer: ReturnType<typeof setTimeout>;
  job: DeferredJob;
}

export class DeferredDeleter {
  private readonly pending = new Map<string, Pending>();

  constructor(private readonly delayMs = 5000) {}

  schedule(key: string, job: DeferredJob): void {
    if (this.pending.has(key)) return;
    job.optimistic();
    const timer = setTimeout(() => void this.run(key, false), this.delayMs);
    this.pending.set(key, { timer, job });
  }

  undo(key: string): boolean {
    const entry = this.pending.get(key);
    if (!entry) return false;
    clearTimeout(entry.timer);
    this.pending.delete(key);
    entry.job.restore();
    return true;
  }

  has(key: string): boolean {
    return this.pending.has(key);
  }

  flush(keepalive = true): void {
    for (const key of [...this.pending.keys()]) void this.run(key, keepalive);
  }

  private async run(key: string, keepalive: boolean): Promise<void> {
    const entry = this.pending.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(key);
    try {
      await entry.job.commit({ keepalive });
      entry.job.onCommitted();
    } catch (error) {
      entry.job.restore();
      entry.job.onFailed(error);
    }
  }
}

export const deleter = new DeferredDeleter();

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => deleter.flush(true));
}
