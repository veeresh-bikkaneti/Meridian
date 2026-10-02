/**
 * PWA service-worker registration with background update polling.
 *
 * Update policy (Veeresh's requirement): when a new service worker finishes
 * installing it sits in the "waiting" state — it NEVER activates itself and
 * the page NEVER reloads on its own. The app shows a non-blocking
 * "Update available" toast; only when the player taps it do we send
 * SKIP_WAITING and reload once the new worker takes control. Active game
 * states are never interrupted by an update.
 *
 * Registration is production-only: a service worker would fight Vite HMR
 * and the dev/preview middleware in development.
 */

export interface PwaUpdateHandle {
  /** Ask the waiting worker to activate, then reload when it takes control. */
  applyUpdate: () => void;
  /** Stop polling (unmount). */
  dispose: () => void;
}

const POLL_INTERVAL_MS = 60 * 60 * 1000; // hourly background check
const VISIBILITY_THROTTLE_MS = 5 * 60 * 1000; // at most one check per 5 min on tab focus

function viteEnv(): { PROD?: boolean; BASE_URL?: string } {
  const env = (import.meta as unknown as { env?: { PROD?: boolean; BASE_URL?: string } }).env;
  return env ?? {};
}

function swUrl(baseUrl: string | undefined): string {
  const base = baseUrl ?? "/";
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}sw.js`;
}

/**
 * Register the service worker and poll for updates in the background.
 * Resolves with a handle once a waiting worker exists, or null when service
 * workers are unavailable / registration is skipped (dev, insecure context).
 *
 * `testEnv` is a test seam: under `node --test`, `import.meta.env` is
 * undefined, so unit tests inject `{ PROD: true, BASE_URL: ... }` here.
 * Production callers omit it.
 */
export async function registerServiceWorker(testEnv?: {
  PROD?: boolean;
  BASE_URL?: string;
}): Promise<{
  waiting: ServiceWorker;
  handle: PwaUpdateHandle;
} | null> {
  if (typeof window === "undefined") return null;
  const env = testEnv ?? viteEnv();
  if (!env.PROD) return null;
  if (!("serviceWorker" in navigator)) return null;

  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.register(swUrl(env.BASE_URL), {
      scope: env.BASE_URL ?? "/",
    });
  } catch {
    return null; // e.g. Pages preview without the file — never break the app
  }

  let waiting: ServiceWorker | null = registration.waiting;
  let disposed = false;
  let notified = false;
  let reloaded = false;
  let lastVisibilityCheck = 0;
  let notifyWaiting: ((w: ServiceWorker) => void) | null = null;

  const notify = (w: ServiceWorker) => {
    waiting = w;
    if (notified || disposed) return;
    notified = true;
    notifyWaiting?.(w);
  };

  const track = (w: ServiceWorker | null) => {
    if (!w) return;
    if (w.state === "installed" && navigator.serviceWorker.controller) {
      notify(w);
      return;
    }
    w.addEventListener("statechange", () => {
      if (
        w.state === "installed" &&
        navigator.serviceWorker.controller &&
        !disposed
      ) {
        notify(w);
      }
    });
  };

  track(registration.waiting);
  registration.addEventListener("updatefound", () => track(registration.installing));

  const poll = () => {
    if (disposed) return;
    registration.update().catch(() => {});
  };
  const pollTimer = window.setInterval(poll, POLL_INTERVAL_MS);

  const onVisibility = () => {
    if (document.visibilityState !== "visible" || disposed) return;
    const now = Date.now();
    if (now - lastVisibilityCheck < VISIBILITY_THROTTLE_MS) return;
    lastVisibilityCheck = now;
    poll();
  };
  document.addEventListener("visibilitychange", onVisibility);

  // The new worker takes control after SKIP_WAITING — reload exactly once so
  // the player gets the fresh shell. Guarded: a reload loop would need the
  // new bundle to immediately find *another* waiting worker, which cannot
  // happen from a single update.
  const onControllerChange = () => {
    if (reloaded || disposed) return;
    reloaded = true;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

  const handle: PwaUpdateHandle = {
    applyUpdate: () => {
      const w = waiting;
      if (!w) return;
      // Ask politely; the worker activates on its own terms, then
      // controllerchange fires and we reload once.
      w.postMessage({ type: "SKIP_WAITING" });
    },
    dispose: () => {
      disposed = true;
      window.clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    },
  };

  if (waiting) {
    return { waiting, handle };
  }
  // Otherwise resolve when the first waiting worker appears.
  return new Promise((resolve) => {
    notifyWaiting = (w) => resolve({ waiting: w, handle });
  });
}
