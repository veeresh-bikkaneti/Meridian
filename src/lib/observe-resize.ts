/**
 * ResizeObserver with requestAnimationFrame coalescing.
 *
 * A ResizeObserver callback that reads layout and writes layout in the same
 * frame re-triggers itself synchronously — the browser then logs the benign
 * "ResizeObserver loop completed with undelivered notifications" complaint.
 * Deferring the work to the next animation frame (cancelling any pending
 * frame on re-fire) breaks the synchronous thrash loop while keeping
 * behavior identical: the callback still runs once per settled size.
 *
 * Returns a disconnect function that also cancels any pending frame, so no
 * callback fires after teardown. Falls back to setTimeout when
 * requestAnimationFrame is unavailable (SSR / non-DOM runtimes).
 */
export function observeResize(target: Element, callback: () => void): () => void {
  const g = globalThis as {
    requestAnimationFrame?: (cb: () => void) => number;
    cancelAnimationFrame?: (id: number) => void;
  };
  const requestFrame: (cb: () => void) => number =
    typeof g.requestAnimationFrame === "function"
      ? (cb) => g.requestAnimationFrame!(cb)
      : (cb) => setTimeout(cb, 16) as unknown as number;
  const cancelFrame: (id: number) => void =
    typeof g.cancelAnimationFrame === "function"
      ? (id) => g.cancelAnimationFrame!(id)
      : (id) => clearTimeout(id);

  let frame = 0;
  const schedule = () => {
    if (frame) cancelFrame(frame);
    frame = requestFrame(() => {
      frame = 0;
      callback();
    });
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(target);
  return () => {
    observer.disconnect();
    if (frame) {
      cancelFrame(frame);
      frame = 0;
    }
  };
}
