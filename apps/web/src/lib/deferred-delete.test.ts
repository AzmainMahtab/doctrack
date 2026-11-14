import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferredDeleter, type DeferredJob } from './deferred-delete';

const job = (commit: DeferredJob['commit'] = async () => {}): DeferredJob => ({
  optimistic: vi.fn(),
  restore: vi.fn(),
  commit: vi.fn(commit),
  onCommitted: vi.fn(),
  onFailed: vi.fn(),
});

describe('DeferredDeleter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('applies the change at once and commits after the delay', async () => {
    const d = new DeferredDeleter(5000);
    const j = job();
    d.schedule('a', j);
    expect(j.optimistic).toHaveBeenCalledOnce();
    expect(j.commit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(j.commit).toHaveBeenCalledWith({ keepalive: false });
    expect(j.onCommitted).toHaveBeenCalledOnce();
    expect(d.has('a')).toBe(false);
  });

  it('undo cancels the commit and restores', async () => {
    const d = new DeferredDeleter(5000);
    const j = job();
    d.schedule('a', j);
    expect(d.undo('a')).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(j.commit).not.toHaveBeenCalled();
    expect(j.restore).toHaveBeenCalledOnce();
    expect(d.undo('a')).toBe(false);
  });

  it('restores and reports when the commit fails', async () => {
    const d = new DeferredDeleter(1000);
    const j = job(async () => {
      throw new Error('boom');
    });
    d.schedule('a', j);
    await vi.advanceTimersByTimeAsync(1000);
    expect(j.restore).toHaveBeenCalledOnce();
    expect(j.onFailed).toHaveBeenCalledOnce();
    expect(j.onCommitted).not.toHaveBeenCalled();
  });

  it('flush commits everything pending now with keepalive', async () => {
    const d = new DeferredDeleter(5000);
    const a = job();
    const b = job();
    d.schedule('a', a);
    d.schedule('b', b);
    d.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(a.commit).toHaveBeenCalledWith({ keepalive: true });
    expect(b.commit).toHaveBeenCalledWith({ keepalive: true });
    await vi.advanceTimersByTimeAsync(5000);
    expect(a.commit).toHaveBeenCalledTimes(1);
  });

  it('ignores a second schedule for the same key', () => {
    const d = new DeferredDeleter();
    const first = job();
    const second = job();
    d.schedule('a', first);
    d.schedule('a', second);
    expect(second.optimistic).not.toHaveBeenCalled();
  });
});
