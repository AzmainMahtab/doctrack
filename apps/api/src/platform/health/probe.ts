export interface Probe {
  readonly name: string;
  check(): Promise<void>;
}

export interface ProbeResult {
  name: string;
  ok: boolean;
}

const withTimeout = <T>(work: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

export async function runProbes(
  probes: readonly Probe[],
  timeoutMs: number,
): Promise<ProbeResult[]> {
  return Promise.all(
    probes.map(async (probe) => {
      try {
        await withTimeout(probe.check(), timeoutMs);
        return { name: probe.name, ok: true };
      } catch {
        return { name: probe.name, ok: false };
      }
    }),
  );
}
