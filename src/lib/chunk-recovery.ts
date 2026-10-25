/**
 * Stale-chunk auto-recovery: when a deploy replaces the site's assets
 * while a tab is open, the old bundle's content-hashed lazy-chunk URLs
 * 404 and the dynamic import rejects — the 2026-10-24 crash (build
 * fa9f36b, LoopScreen chunk, country/France) is the type specimen. That
 * failure lands in an error boundary whose only recovery is a manual
 * "Try again" tap; this handler performs the reload automatically when
 * the failure carries the chunk-load signature, so a mid-session
 * deploy stops stranding players on a dead screen.
 *
 * It defers to the app's own confirmed-stale recovery. Some chunk
 * loads (run-start data chunks, LoopScreen's data loads) are caught by
 * the app itself, which probes build-meta.json (isNewBuildDeployed)
 * and — when the deploy really moved — shows its "A new version of
 * Meridian is available." offer with a Refresh button. That offer is a
 * deliberate, owner-reviewed UX (consent + explanation; the run
 * restores from sessionStorage either way), and the inline crash
 * watchdog already treats its copy as a stand-down signal. So this
 * handler does NOT reload on the spot: it waits RECOVERY_DELAY_MS,
 * then stands down if that offer is on screen. Only when no confirmed
 * recovery appears — the boundary dead-end this fix exists for — does
 * it reload. (Pinned by tests/e2e/crash-watchdog.spec.ts: "the app's
 * refresh UI wins".)
 *
 * Two further guards keep it bounded:
 * - Signature: it reacts only to the bundler's `vite:preloadError`
 *   event (dispatched solely for failed chunk preloads) or to an error
 *   whose message is one of the known dynamic-import failure strings
 *   (the backstop listeners below). Unrelated errors never reload.
 * - Episode latch:
 * Reloads at most once per episode. An episode begins when an auto-reload
 * writes its timestamp to sessionStorage. At install, a readable stamp
 * whose age is at most CHUNK_EPISODE_MAX_AGE_MS (900_000 ms) starts an
 * episode on this page; an older stamp is stale, is cleared best-effort,
 * and starts no episode. While an episode is active this handler does not
 * reload again and does not rewrite the stamp. The episode ends after
 * CHUNK_EPISODE_CLEAR_MS (30_000 ms) of continuous failure-free time on a
 * page where the episode is active, counted from when the episode became
 * active on this page (install, when install started it) or from the most
 * recent chunk-failure observation on this page, whichever is later: the
 * stamp is then removed (best-effort) and recovery re-arms on that page.
 * A page that writes the stamp reloads immediately, so its own episode is
 * judged by the next page's install; if a removal failed, the surviving
 * stamp is judged again at that next install under the same age rule.
 * That limit is demand-driven: a chunk that is never requested cannot
 * fail; an idle page can end an episode without the broken chunk being
 * retried — recovery then re-arms for the player's next attempt. When
 * session storage is blocked, auto-recovery promises at most one
 * auto-reload per page load when session storage is blocked, and it makes
 * no promise that a later page load will be prevented from auto-reloading
 * once again if the same chunk is still missing. The stand-down for the
 * app's own recovery applies only to an offer already on screen at the
 * decision point, CHUNK_RECOVERY_DELAY_MS after the failure; an offer
 * that appears after that point does not stand this handler down.
 *
 * Scope: recovery only. Reporting is untouched — the observability
 * pipeline (src/lib/observability.ts) hears the same errors through
 * its own listeners and reports them exactly as before.
 *
 * Service-worker composition (public/sw.js, deliberately unmodified):
 * the SW serves same-origin /assets/ cache-first, but navigations are
 * network-first, so the reload fetches the CURRENT shell — whose chunk
 * URLs are new keys that miss the old cache and load from the network.
 * No skipWaiting, no cache clearing, no SW change is needed; with the
 * SW absent or killed (?nosw=1) plain reload semantics apply unchanged.
 */

/** sessionStorage key holding the last auto-reload time (ms epoch). */
export const CHUNK_RELOAD_KEY = "meridian.chunkReloadAt";

/**
 * How long an active episode must see no chunk failure, on a page
 * where it is active, before it clears and recovery re-arms.
 */
export const CHUNK_EPISODE_CLEAR_MS = 30_000;

/** A stamp older than this at install is stale: it starts no episode. */
export const CHUNK_EPISODE_MAX_AGE_MS = 900_000;

/**
 * How long a chunk failure waits before the auto-reload decision, so
 * the app's own build-meta probe + stale offer can land first and win.
 */
export const CHUNK_RECOVERY_DELAY_MS = 1_500;

/**
 * The app's confirmed-stale offer copy, rendered by game-app.tsx,
 * run-start-notice.tsx and LoopScreen.tsx when isNewBuildDeployed()
 * confirms the deploy moved. The inline crash watchdog
 * (scripts/crash-watchdog.mjs) scans for this same string as its
 * stand-down signal; keep the two in sync.
 */
export const STALE_OFFER_COPY = "A new version of Meridian is available.";

/**
 * The dynamic-import failure strings, per browser engine. A message
 * containing any of these is, in practice, only ever a failed module
 * load — that specificity is what makes the backstop below safe.
 */
const CHUNK_ERROR_SNIPPETS = [
  "Failed to fetch dynamically imported module", // Chromium
  "Importing a module script failed", // Safari
  "error loading dynamically imported module", // Firefox
] as const;

function messageMatches(message: string): boolean {
  return CHUNK_ERROR_SNIPPETS.some((snippet) => message.includes(snippet));
}

/** True when `error` carries the stale-chunk / failed-import signature. */
export function isChunkLoadError(error: unknown): boolean {
  if (typeof error === "string") return messageMatches(error);
  if (!error || typeof error !== "object") return false;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && messageMatches(message);
}

export interface ChunkRecoveryHost {
  addEventListener: (type: string, listener: (event: unknown) => void) => void;
  storage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  } | null;
  reload: () => void;
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => void;
  /** True when the app's confirmed-stale offer is on screen. */
  staleOfferVisible: () => boolean;
}

function defaultStaleOfferVisible(): boolean {
  try {
    const body = document.body;
    if (!body) return false;
    // innerText, not textContent — the same reasoning as the crash
    // watchdog: textContent includes <script>/<style> source, and this
    // module's own bundle contains the copy string, which would make
    // the scan match itself and stand recovery down on every failure.
    const text = body.innerText ?? body.textContent ?? "";
    return text.includes(STALE_OFFER_COPY);
  } catch {
    return false;
  }
}

function defaultHost(): ChunkRecoveryHost | null {
  if (typeof window === "undefined") return null;
  let storage: ChunkRecoveryHost["storage"] = null;
  try {
    storage = window.sessionStorage;
  } catch {
    // Old Safari can throw on mere access; the in-memory stamp remains.
    storage = null;
  }
  return {
    addEventListener: (type, listener) =>
      window.addEventListener(type, listener as EventListener),
    storage,
    reload: () => window.location.reload(),
    now: () => Date.now(),
    setTimeout: (fn, ms) => {
      window.setTimeout(fn, ms);
    },
    staleOfferVisible: defaultStaleOfferVisible,
  };
}

const installedHosts = new WeakSet<object>();
const installedWindows = new WeakSet<object>();

/**
 * Register the recovery listeners on `host` (default: the window).
 * Idempotent per host; default installs are guarded per window.
 */
export function installChunkLoadRecovery(hostArg?: ChunkRecoveryHost): void {
  const host = hostArg ?? defaultHost();
  if (!host) return;
  if (hostArg) {
    if (installedHosts.has(host)) return;
    installedHosts.add(host);
  } else {
    // Default host: defaultHost() builds a fresh host object per call,
    // so the guard is keyed on the window object instead (D4).
    const win = (globalThis as { window?: object }).window;
    if (!win) return;
    if (installedWindows.has(win)) return;
    installedWindows.add(win);
  }

  // Same-page backstop for when sessionStorage is blocked: after a
  // reload this resets, but the storage stamp (when writable) is the
  // cross-reload guard; this one only has to outlive the current page.
  let memoryStamp: number | null = null;
  // Episode latch (D2): all of this state is per-install closure
  // state; the only module-level state is the two install guards.
  let episodeCleared = false;
  let installStale = false;
  let clearGeneration = 0;
  // One decision in flight at a time: a burst of chunk failures from
  // the same incident collapses into a single deferred decision.
  let decisionPending = false;

  const readStamp = (): number | null => {
    let stored: number | null = null;
    try {
      const raw = host.storage?.getItem(CHUNK_RELOAD_KEY);
      const parsed = raw === null || raw === undefined ? NaN : Number(raw);
      stored = Number.isFinite(parsed) ? parsed : null;
    } catch {
      stored = null;
    }
    if (stored === null) return memoryStamp;
    if (memoryStamp === null) return stored;
    return Math.max(stored, memoryStamp);
  };

  const writeStamp = (at: number): void => {
    memoryStamp = at;
    // Any stamp write begins a new episode on this page (D6 S3); the
    // write itself never arms the clear countdown.
    episodeCleared = false;
    installStale = false;
    try {
      host.storage?.setItem(CHUNK_RELOAD_KEY, String(at));
    } catch {
      // Storage unavailable — the in-memory stamp still guards this page.
    }
  };

  const clearStamp = (): void => {
    memoryStamp = null;
    try {
      host.storage?.removeItem(CHUNK_RELOAD_KEY);
    } catch {
      // Best-effort: a surviving stamp is judged again at the next
      // install under the normal age rule (D6 S2).
    }
  };

  const episodeActive = (): boolean => !episodeCleared && !installStale && readStamp() !== null;

  // Arm-or-restart the clear countdown. The host timer returns void,
  // so restarts use a generation token: a firing timer clears only if
  // its generation is current and the deadline has been reached.
  const armClearCountdown = (observedAt: number): void => {
    clearGeneration += 1;
    const generation = clearGeneration;
    const deadline = observedAt + CHUNK_EPISODE_CLEAR_MS;
    try {
      host.setTimeout(() => {
        if (generation !== clearGeneration) return;
        if (host.now() < deadline) return;
        clearStamp();
        episodeCleared = true;
      }, CHUNK_EPISODE_CLEAR_MS);
    } catch {
      // Recovery is best-effort; a timer failure must never throw.
    }
  };

  // Install-time eligibility (D2): a readable stamp whose age is at
  // most CHUNK_EPISODE_MAX_AGE_MS starts an episode on this page and
  // arms its clear countdown; an older stamp is stale — cleared
  // best-effort, no latch (authoritative for this page, D6 S1).
  {
    const stamp = readStamp();
    if (stamp !== null) {
      if (host.now() - stamp <= CHUNK_EPISODE_MAX_AGE_MS) {
        armClearCountdown(host.now());
      } else {
        installStale = true;
        clearStamp();
      }
    }
  }

  const decide = (): void => {
    decisionPending = false;
    try {
      // The app's confirmed-stale offer owns the screen — stand down
      // and let the player's Refresh tap (or dismissal) decide.
      if (host.staleOfferVisible()) return;
      // An active, uncleared episode never reloads and never rewrites
      // the stamp.
      if (episodeActive()) return;
      writeStamp(host.now());
      host.reload();
    } catch {
      // Recovery is best-effort: a failure here must never become a
      // second error on top of the one being recovered from. The manual
      // recovery UI remains the fallback.
    }
  };

  const recover = (signature: boolean): void => {
    if (!signature) return;
    // Observation hook: after the signature check, before the
    // decision-pending check — an observation while an episode is
    // active arms-or-restarts the clear countdown (D2, D6 S3).
    try {
      if (episodeActive()) armClearCountdown(host.now());
    } catch {
      // Best-effort: observation bookkeeping must never throw.
    }
    if (decisionPending) return;
    decisionPending = true;
    try {
      host.setTimeout(decide, CHUNK_RECOVERY_DELAY_MS);
    } catch {
      decisionPending = false;
    }
  };

  // Primary: the bundler dispatches this event ONLY when a chunk
  // preload fails, so the event type alone is the signature. The error
  // is deliberately not preventDefault()'d: the app's own catch paths
  // and error boundaries must still see it exactly as they do today.
  host.addEventListener("vite:preloadError", () => recover(true));

  // Backstop for import failures that never pass through the preload
  // helper (plain import() rejections, engine differences): same
  // signature, read off the error itself. Observability's own error
  // listeners hear these too — reporting is theirs, recovery is ours.
  host.addEventListener("error", (event) => {
    const e = event as { error?: unknown; message?: unknown };
    recover(isChunkLoadError(e?.error ?? e?.message));
  });
  host.addEventListener("unhandledrejection", (event) => {
    const e = event as { reason?: unknown };
    recover(isChunkLoadError(e?.reason));
  });
}
