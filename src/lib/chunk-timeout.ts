/**
 * #209 — bounded waits for lazy chunk loads.
 *
 * A FAILED dynamic import rejects and lands in the existing
 * recoverable paths (the error boundary's card, `openRun`'s start
 * error). A HUNG import — a stalled connection, a wedged service
 * worker — never settles at all, so the loading fallback spins
 * forever and no error path ever runs. `withChunkTimeout` races a
 * chunk load against a bound; on timeout the race rejects with a
 * `ChunkLoadTimeoutError`, which flows into exactly those same
 * recoverable paths.
 *
 * The bound is 10 s: the order of the build-staleness probe's bound
 * (8 s, `build-staleness.ts`) and well under the crash watchdog's
 * ~28 s boot budget, so the player always gets the recoverable card
 * before any watchdog verdict. A load that lands after the bound is
 * simply late — its rejection, if it ever fails, is already handled
 * here, so nothing surfaces as an unhandled rejection.
 */

export class ChunkLoadTimeoutError extends Error {
  readonly chunkLabel: string;
  readonly timeoutMs: number;

  constructor(chunkLabel: string, timeoutMs: number) {
    super(`Chunk load timed out after ${timeoutMs} ms: ${chunkLabel}`);
    this.name = "ChunkLoadTimeoutError";
    this.chunkLabel = chunkLabel;
    this.timeoutMs = timeoutMs;
  }
}

/** The one bound for every gameplay chunk load (#209). */
export const CHUNK_LOAD_TIMEOUT_MS = 10_000;

/**
 * Race `load` against `timeoutMs`. Resolves/rejects with the load when
 * it settles first (the original error passes through untouched — the
 * stale-deploy and chunk-recovery classification downstream depends
 * on the real messages); rejects with `ChunkLoadTimeoutError` when
 * the load is still pending at the bound.
 */
export function withChunkTimeout<T>(
  load: Promise<T>,
  chunkLabel: string,
  timeoutMs: number = CHUNK_LOAD_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ChunkLoadTimeoutError(chunkLabel, timeoutMs));
    }, timeoutMs);
    load.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
