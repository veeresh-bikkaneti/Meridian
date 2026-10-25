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
 * Two further guards keep it from ever looping:
 * - Signature: it reacts only to the bundler's `vite:preloadError`
 *   event (dispatched solely for failed chunk preloads) or to an error
 *   whose message is one of the known dynamic-import failure strings
 *   (the backstop listeners below). Unrelated errors never reload.
 * - Window: a sessionStorage timestamp caps auto-reloads to one per
 *   CHUNK_RELOAD_WINDOW_MS in a tab session. If the chunk is genuinely
 *   missing (a bad deploy, not a stale tab), the post-reload failure
 *   lands inside the window, no second reload fires, and the manual
 *   recovery UI stays in charge. After the window the recovery
 *   re-arms: a later deploy deserves a later recovery. An in-memory
 *   stamp backs the storage one up, so storage-blocked browsers still
 *   get same-page protection.
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

/** At most one auto-reload per this window in a tab session. */
export const CHUNK_RELOAD_WINDOW_MS = 30_000;

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

export interface ChunkRecoveryDecision {
  /** The failure carried the chunk-load signature. */
  signature: boolean;
  /** Current time (ms epoch). */
  now: number;
  /** When the last auto-reload happened in this session, if ever. */
  lastReloadAt: number | null;
  /** Override for tests; defaults to CHUNK_RELOAD_WINDOW_MS. */
  windowMs?: number;
}

/** Pure decision: reload only for chunk failures, at most once per window. */
export function shouldAutoReloadChunk(decision: ChunkRecoveryDecision): boolean {
  if (!decision.signature) return false;
  if (decision.lastReloadAt === null) return true;
  const windowMs = decision.windowMs ?? CHUNK_RELOAD_WINDOW_MS;
  return decision.now - decision.lastReloadAt >= windowMs;
}

export interface ChunkRecoveryHost {
  addEventListener: (type: string, listener: (event: unknown) => void) => void;
  storage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
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

/**
 * Register the recovery listeners on `host` (default: the window).
 * Idempotent per host. No-op outside a browser. Never throws.
 */
export function installChunkLoadRecovery(hostArg?: ChunkRecoveryHost): void {
  const host = hostArg ?? defaultHost();
  if (!host || installedHosts.has(host)) return;
  installedHosts.add(host);

  // Same-page backstop for when sessionStorage is blocked: after a
  // reload this resets, but the storage stamp (when writable) is the
  // cross-reload guard; this one only has to outlive the current page.
  let memoryStamp: number | null = null;
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
    try {
      host.storage?.setItem(CHUNK_RELOAD_KEY, String(at));
    } catch {
      // Storage unavailable — the in-memory stamp still guards this page.
    }
  };

  const decide = (): void => {
    decisionPending = false;
    try {
      // The app's confirmed-stale offer owns the screen — stand down
      // and let the player's Refresh tap (or dismissal) decide.
      if (host.staleOfferVisible()) return;
      const now = host.now();
      if (!shouldAutoReloadChunk({ signature: true, now, lastReloadAt: readStamp() })) return;
      writeStamp(now);
      host.reload();
    } catch {
      // Recovery is best-effort: a failure here must never become a
      // second error on top of the one being recovered from. The manual
      // recovery UI remains the fallback.
    }
  };

  const recover = (signature: boolean): void => {
    if (!signature || decisionPending) return;
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
