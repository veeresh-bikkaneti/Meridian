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
 * Announcement dwell: when the failure lands in MapErrorBoundary,
 * its role="alert" card is focused and announced, and a reload
 * 1_500 ms later would cut that announcement short and destroy the
 * focus the boundary just set (PR #245 review, A11Y-2). So when that
 * card is already on screen at the decision point, the reload
 * defers once by CHUNK_ANNOUNCE_DWELL_MS, giving the card at least
 * that much additional dwell before navigation; the deferred
 * decision re-checks the stale offer, the episode latch, and the
 * card itself — if the card has gone (the player recovered during
 * the dwell) the reload stands down. The deferral applies
 * only to a map error card already on screen at the decision point;
 * a card that appears after the decision point does not defer the
 * reload.
 *
 * Post-reload notice: every auto-reload — and the boundary's manual
 * "Try again", via markChunkReloadNotice() — first writes a
 * timestamped flag (CHUNK_RELOAD_NOTICE_KEY). The next boot
 * consumes it (consumeChunkReloadNotice) and shows a
 * role="status" notice that Meridian reloaded, so the change of
 * context is explained after the fact (A11Y-1/A11Y-4; a mitigation,
 * not a cure — the reload is still not user-initiated). The
 * post-reload notice is promised only where session
 * storage is writable; where storage is blocked the reload still
 * happens and no notice is shown. Show-once holds where the flag's
 * removal succeeds; removal is best-effort, so a flag whose removal
 * failed can show the notice once more at a later boot inside its
 * freshness window (pinned, knowingly, by 13-Uf).
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
 * the reload stamp cannot be persisted and read back verified,
 * auto-recovery stands down and does not auto-reload on this or any
 * later failure in that page load. The stand-down for the
 * app's own recovery applies only to an offer already on screen at the
 * decision point, CHUNK_RECOVERY_DELAY_MS after the failure; an offer
 * that appears after that point does not stand this handler down.
 *
 * Scope: recovery only. Reporting is untouched — the observability
 * pipeline (src/lib/observability.ts) hears the same errors through
 * its own listeners and reports them exactly as before.
 *
 * Recovery outcomes (Slice 2, 2026-10-25): the one exception to "this
 * module reports nothing" is a host-injected signal — the module
 * still imports nothing, emits nothing itself, and never lets an
 * outcome concern influence a reload decision. Before a verified
 * reload it writes an outcome marker (a SEPARATE sessionStorage key,
 * `meridian.chunkRecovery`: { v, at, build }) so the next page can
 * report whether the reload worked; the app wires the signal to
 * observability's queued emit, and observability claims the marker
 * at init and owns every terminal emission. A marker write that
 * cannot be persisted and read back verified means the outcome is
 * simply never reported — it never blocks or causes a reload. The
 * offer stand-down writes a terminal marker and signals it instead
 * (see decide()); the unrememberable stand-down above writes
 * nothing and signals nothing.
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
 * sessionStorage key holding the recovery-outcome marker (Slice 2):
 * `{ v: 1, at, build }` written before a verified auto-reload, or the
 * same shape plus `outcome: "stood_down"` for the stand-down record.
 * A separate key on purpose — the reload stamp above is a bare epoch
 * whose readers are load-bearing and must not be reshaped.
 */
export const CHUNK_RECOVERY_KEY = "meridian.chunkRecovery";

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
 * How long the reload defers, once, when the map error card is on
 * screen at the decision point — the announcement dwell. Sized for
 * the card's ~20 words at a slow child screen-reader rate (~120 wpm).
 */
export const CHUNK_ANNOUNCE_DWELL_MS = 10_000;

/** sessionStorage key holding the surface a guarded reload was issued
 *  for (the F3 companion record): written beside the reload stamp by
 *  attemptGuardedChunkReload (the boundary's surface) and by the
 *  handler's own reload decision (the on-screen error card's surface,
 *  else "unknown"). shouldReportChunkFailure compares it against the
 *  failing surface so one surface's healed skew cannot be reported as
 *  another surface's crash. */
export const CHUNK_RELOAD_SURFACE_KEY = "meridian.chunkReloadSurface";

/** sessionStorage key holding the post-reload notice timestamp. */
export const CHUNK_RELOAD_NOTICE_KEY = "meridian.chunkReloadNotice";

/**
 * A notice flag older than this at consume time is stale: cleared, never shown.
 * The inline crash watchdog (scripts/crash-watchdog.mjs) also reads the
 * notice key: a fresh notice surviving to its 28 s timer means, in
 * practice, that the load is a stalled chunk-recovery reload, not a
 * fresh boot failure, so the watchdog files no boot_failure and shows
 * its recovery card instead of the generic boot-failure card. (In
 * practice, not by construction — this flag's removal at consume time
 * is best-effort, so a surviving flag is strong evidence, not proof.)
 * Its 9e5 ms cutoff mirrors this value — keep them in sync.
 */
export const CHUNK_RELOAD_NOTICE_MAX_AGE_MS = 900_000;

/**
 * The MapErrorBoundary card's heading copy (map-error-boundary.tsx).
 * The dwell probe scans rendered text for this string — the same
 * arrangement as STALE_OFFER_COPY and the crash watchdog; keep in sync.
 */
export const MAP_ERROR_CARD_COPY = "Couldn’t load the map.";

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
  if (typeof error === "string") return messageMatches(error) || error.includes("Chunk load timed out");
  if (!error || typeof error !== "object") return false;
  // A hung load bounded by withChunkTimeout (chunk-timeout.ts) rejects
  // with ChunkLoadTimeoutError: a recoverable chunk failure, not an
  // unconditional report.
  const name = (error as { name?: unknown }).name;
  if (name === "ChunkLoadTimeoutError") return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && (messageMatches(message) || message.includes("Chunk load timed out"));
}

/** The slice of storage the reporting helper reads (sessionStorage shape). */
export interface ChunkReportStorage {
  getItem: (key: string) => string | null;
}

/**
 * Reporting discipline for chunk-load failures (arena F3): a chunk
 * failure is reported iff it is the post-reload repeat — a FRESH
 * reload stamp exists (age in [0, CHUNK_EPISODE_MAX_AGE_MS]; a
 * future-dated stamp is not evidence) AND the companion surface
 * record does not name a DIFFERENT surface than the one that failed.
 * The companion reports (matches) when it is absent (legacy reloads
 * wrote none), "unknown", or equal to the failing surface; when the
 * failing surface itself is unknown the companion cannot be shown to
 * differ, so a fresh stamp still reports. A first failure (no stamp,
 * or a stale/future one) stays silent: the guarded reload gets it in
 * silence and a healed skew files no crash report. Storage that
 * cannot be read at all fails loud (report), as the boundary always
 * did — an unverifiable recovery must not swallow a real failure.
 */
export function shouldReportChunkFailure(
  storage: ChunkReportStorage | null | undefined,
  now: number,
  surface?: string,
): boolean {
  if (!storage) return true;
  let stampRaw: string | null;
  try {
    stampRaw = storage.getItem(CHUNK_RELOAD_KEY);
  } catch {
    return true;
  }
  const stamp = stampRaw === null ? NaN : Number(stampRaw);
  if (!Number.isFinite(stamp)) return false;
  const age = now - stamp;
  if (age < 0 || age > CHUNK_EPISODE_MAX_AGE_MS) return false;
  if (surface === undefined || surface === "") return true;
  let companion: string | null;
  try {
    companion = storage.getItem(CHUNK_RELOAD_SURFACE_KEY);
  } catch {
    return true;
  }
  if (companion === null || companion === "unknown") return true;
  return companion === surface;
}

/**
 * Outcome signals chunk-recovery reports through the host (Slice 2).
 * Internal seam names only: never an event type and never a
 * `recoveryOutcome` value at the receiver — observability turns a
 * signal into at most one outcome event.
 */
export type ChunkRecoverySignal = "episode_cleared" | "repeat_failure" | "stood_down";

/** Facts accompanying an outcome signal: the attempt it belongs to. */
export interface ChunkRecoveryOutcomeFacts {
  /** Build id of the session that failed (the marker's build). */
  build?: string;
  /** When the failed attempt began (the marker's `at`, ms epoch). */
  at?: number;
}

/** Optional outcome wiring (host-injected, as the stale-offer detector is). */
export interface ChunkRecoveryOutcomeHooks {
  /** Build id of the bundle that would write the marker (the failing build). */
  buildId?: string;
  /** Called synchronously when an outcome signal resolves; may throw safely. */
  onRecoverySignal?: (signal: ChunkRecoverySignal, facts: ChunkRecoveryOutcomeFacts) => void;
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
  /** True when MapErrorBoundary's error card is on screen. */
  mapErrorCardVisible: () => boolean;
  /** The surface named by the on-screen error card, if it carries one. */
  mapErrorSurface?: () => string | null;
  /** True when a lazy host already recovered in place (its chunk
   *  fallback is on screen, e.g. HomeGlobe's static disc). */
  chunkFallbackPresent?: () => boolean;
  /** Slice 2 outcome wiring (optional; see ChunkRecoveryOutcomeHooks). */
  buildId?: string;
  /** Slice 2 outcome wiring (optional; see ChunkRecoveryOutcomeHooks). */
  onRecoverySignal?: (signal: ChunkRecoverySignal, facts: ChunkRecoveryOutcomeFacts) => void;
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

function defaultMapErrorCardVisible(): boolean {
  // F2: every MapErrorBoundary card carries data-map-error-card, so
  // the dwell probe matches ANY surface's card, not only the map's
  // copy. The legacy copy match stays as the fallback for cards
  // rendered by an older shell. Each probe is guarded separately: a
  // document without querySelector must still reach the text scan.
  try {
    if (typeof document.querySelector === "function" && document.querySelector("[data-map-error-card]")) return true;
  } catch {
    // Fall through to the copy scan.
  }
  try {
    const body = document.body;
    if (!body) return false;
    // innerText for the same reason as defaultStaleOfferVisible:
    // rendered text only, never this module's own bundled copy string.
    const text = body.innerText ?? body.textContent ?? "";
    return text.includes(MAP_ERROR_CARD_COPY);
  } catch {
    return false;
  }
}

function defaultMapErrorSurface(): string | null {
  try {
    const card = document.querySelector("[data-map-error-card]");
    return card?.getAttribute("data-surface") ?? null;
  } catch {
    return null;
  }
}

function defaultChunkFallbackPresent(): boolean {
  try {
    return document.querySelector("[data-chunk-fallback]") !== null;
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
    mapErrorCardVisible: defaultMapErrorCardVisible,
    mapErrorSurface: defaultMapErrorSurface,
    chunkFallbackPresent: defaultChunkFallbackPresent,
  };
}

const installedHosts = new WeakSet<object>();
const installedWindows = new WeakSet<object>();

/**
 * Register the recovery listeners on `host` (default: the window).
 * Idempotent per host; default installs are guarded per window.
 * `hooks` carries the optional Slice 2 outcome wiring for hosts that
 * do not carry it themselves (the app's no-arg production install).
 */
export function installChunkLoadRecovery(
  hostArg?: ChunkRecoveryHost,
  hooks?: ChunkRecoveryOutcomeHooks,
): void {
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

  // --- Slice 2 outcome state ---------------------------------------
  // The outcome wiring: the host's own fields win; install-call hooks
  // fill only what the host lacks. No wiring at all is a supported
  // configuration — recovery then behaves exactly as before.
  const outcomeBuildId = host.buildId ?? hooks?.buildId;
  const outcomeSignal = host.onRecoverySignal ?? hooks?.onRecoverySignal;
  // A parseable pending marker at install makes this page the
  // recovered session for that attempt. The marker is observability's
  // to delete (it owns terminal emission); this page only signals.
  let outcomePending = false;
  let pendingMarker: { at: number; build: string } | null = null;
  // Single-terminal rule: the first terminal signal (repeat_failure
  // or stood_down) resolves the attempt; the terminal flag is set
  // BEFORE the callback runs so duplicate presentations of one
  // failure cannot double-fire. episode_cleared is a leg, not a
  // terminal: a recurrence after it can still fail the attempt.
  let outcomeTerminal = false;
  let outcomeClearSignaled = false;
  // The decision cycle belonging to a failure whose observation
  // already fired a terminal signal is consumed: decide() returns
  // immediately for it — one signature failure, one outcome event.
  let decisionConsumed = false;
  // The offer stand-down signals at most once per page load.
  let stoodDownSignaled = false;
  // Generation token for the pending-only clear countdown (below).
  let pendingClearGeneration = 0;

  interface OutcomeMarkerShape {
    v: 1;
    at: number;
    build: string;
    outcome?: string;
  }

  // The marker-validity predicate (specified once in the Slice 2
  // Consensus Manifest; observability implements the identical
  // predicate for its claim — the two must not drift). Returns the
  // parsed marker only when it is a PENDING attempt: well-formed and
  // carrying no terminal `outcome` field.
  const readPendingMarker = (): OutcomeMarkerShape | null => {
    try {
      const raw = host.storage?.getItem(CHUNK_RECOVERY_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown> | null;
      if (!parsed || typeof parsed !== "object") return null;
      if (parsed.v !== 1) return null;
      if (typeof parsed.at !== "number" || !Number.isFinite(parsed.at)) return null;
      if (typeof parsed.build !== "string" || parsed.build.length === 0) return null;
      if (parsed.claimed !== undefined && typeof parsed.claimed !== "boolean") return null;
      if (parsed.outcome !== undefined) return null; // a terminal record, never pending
      return { v: 1, at: parsed.at, build: parsed.build };
    } catch {
      return null;
    }
  };

  // Write a marker and prove it landed (the persistStamp doctrine:
  // set, then read back and compare). Any failure — no storage, a
  // throw, a missing or mismatched read-back — returns false and
  // leaves a best-effort cleanup behind; callers treat false as "the
  // outcome is simply never reported", never as a reason to change a
  // recovery decision.
  const writeMarkerVerified = (shape: OutcomeMarkerShape): boolean => {
    if (!host.storage) return false;
    let verified = false;
    try {
      host.storage.setItem(CHUNK_RECOVERY_KEY, JSON.stringify(shape));
      const raw = host.storage.getItem(CHUNK_RECOVERY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown> | null;
        verified =
          !!parsed &&
          parsed.v === shape.v &&
          parsed.at === shape.at &&
          parsed.build === shape.build &&
          parsed.outcome === shape.outcome;
      }
    } catch {
      verified = false;
    }
    if (!verified) {
      try {
        host.storage.removeItem(CHUNK_RECOVERY_KEY);
      } catch {
        // Best-effort cleanup, as in persistStamp.
      }
    }
    return verified;
  };

  const removeMarker = (): void => {
    try {
      host.storage?.removeItem(CHUNK_RECOVERY_KEY);
    } catch {
      // Best-effort: a surviving terminal record is recognised and
      // deleted unclaimed at the next init (it carries `outcome`).
    }
  };

  const fireSignalWith = (signal: ChunkRecoverySignal, shape: { at: number; build: string }): void => {
    if (!outcomeSignal) return;
    try {
      outcomeSignal(signal, { build: shape.build, at: shape.at });
    } catch {
      // Outcome reporting must never break recovery.
    }
  };

  const fireSignal = (signal: ChunkRecoverySignal): void => {
    if (!pendingMarker) return;
    fireSignalWith(signal, pendingMarker);
  };

  // The clear leg, shared by the episode countdown and the
  // pending-only countdown: fires at most once, and never after a
  // terminal signal.
  const signalClearLeg = (): void => {
    if (!outcomePending || outcomeTerminal || outcomeClearSignaled) return;
    outcomeClearSignaled = true;
    fireSignal("episode_cleared");
  };

  // Pending-only clear countdown (Slice 2, Architect A6): a pending
  // attempt whose episode stamp is absent or stale at install has no
  // episode countdown to carry its clear leg, so the confirmation
  // standard (30 continuous failure-free seconds on the recovered
  // page) gets its own timer. It is NOT a latch: it never touches the
  // stamp or episode state and never suppresses a reload; it is
  // disarmed by a terminal signal or a successful stamp persist.
  const armPendingClearCountdown = (): void => {
    pendingClearGeneration += 1;
    const generation = pendingClearGeneration;
    try {
      host.setTimeout(() => {
        if (generation !== pendingClearGeneration) return;
        signalClearLeg();
      }, CHUNK_EPISODE_CLEAR_MS);
    } catch {
      // Best-effort, as everywhere in this module.
    }
  };
  const disarmPendingClearCountdown = (): void => {
    pendingClearGeneration += 1;
  };

  // Observation-time outcome resolution for a pending attempt: the
  // design's "emits the outcome first, then latches" — a recurrence
  // is judged here, before any decision for it is scheduled, with the
  // app's offer taking precedence when it is already on screen.
  const observeOutcome = (): void => {
    if (!outcomePending || outcomeTerminal) return;
    // Re-read the marker: if it is gone, observability already
    // emitted a terminal outcome for this attempt — this failure is
    // a fresh incident, not a recurrence.
    const marker = readPendingMarker();
    if (!marker) {
      outcomePending = false;
      pendingMarker = null;
      return;
    }
    pendingMarker = marker;
    let offer = false;
    try {
      offer = host.staleOfferVisible();
    } catch {
      offer = false;
    }
    outcomeTerminal = true;
    decisionConsumed = true;
    disarmPendingClearCountdown();
    fireSignal(offer ? "stood_down" : "repeat_failure");
  };

  // Same-page mirror of the storage stamp: after a reload this
  // resets, but the storage stamp is the cross-reload guard; this one
  // only has to outlive the current page. The mirror never authorises
  // a reload on its own — a reload requires a stamp that persisted
  // and read back verified (see persistStamp).
  let memoryStamp: number | null = null;
  // Episode latch (D2): all of this state is per-install closure
  // state; the only module-level state is the two install guards.
  let episodeCleared = false;
  let installStale = false;
  // Set when a stamp write could not be persisted and verified: this
  // page load never auto-reloads again (no unrememberable reloads).
  // Never cleared within the page load.
  let unrememberable = false;
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

  // The only stamp write, called solely from decide(). A reload is
  // authorised only by a stamp that persisted AND read back verified
  // from storage itself — never by the in-memory mirror, which dies
  // with the page and so cannot guard the reload it would authorise.
  // Storage null, a throw at either step, or a read-back that is
  // missing or not exactly the written value all fail verification:
  // the page stands down for good (unrememberable), the mirror is
  // left unset, and a best-effort cleanup removes any stamp the
  // failed attempt wrote — a survivor is judged again at the next
  // install under the normal age rule.
  const persistStamp = (at: number): boolean => {
    if (!host.storage) {
      unrememberable = true;
      return false;
    }
    let verified = false;
    try {
      host.storage.setItem(CHUNK_RELOAD_KEY, String(at));
      verified = host.storage.getItem(CHUNK_RELOAD_KEY) === String(at);
    } catch {
      verified = false;
    }
    if (!verified) {
      unrememberable = true;
      try {
        host.storage.removeItem(CHUNK_RELOAD_KEY);
      } catch {
        // Best-effort cleanup; see the note above.
      }
      return false;
    }
    memoryStamp = at;
    // Any stamp write begins a new episode on this page (D6 S3); the
    // write itself never arms the clear countdown.
    episodeCleared = false;
    installStale = false;
    // A reload follows immediately; the pending-only countdown (if
    // any) belongs to a page that is about to be replaced.
    disarmPendingClearCountdown();
    return true;
  };

  // The post-reload notice flag: same timestamp as the stamp, in its
  // own guarded write — a blocked store loses the notice, never the
  // reload (14-U2).
  const writeNotice = (at: number): void => {
    try {
      host.storage?.setItem(CHUNK_RELOAD_NOTICE_KEY, String(at));
    } catch {
      // Storage unavailable — the reload proceeds without a notice.
    }
  };

  const cardVisibleSafe = (): boolean => {
    try {
      return host.mapErrorCardVisible();
    } catch {
      return false;
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

  // F5a: the latch can never outlive CHUNK_EPISODE_MAX_AGE_MS from
  // the reload that wrote the stamp, regardless of the clear
  // countdown's restarts — a stamp older than that is not an episode.
  const episodeActive = (): boolean => {
    if (episodeCleared || installStale) return false;
    const stamp = readStamp();
    if (stamp === null) return false;
    return host.now() - stamp <= CHUNK_EPISODE_MAX_AGE_MS;
  };

  // Arm-or-restart the clear countdown. The host timer returns void,
  // so restarts use a generation token: a firing timer clears only if
  // its generation is current and the deadline has been reached.
  const armClearCountdown = (observedAt: number): void => {
    clearGeneration += 1;
    const generation = clearGeneration;
    const deadline = observedAt + CHUNK_EPISODE_CLEAR_MS;
    const schedule = (delay: number): void => {
      host.setTimeout(() => {
        if (generation !== clearGeneration) return;
        // F5b: a backward clock step can fire the timer before the
        // deadline — re-arm for the remainder instead of spending
        // the generation and losing the clear.
        const remaining = deadline - host.now();
        if (remaining > 0) {
          schedule(remaining);
          return;
        }
        clearStamp();
        episodeCleared = true;
        // Slice 2: the episode clear is also the outcome's clear leg
        // (a no-op unless an attempt is pending on this page).
        signalClearLeg();
      }, delay);
    };
    try {
      schedule(CHUNK_EPISODE_CLEAR_MS);
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

  // Slice 2: a pending outcome marker at install makes this page the
  // recovered session for that attempt. With no active episode to
  // carry the clear leg (stamp absent or just cleared as stale), the
  // pending-only countdown carries it instead.
  {
    const marker = readPendingMarker();
    if (marker) {
      outcomePending = true;
      pendingMarker = marker;
      if (!episodeActive()) armPendingClearCountdown();
    }
  }

  // The offer stand-down's outcome (Slice 2): write the terminal
  // marker, and only if it verifiably landed, signal stood_down —
  // then remove the marker (the signal's emit is queued synchronously
  // by the wired sink before this returns). An unverifiable write
  // means no record exists, so no report may fire (no phantom
  // outcomes). Runs at most once per page load.
  const standDownOutcome = (): void => {
    if (stoodDownSignaled) return;
    const shape: OutcomeMarkerShape = {
      v: 1,
      at: host.now(),
      build: outcomeBuildId ?? "unknown",
      outcome: "stood_down",
    };
    if (!writeMarkerVerified(shape)) return;
    stoodDownSignaled = true;
    fireSignalWith("stood_down", shape);
    removeMarker();
  };

  const decide = (deferred: boolean): void => {
    try {
      // Slice 2: the failure that scheduled this cycle already fired
      // its terminal outcome signal at observation — the cycle is
      // consumed and decides nothing further.
      if (decisionConsumed) {
        decisionConsumed = false;
        decisionPending = false;
        return;
      }
      // An earlier failure in this page load could not be remembered
      // (its stamp never persisted): no later failure reloads here.
      if (unrememberable) {
        decisionPending = false;
        return;
      }
      // The app's confirmed-stale offer owns the screen — stand down
      // and let the player's Refresh tap (or dismissal) decide. In a
      // pending session the attempt's outcome was already settled at
      // observation; only a fresh failure produces the stand-down
      // outcome record. Re-checked at the deferred decision (11-U7).
      if (host.staleOfferVisible()) {
        decisionPending = false;
        if (!outcomePending) standDownOutcome();
        return;
      }
      // F4: a lazy host that already recovered in place (HomeGlobe's
      // static-disc fallback is on screen) owns its failure — a
      // handler reload would only yank a healthy Home page.
      try {
        if (host.chunkFallbackPresent?.()) {
          decisionPending = false;
          return;
        }
      } catch {
        // A throwing probe reads as no fallback, as everywhere here.
      }
      // An active, uncleared episode never reloads and never rewrites
      // the stamp. Re-checked at the deferred decision (11-U8).
      if (episodeActive()) {
        decisionPending = false;
        return;
      }
      if (!deferred && cardVisibleSafe()) {
        // The map error card is on screen and being announced: defer
        // once so it gets the full announcement dwell. The decision
        // stays pending across the dwell, so a burst of failures
        // cannot schedule an earlier decision (11-U5).
        try {
          host.setTimeout(() => decide(true), CHUNK_ANNOUNCE_DWELL_MS);
        } catch {
          decisionPending = false;
        }
        return;
      }
      if (deferred && !cardVisibleSafe()) {
        // Cancellation: the card left during the dwell — the player
        // recovered in place. Never yank a healthy screen (11-U4).
        decisionPending = false;
        return;
      }
      decisionPending = false;
      // No unrememberable reloads: reload only on a verified stamp.
      // One `at` twins the stamp, the outcome marker (Slice 2), and
      // the post-reload notice.
      const at = host.now();
      if (!persistStamp(at)) return;
      // F3 companion record: the surface this reload was issued for —
      // the on-screen error card's surface, else "unknown" — so the
      // post-reload repeat is reported only for the same surface.
      try {
        host.storage?.setItem(CHUNK_RELOAD_SURFACE_KEY, host.mapErrorSurface?.() ?? "unknown");
      } catch {
        // Best-effort: an absent companion reports as legacy.
      }
      // The outcome marker rides the verified reload; its own write
      // is isolated and its result never affects the reload.
      writeMarkerVerified({ v: 1, at, build: outcomeBuildId ?? "unknown" });
      writeNotice(at);
      host.reload();
    } catch {
      decisionPending = false;
      // Recovery is best-effort: a failure here must never become a
      // second error on top of the one being recovered from. The manual
      // recovery UI remains the fallback.
    }
  };

  const recover = (signature: boolean): void => {
    if (!signature) return;
    // Slice 2 outcome observation, FIRST: a recurrence inside a
    // pending attempt is judged (and signalled) before any decision
    // for it exists — "emits the outcome first, then latches".
    try {
      observeOutcome();
    } catch {
      // Best-effort: outcome bookkeeping must never throw.
    }
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
      host.setTimeout(() => decide(false), CHUNK_RECOVERY_DELAY_MS);
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

/** Host seam for {@link attemptGuardedChunkReload}: the slice of the
 *  recovery host the one-time reload needs, plus outcome wiring. */
export interface ChunkReloadAttemptHost {
  storage: ChunkRecoveryHost["storage"];
  reload: () => void;
  now: () => number;
  /** Build id for the Slice 2 outcome marker (see install). */
  buildId?: string;
  /** The surface the reload is issued for (F3 companion record). */
  surface?: string;
  /** Runs after the stamp verifies, immediately before the reload —
   *  e.g. the error boundary re-arming a persisted screen so the
   *  reload restores it. A throw is swallowed: it must never block
   *  the reload it precedes. */
  beforeReload?: () => void;
}

function defaultAttemptHost(): ChunkReloadAttemptHost | null {
  if (typeof window === "undefined") return null;
  let storage: ChunkRecoveryHost["storage"] = null;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = null;
  }
  return {
    storage,
    reload: () => window.location.reload(),
    now: () => Date.now(),
  };
}

/**
 * The guarded one-time reload, callable outside the install closure:
 * reload onto the fresh shell at most once per episode, under the
 * same stamp discipline as the auto-recovery decision above.
 *
 * Why this exists (the 2026-11-17 LoopScreen crash): a mid-session
 * deploy rotated the hashed chunks and the old tab's lazy import
 * 404'd. The bundler event fired and this module's handler started
 * its decision window — but the error boundary's staleness probe
 * confirmed the new build first and swapped its card to the stale
 * offer copy, and the decision above defers to ANY on-screen stale
 * offer, so it stood down (and reported the stand-down as the
 * outcome). The card's Refresh is a manual tap; a player who never
 * taps is never recovered, and the boundary had already filed the
 * failure as a crash. The two recoveries deadlocked by each deferring
 * to the other. The boundary now calls this when its own probe
 * confirms staleness for a chunk-load failure: the same verified
 * stamp, the same episode latch, the same notice and outcome marker
 * as the auto-reload — so whichever path fires first reloads exactly
 * once, and the other finds the stamp fresh and stands down.
 *
 * Returns true when the reload was issued — including past a stale
 * stamp (older than the episode max age) or a future-dated stamp:
 * neither is evidence of a reload in this episode, so each is cleared
 * best-effort and the reload proceeds (the install-time stale rule,
 * and the F3 helper's [0, MAX] window). Returns false — and does not
 * reload — only when a fresh stamp (age in [0, CHUNK_EPISODE_MAX_AGE_MS])
 * says this episode already used its reload (a chunk that still fails
 * after it is genuinely broken, and the caller keeps its manual
 * recovery card), or when the stamp cannot be persisted and read back
 * verified (no unrememberable reloads, as in decide()).
 */
export function attemptGuardedChunkReload(hostArg?: Partial<ChunkReloadAttemptHost>): boolean {
  // A partial host (the boundary passes only its build id and its
  // pre-reload hook) is completed from the window defaults; an
  // explicitly null storage is honoured, never overridden.
  const defaults = defaultAttemptHost();
  const host: ChunkReloadAttemptHost | null = hostArg
    ? {
        storage: hostArg.storage !== undefined ? hostArg.storage : (defaults?.storage ?? null),
        reload: hostArg.reload ?? defaults?.reload ?? (() => {}),
        now: hostArg.now ?? defaults?.now ?? (() => Date.now()),
        buildId: hostArg.buildId,
        surface: hostArg.surface,
        beforeReload: hostArg.beforeReload,
      }
    : defaults;
  if (!host || !host.storage) return false;
  const storage = host.storage;
  try {
    const at = host.now();
    const raw = storage.getItem(CHUNK_RELOAD_KEY);
    const stamp = raw === null ? NaN : Number(raw);
    if (Number.isFinite(stamp)) {
      const age = at - stamp;
      if (age >= 0 && age <= CHUNK_EPISODE_MAX_AGE_MS) return false;
      // Stale or future-dated stamp: not evidence of a reload in
      // this episode (F5c) — clear best-effort and proceed.
      try {
        storage.removeItem(CHUNK_RELOAD_KEY);
      } catch {
        // Best-effort, as everywhere in this module.
      }
    }
    storage.setItem(CHUNK_RELOAD_KEY, String(at));
    if (storage.getItem(CHUNK_RELOAD_KEY) !== String(at)) {
      try {
        storage.removeItem(CHUNK_RELOAD_KEY);
      } catch {
        // Best-effort cleanup of the unverifiable stamp.
      }
      return false;
    }
    // The outcome marker rides the verified reload exactly as in
    // decide(); its write is isolated and never affects the reload.
    try {
      const shape = { v: 1, at, build: host.buildId ?? "unknown" };
      storage.setItem(CHUNK_RECOVERY_KEY, JSON.stringify(shape));
      const back = storage.getItem(CHUNK_RECOVERY_KEY);
      const parsed = back ? (JSON.parse(back) as Record<string, unknown> | null) : null;
      if (!parsed || parsed.v !== shape.v || parsed.at !== shape.at || parsed.build !== shape.build) {
        storage.removeItem(CHUNK_RECOVERY_KEY);
      }
    } catch {
      try {
        storage.removeItem(CHUNK_RECOVERY_KEY);
      } catch {
        // Best-effort cleanup.
      }
    }
    try {
      storage.setItem(CHUNK_RELOAD_NOTICE_KEY, String(at));
    } catch {
      // A blocked store loses the notice, never the reload.
    }
    // F3 companion record, beside the stamp (see decide()).
    try {
      storage.setItem(CHUNK_RELOAD_SURFACE_KEY, host.surface ?? "unknown");
    } catch {
      // Best-effort: an absent companion reports as legacy.
    }
    if (host.beforeReload) {
      try {
        host.beforeReload();
      } catch {
        // The hook must never block the reload it precedes.
      }
    }
    host.reload();
    return true;
  } catch {
    return false;
  }
}

/**
 * Record that a reload is about to happen, so the next boot can
 * explain it (the post-reload notice). Called by the auto-reload
 * path (via the install closure's own write) and by
 * MapErrorBoundary's manual "Try again". Best-effort: never throws,
 * and a blocked store simply means no notice.
 */
export function markChunkReloadNotice(): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(CHUNK_RELOAD_NOTICE_KEY, String(Date.now()));
  } catch {
    // Storage unavailable — the reload proceeds without a notice.
  }
}

/**
 * Consume the post-reload notice flag at boot. Returns true once
 * per fresh flag whose removal succeeds: a present value is always
 * removed (best-effort — a flag whose removal failed is judged
 * again at the next boot and can return true once more inside its
 * freshness window, 13-Uf), and stale, malformed, or future values
 * return false after being cleared, so a flag can never surface on
 * a wrong later boot. Never throws.
 */
export function consumeChunkReloadNotice(
  hostArg?: Pick<ChunkRecoveryHost, "storage" | "now">,
): boolean {
  let storage: ChunkRecoveryHost["storage"] = null;
  let now: () => number = () => Date.now();
  if (hostArg) {
    storage = hostArg.storage;
    now = hostArg.now;
  } else {
    if (typeof window === "undefined") return false;
    try {
      storage = window.sessionStorage;
    } catch {
      return false;
    }
  }
  let raw: string | null;
  try {
    raw = storage?.getItem(CHUNK_RELOAD_NOTICE_KEY) ?? null;
  } catch {
    return false;
  }
  if (raw === null) return false;
  try {
    storage?.removeItem(CHUNK_RELOAD_NOTICE_KEY);
  } catch {
    // Best-effort: a surviving flag is judged again at the next
    // boot under the same age rule.
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return false;
  const age = now() - parsed;
  return age >= 0 && age <= CHUNK_RELOAD_NOTICE_MAX_AGE_MS;
}
