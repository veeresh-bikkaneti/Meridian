/**
 * detective-audio.ts — the pair's sequential speech player (U5).
 *
 * One queue, one voice at a time: dialogue is strictly sequential by
 * design (council Q3 — the authored gap between speakers does the
 * interrupting; there is no overlap). The player resolves the state
 * machine's speak intents (SpeakRef) to pre-rendered clips through the
 * audio manifest and plays them in enqueue order.
 *
 * Coverage = manifest ENTRY PRESENCE. A ref with no entry is skipped
 * silently — a case without renders plays exactly as today's game
 * (BUILD-SCOPE §1.6 fallback law), and the queue NEVER stalls on a
 * missing or broken clip: a 404 / codec error resolves as skipped.
 *
 * Gates, checked at PLAY time (not enqueue time, so a toggle mid-queue
 * is honoured):
 * - the global sound toggle (isSoundEnabled, src/game/audio/sfx.ts) and
 *   the hidden-tab guard (soundAudible, src/game/audio/play-guards.ts);
 * - the player's read-aloud preference: auto-speech only when
 *   shouldAutoPlayReadAloud allows it for this surface. The detective
 *   loop is an autoplay surface by design (like the 5–7 story cards),
 *   so the host context passes bandAutoplay=true — the preference still
 *   vetoes: "never" and "sometimes" mean no auto speech, ever.
 * - first-gesture unlock: browsers refuse audio before a user gesture,
 *   so playback waits for the first pointerdown, following the
 *   storyteller's proven one-shot pattern (decideFirstGesture in
 *   storyteller-audio-guards.ts): a gesture that lands while sound is
 *   off does NOT consume the one-shot.
 *
 * Speech modes (U9, degradation matrix §2.5 — the mode itself is
 * decided by detective-degradation.ts and set by the host):
 * - "auto": the U5 behaviour above, unchanged — plus retention: the
 *   player ALSO remembers the most recent clue sequence (Unit A), so
 *   a tap on Watson can replay it (see "tap").
 * - "tap": an enqueued item resolves immediately as skipped — the
 *   ladder advances silently, exactly like a dropped item — BUT the
 *   player remembers the most recent clue sequence (the current
 *   clue's read + ack + decode chain). The host's Listen button and
 *   the tap-Watson control both call playHeldSequence() to play
 *   those held refs for real; the sound gate still applies at that
 *   play time, the read-aloud autoplay veto does NOT (a tap is the
 *   kid choosing to listen). Two kinds of speech are gesture-
 *   initiated and play for real in tap mode for the same reason:
 *   selection reads (the selecting tap) and guess reads (the
 *   confirm tap — the host marks them via armGuessRead around its
 *   guessConfirmed dispatch; PR 2a cure 3: before that marking, a
 *   tap-mode guess read resolved as skipped like ambient speech,
 *   so the reaction to a confirmed guess never sounded).
 * - "off": items resolve skipped and nothing is held.
 *
 * Retention happens at ENQUEUE time (Unit A), not play time: a clue
 * chain is enqueued as one synchronous burst while its first clip is
 * still playing, so play-time recording would hold only the clip in
 * flight and a mid-play replay could not restart the full chain.
 *
 * The manifest loads lazily. The player asks for the slice a line
 * needs: a small index (voices and fixed lines), then that case's
 * file, or the names file when a place is spoken. A missing index,
 * or a shard that fails for a reason other than 404, falls back to
 * the monolithic manifest.json for the rest of the session. A 404
 * shard is uncovered audio — silent, same as a missing entry — and
 * does not pull the monolith. A failed load degrades to empty
 * coverage. It never blocks case play.
 *
 * Injected boundaries: every environment touchpoint (manifest load, clip
 * playback, gates) is injectable, so the queue logic is node-testable
 * with no DOM and no real Audio element.
 */

// Relative imports with extensions, so this module loads under the
// repo's node --test runner (no bundler alias resolution) as well as Vite.
import { assetBase } from "../../../lib/asset-base.ts";
import { decideFirstGesture } from "../../../lib/storyteller-first-gesture.ts";
import { isSoundEnabled } from "../../audio/sfx.ts";
import { soundAudible } from "../../audio/play-guards.ts";
import {
  claimVoice,
  resolveVoiceFactory,
  type VoiceClaim,
  type VoiceFactory,
  type VoiceFactoryHandle,
} from "../../audio/voice-channel.ts";
import {
  getReadAloudPref,
  shouldAutoPlayReadAloud,
} from "../../age-profile/read-aloud-pref.ts";
import type { SpeakRef } from "./detective-state.ts";
import type { SpeechMode } from "./detective-degradation.ts";

export type { SpeechMode };

/* ------------------------------------------------------------------ */
/* Manifest shape (public/audio/detective/manifest.json, U1–U3)        */
/* ------------------------------------------------------------------ */

export interface DetectiveManifestEntry {
  file: string;
  voice: string;
}

export interface DetectiveManifest {
  v: number;
  voices: { holmes: string; watson: string };
  fixed: Record<string, DetectiveManifestEntry | undefined>;
  cases: Record<
    string,
    | {
        clues: Array<DetectiveManifestEntry | null | undefined>;
        answer: DetectiveManifestEntry | null;
      }
    | undefined
  >;
  names: Record<string, DetectiveManifestEntry | undefined>;
}

export type DetectiveSpeaker = "holmes" | "watson";

export interface ResolvedClip {
  /** URL path under the app base, e.g. "audio/detective/case-387/clue-1.mp3". */
  url: string;
  who: DetectiveSpeaker;
}

/**
 * Pure ref → clip resolution. Returns null when the manifest has no
 * entry for the ref (uncovered = silent, by the fallback law).
 * `caseIndex` is the case the player is bound to (clue/answer refs are
 * per-case; fixed and name refs are global).
 */
export function resolveDetectiveClip(
  manifest: DetectiveManifest | null,
  ref: SpeakRef,
  caseIndex: number,
  base: string = assetBase(),
): ResolvedClip | null {
  if (!manifest) return null;
  let entry: DetectiveManifestEntry | null | undefined;
  switch (ref.kind) {
    case "clue":
      entry = manifest.cases[String(caseIndex)]?.clues[ref.clueIndex - 1];
      break;
    case "answer":
      entry = manifest.cases[String(caseIndex)]?.answer;
      break;
    case "fixed":
      entry = manifest.fixed[ref.id];
      break;
    case "name": {
      // Picks carry GeoNames ids ("geonames:323786"); the manifest's
      // names table is keyed by the bare numeric id.
      const key = ref.placeId.startsWith("geonames:")
        ? ref.placeId.slice("geonames:".length)
        : ref.placeId;
      entry = manifest.names[key];
      break;
    }
    case "debrief":
      // U5: the debrief ref resolves to the frame line; U8 sequences the
      // full debrief (frame → name → close) as separate fixed refs.
      entry = manifest.fixed["debrief-frame"];
      break;
  }
  if (!entry || typeof entry.file !== "string" || entry.file.length === 0) {
    return null;
  }
  const who: DetectiveSpeaker =
    entry.voice === manifest.voices?.watson
      ? "watson"
      : entry.voice === manifest.voices?.holmes
        ? "holmes"
        : ref.kind === "clue"
          ? "watson"
          : "holmes";
  return { url: `${base}audio/detective/${entry.file}`, who };
}

/* ------------------------------------------------------------------ */
/* Lazy manifest load: per-case shards, monolith as fallback           */
/* ------------------------------------------------------------------ */

const SPLIT_INDEX_PATH = "audio/detective/split/index.json";
const SPLIT_NAMES_PATH = "audio/detective/split/names.json";
const MONOLITH_PATH = "audio/detective/manifest.json";

interface SplitIndex {
  v: 1;
  split: 1;
  voices: { holmes: string; watson: string };
  fixed: Record<string, DetectiveManifestEntry | undefined>;
}

type CaseBucket = NonNullable<DetectiveManifest["cases"][string]>;

let manifestPromise: Promise<DetectiveManifest | null> | null = null;
let splitIndexPromise: Promise<SplitIndex | null> | null = null;
let monolithPromise: Promise<DetectiveManifest | null> | null = null;
let namesPromise: Promise<Record<string, DetectiveManifestEntry | undefined> | null> | null = null;
const casePromises = new Map<number, Promise<CaseBucket | null>>();
/** Set when the shards cannot be trusted. Later resolves use the monolith. */
let splitUnavailable = false;

type FetchResult =
  | { state: "ok"; body: unknown }
  | { state: "missing" }
  | { state: "error" };

async function fetchJson(fetchImpl: typeof fetch, url: string): Promise<FetchResult> {
  try {
    const res = await fetchImpl(url);
    if (res.status === 404) return { state: "missing" };
    if (!res.ok) return { state: "error" };
    try {
      return { state: "ok", body: await res.json() };
    } catch {
      return { state: "error" };
    }
  } catch {
    return { state: "error" };
  }
}

function parseMonolith(body: unknown): DetectiveManifest | null {
  if (!body || typeof body !== "object") return null;
  const m = body as Partial<DetectiveManifest> & { split?: number };
  if (m.v !== 1 || m.split === 1) return null;
  return {
    v: 1,
    voices: m.voices ?? { holmes: "", watson: "" },
    fixed: m.fixed ?? {},
    cases: m.cases ?? {},
    names: m.names ?? {},
  };
}

function parseSplitIndex(body: unknown): SplitIndex | null {
  if (!body || typeof body !== "object") return null;
  const m = body as Partial<SplitIndex>;
  if (m.v !== 1 || m.split !== 1) return null;
  if (!m.fixed || typeof m.fixed !== "object") return null;
  return {
    v: 1,
    split: 1,
    voices: m.voices ?? { holmes: "", watson: "" },
    fixed: m.fixed,
  };
}

function markSplitUnavailable(): void {
  splitUnavailable = true;
}

function loadSplitIndex(fetchImpl: typeof fetch): Promise<SplitIndex | null> {
  if (!splitIndexPromise) {
    splitIndexPromise = (async () => {
      const got = await fetchJson(fetchImpl, `${assetBase()}${SPLIT_INDEX_PATH}`);
      if (got.state !== "ok") {
        markSplitUnavailable();
        return null;
      }
      const index = parseSplitIndex(got.body);
      if (index) return index;
      // A response that is the monolith (the unit seam returns one
      // body for every URL, and an old host may do the same) is the
      // fallback manifest. Do not fetch shards after that.
      const mono = parseMonolith(got.body);
      if (mono) monolithPromise = Promise.resolve(mono);
      markSplitUnavailable();
      return null;
    })();
  }
  return splitIndexPromise;
}

function loadMonolith(fetchImpl: typeof fetch): Promise<DetectiveManifest | null> {
  if (!monolithPromise) {
    monolithPromise = (async () => {
      const got = await fetchJson(fetchImpl, `${assetBase()}${MONOLITH_PATH}`);
      if (got.state !== "ok") return null;
      return parseMonolith(got.body);
    })();
  }
  return monolithPromise;
}

function fixedView(index: SplitIndex): DetectiveManifest {
  return {
    v: 1,
    voices: index.voices,
    fixed: index.fixed,
    cases: {},
    names: {},
  };
}

function loadCaseBucket(caseIndex: number, fetchImpl: typeof fetch): Promise<CaseBucket | null> {
  let pending = casePromises.get(caseIndex);
  if (!pending) {
    pending = (async () => {
      const got = await fetchJson(fetchImpl, `${assetBase()}audio/detective/split/cases/${caseIndex}.json`);
      if (got.state === "missing") return null;
      if (got.state === "error") {
        markSplitUnavailable();
        return null;
      }
      const body = got.body;
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        markSplitUnavailable();
        return null;
      }
      const bucket = body as { clues?: unknown; answer?: unknown };
      const answer = bucket.answer;
      return {
        clues: Array.isArray(bucket.clues) ? (bucket.clues as CaseBucket["clues"]) : [],
        answer:
          answer && typeof answer === "object"
            ? (answer as DetectiveManifestEntry)
            : null,
      };
    })();
    casePromises.set(caseIndex, pending);
  }
  return pending;
}

function loadNames(fetchImpl: typeof fetch): Promise<Record<string, DetectiveManifestEntry | undefined> | null> {
  if (!namesPromise) {
    namesPromise = (async () => {
      const got = await fetchJson(fetchImpl, `${assetBase()}${SPLIT_NAMES_PATH}`);
      if (got.state === "missing") return {};
      if (got.state === "error") {
        markSplitUnavailable();
        return null;
      }
      const body = got.body;
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        markSplitUnavailable();
        return null;
      }
      return body as Record<string, DetectiveManifestEntry | undefined>;
    })();
  }
  return namesPromise;
}

/**
 * Fixed lines, or the whole monolith when the split index is absent.
 * The summary celebration speaks one fixed line and uses this path,
 * so it does not download every case.
 */
export function loadDetectiveManifest(
  fetchImpl: typeof fetch = fetch,
): Promise<DetectiveManifest | null> {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      const index = await loadSplitIndex(fetchImpl);
      if (index && !splitUnavailable) return fixedView(index);
      return loadMonolith(fetchImpl);
    })();
  }
  return manifestPromise;
}

/**
 * The manifest slice that can resolve `ref` for `caseIndex`.
 * Clue and answer lines fetch that case's file. A name line fetches
 * the names file (a pick is not scoped to the deck). Fixed lines use
 * the index alone. See loadDetectiveManifest for the fallback rule.
 */
export function loadDetectiveManifestFor(
  ref: SpeakRef,
  caseIndex: number,
  fetchImpl: typeof fetch = fetch,
): Promise<DetectiveManifest | null> {
  return (async () => {
    const index = await loadSplitIndex(fetchImpl);
    if (!index || splitUnavailable) return loadMonolith(fetchImpl);
    const view = fixedView(index);
    if (ref.kind === "clue" || ref.kind === "answer") {
      const bucket = await loadCaseBucket(caseIndex, fetchImpl);
      if (splitUnavailable) return loadMonolith(fetchImpl);
      if (bucket) view.cases[String(caseIndex)] = bucket;
      return view;
    }
    if (ref.kind === "name") {
      const names = await loadNames(fetchImpl);
      if (splitUnavailable || names == null) return loadMonolith(fetchImpl);
      view.names = names;
      return view;
    }
    return view;
  })();
}

/** Helper: drop the cached manifest promises. */
export function clearDetectiveManifestCache(): void {
  manifestPromise = null;
  splitIndexPromise = null;
  monolithPromise = null;
  namesPromise = null;
  casePromises.clear();
  splitUnavailable = false;
}

/* ------------------------------------------------------------------ */
/* The player                                                          */
/* ------------------------------------------------------------------ */

export interface DetectiveSpeechOptions {
  /** Fires when a clip starts (with its speaker) and once with null
   * when the queue fully drains. The host maps the null drain to the
   * machine's speechEnded event. */
  onSpeakingChange?: (who: DetectiveSpeaker | null) => void;
  /** Case the clue/answer refs resolve against. */
  caseIndex?: number;
  /** Initial speech mode (U9); the host updates it via setSpeechMode
   * as the degradation signals change. Defaults to "auto" (U5). */
  speechMode?: SpeechMode;
  /* Injected boundaries (defaults wire the real environment). */
  loadManifest?: (ref: SpeakRef, caseIndex: number) => Promise<DetectiveManifest | null>;
  /** Play one clip. `signal` aborts when something else needs the
   * voice (a pick, a replay, stopAll): stop sounding and resolve. */
  playClip?: (clip: ResolvedClip, signal: AbortSignal) => Promise<void>;
  /** Make one voice for a clip, for the default clip player. The
   * domain may not import the audio port, so the factory arrives
   * here: per player, or the startup-registered one. With no
   * factory the default player resolves clips as skipped. */
  createVoice?: VoiceFactory;
  isSoundOn?: () => boolean;
  canAutoPlay?: () => boolean;
}

export interface DetectiveSpeechPlayer {
  enqueue(ref: SpeakRef): void;
  stopAll(): void;
  dispose(): void;
  setCaseIndex(caseIndex: number): void;
  /** U9: set the speech mode ("auto" | "tap" | "off"). Entering
   * "off" drops the held sequence (in "off" nothing is held);
   * switching between "auto" and "tap" keeps it — both modes retain
   * the current clue's chain for replay (Unit A). */
  setSpeechMode(mode: SpeechMode): void;
  getSpeechMode(): SpeechMode;
  /** The held clue sequence (read + ack + decode of the most recent
   * clue), oldest first, retained in "auto" and "tap" modes. Empty
   * in "off" mode. */
  heldRefs(): readonly SpeakRef[];
  /** Play the held sequence for real (the Listen button in tap mode;
   * the tap-Watson control in auto and tap modes). Sound gates still
   * apply at play time; a no-op in "off" mode or when nothing is
   * held. Calling it while speech is playing RESTARTS the held
   * sequence from its first item (Unit A: an explicit repeat request
   * interrupts whatever is in flight). */
  playHeldSequence(): Promise<void>;
  /** PR 2a cure 3: arm/disarm the guess-read window. The host arms
   * immediately before dispatching guessConfirmed to the machine
   * and disarms immediately after; every speak ref enqueued inside
   * that synchronous window IS the guess read (the machine emits it
   * as one burst: the guess's name where it was not just named,
   * then suspicion). Marked refs play for real in "tap" mode — the
   * confirm tap is the kid's own gesture, exactly like the
   * selecting tap behind a selection read — instead of resolving
   * as skipped. No observable effect in "auto" (everything plays)
   * or "off" (nothing does). */
  armGuessRead(): void;
  disarmGuessRead(): void;
}

/** Is this ref part of a clue sequence — the chain the tap-mode hold
 * keeps (a clue's read + its ack + its decode)? Selection reads,
 * ask-next, instructions, endings and the debrief are NOT held: the
 * Listen button replays the current clue, not the whole case. */
/** Case-ending lines (the solve's win lines + debrief, the loss's
 * answer + cheer-up). They follow straight from the kid's own confirm
 * tap, so tap speech mode plays them for real instead of skipping
 * them (plan of record §5: "ending lines must speak in tap mode").
 * A non-selection name read outside the guess-read arm is the
 * debrief's answer name — an ending line too. */
const ENDING_FIXED_IDS: ReadonlySet<string> = new Set([
  "win-holmes",
  "win-watson",
  "win-together",
  "debrief-frame",
  "debrief-close",
  "truce-watson",
]);
export function isEndingRef(ref: SpeakRef): boolean {
  if (ref.kind === "answer" || ref.kind === "debrief") return true;
  if (ref.kind === "name") return ref.selection !== true;
  return ref.kind === "fixed" && ENDING_FIXED_IDS.has(ref.id);
}

function isClueSequenceRef(ref: SpeakRef): boolean {
  if (ref.kind === "clue") return true;
  if (ref.kind === "fixed") {
    return ref.id.startsWith("ack-") || ref.id.startsWith("decode-");
  }
  return false;
}

/** Default autoplay gate for the detective loop surface: the surface
 * requests autoplay (bandAutoplay=true — see the header for why), the
 * kid's read-aloud preference and the sound toggle decide. */
export function detectiveCanAutoPlay(): boolean {
  const soundOn = isSoundEnabled();
  return shouldAutoPlayReadAloud(getReadAloudPref(), true, soundOn);
}

export function createDetectiveSpeech(
  opts: DetectiveSpeechOptions = {},
): DetectiveSpeechPlayer {
  const onSpeakingChange = opts.onSpeakingChange ?? (() => {});
  const loadManifest =
    opts.loadManifest ??
    ((ref: SpeakRef, caseIndex: number) => loadDetectiveManifestFor(ref, caseIndex));
  const isSoundOn = opts.isSoundOn ?? (() => isSoundEnabled() && soundAudible());
  const canAutoPlay = opts.canAutoPlay ?? detectiveCanAutoPlay;

  let caseIndex = opts.caseIndex ?? 0;
  let queue: SpeakRef[] = [];
  let processing = false;
  /* -- selection reads (user-initiated name reads) -------------------
   * The set marks queue items that are selection reads. They are never
   * held for replay, and in "tap" mode they play for real (the
   * selecting tap is the gesture) instead of resolving as skipped. */
  const selectionItems = new WeakSet<SpeakRef>();
  /* -- guess reads (PR 2a cure 3) ------------------------------------
   * The same tap-mode treatment as selection reads — the confirm tap
   * is the kid's gesture too — but a SEPARATE set: the selection
   * path's latest-wins splice removes a queued selection item by
   * set membership, and a guess already spent must never be spliced
   * out by a later pick. Refs join this set only while the host's
   * guess-read arm stands (armGuessRead), which brackets exactly
   * the machine's guess-read burst. */
  const guessItems = new WeakSet<SpeakRef>();
  let guessReadArmed = false;
  /* -- U9 speech mode + clue-sequence hold (Unit A: auto too) ------- */
  let speechMode: SpeechMode = opts.speechMode ?? "auto";
  /** The most recent clue sequence, remembered in "tap" and "auto"
   * modes (in "tap" while its items resolve as skipped; in "auto"
   * while they play). A new clue read starts a new hold; its ack +
   * decode append. Cleared on entering "off" and on a new case
   * (setCaseIndex to a different case). */
  let held: SpeakRef[] = [];
  /** Replay generation (Unit A): every playHeldSequence() call bumps
   * this, so a superseded replay loop — one a second tap replaced —
   * abandons ship without clearing the new loop's state or firing a
   * second drain signal. */
  let heldPlaySeq = 0;

  function recordHeld(ref: SpeakRef): void {
    if (!isClueSequenceRef(ref)) return;
    if (ref.kind === "clue") {
      held = [ref];
      return;
    }
    // ack/decode with no read held (e.g. the mode flipped mid-chain):
    // a chain without its read is not a clue sequence — hold nothing.
    if (!held.some((r) => r.kind === "clue")) return;
    if (
      ref.kind === "fixed" &&
      held.some((r) => r.kind === "fixed" && r.id === ref.id)
    ) {
      return; // already in this chain
    }
    held = [...held, ref];
  }
  /** Bumped by stopAll/dispose: an in-flight loop from an older
   * generation abandons ship without signalling a drain. */
  let generation = 0;
  let disposed = false;

  /* -- first-gesture unlock (default clip player only) --------------- */
  let gestureUnlocked = false;
  let gestureWaiters: Array<() => void> = [];
  let gestureListenerArmed = false;
  function armGestureListener(): void {
    if (gestureListenerArmed || gestureUnlocked) return;
    if (typeof window === "undefined") {
      gestureUnlocked = true;
      return;
    }
    gestureListenerArmed = true;
    const onGesture = () => {
      // Storyteller pattern: don't consume the one-shot while sound is
      // off — stay armed so a later gesture (or unmute + gesture) works.
      const decision = decideFirstGesture({
        alreadyDone: gestureUnlocked,
        dismissed: false,
        celebrationActive: false,
        soundOn: isSoundEnabled(),
      });
      if (decision !== "consume") return;
      gestureUnlocked = true;
      window.removeEventListener("pointerdown", onGesture);
      const waiters = gestureWaiters;
      gestureWaiters = [];
      for (const wake of waiters) wake();
    };
    window.addEventListener("pointerdown", onGesture);
  }
  function waitForGesture(): Promise<void> {
    if (gestureUnlocked) return Promise.resolve();
    armGestureListener();
    if (gestureUnlocked) return Promise.resolve();
    return new Promise((resolve) => gestureWaiters.push(resolve));
  }

  /* -- Listen first-tap cure (STAGE step 6) -------------------------
   * Arm the first-gesture listener EAGERLY, at player creation —
   * not lazily inside the first playClip. In tap mode nothing ever
   * calls playClip before the kid taps Listen (the queue skips
   * every item without playing), so a lazy listener meant the
   * first Listen tap only armed it and nothing played until a
   * second tap (the owner's live defect; the two-tap flow is
   * recorded as "by design" in tests/e2e/detective-sound.spec.ts
   * (f)). Arming early only moves the unlock to the first
   * pointerdown anywhere — exactly the storyteller pattern — and
   * the listener still consumes only when sound is on
   * (decideFirstGesture); it never starts playback by itself.
   * Auto mode is unchanged: its first clip armed the same
   * listener before playing, and an earlier arm unlocks no
   * sooner than the first gesture either way. */
  armGestureListener();

  /* -- default clip playback: one HTMLAudioElement chain ------------- */
  /* -- ONE clip at a time (the owner's rule: "if one speak the other
   * needs to shut up") ---------------------------------------------------
   * The queue loop and the replay loop used to keep separate state, and
   * a single `currentStop` slot that the newer clip overwrote — so the
   * older Audio element was orphaned and played on under the new one.
   * Now there is exactly one active clip, owned here. Every clip, from
   * either loop, goes through runClip(), which stops whatever is
   * sounding before it starts (abort signal → pause + settle), and
   * stopAll()/dispose() stop that same slot. */
  let active: {
    ctrl: AbortController;
    who: DetectiveSpeaker;
    claim: VoiceClaim | null;
  } | null = null;
  function stopActive(): void {
    const a = active;
    active = null;
    if (!a) return;
    a.claim?.release();
    try {
      a.ctrl.abort();
    } catch {
      /* stopping must never throw into game flow */
    }
  }
  /** The runClip claim waiting for the default player to adopt:
   * set synchronously by runClip before it awaits the clip
   * player, taken once by defaultPlayClip. A custom playClip
   * never reads it, so the claim stays with runClip's release
   * paths; a stale value names a claim runClip already
   * released, and is only ever overwritten, never consumed
   * twice — consumption happens only on the path that hands
   * the claim to a voice, after the settled checks. */
  let pendingClaim: VoiceClaim | null = null;
  async function runClip(clip: ResolvedClip): Promise<void> {
    stopActive(); // never two clips open at once, from either loop
    const ctrl = new AbortController();
    // The channel is claimed HERE, synchronously, before any clip
    // sounds — whichever clip player runs. A detective line is
    // part of the kid's own play (a pick, a confirm, Listen, or
    // the ladder they are driving), so the claim takes the
    // channel from any other voice first: the stop-then-start
    // order holds, and the owner reads "detective" while the
    // clip is in flight, for the default player and injected
    // seams alike. The default player adopts this claim (it
    // must not claim again: a second claim would stop this
    // clip itself); a custom player leaves it to the release
    // paths below.
    const claim = claimVoice("detective", () => stopActive(), {
      userInitiated: true,
    });
    if (!claim) return; // channel held by a line this one may not take: skipped
    const mine = { ctrl, who: clip.who, claim };
    active = mine;
    pendingClaim = claim;
    try {
      await playClip(clip, ctrl.signal);
    } finally {
      if (active === mine) {
        active = null;
        claim.release();
      }
    }
  }
  /** A pick or a confirm while Watson is sounding: Watson shuts up so
   * Holmes can answer. Stops Watson's clip, abandons a replay that is
   * mid-chain (its later items would talk over Holmes), and returns the
   * queue index this gesture read goes in at. When Watson was cut that
   * is ahead of any queued non-gesture lines (Holmes answers next),
   * behind gesture reads already waiting (the guess burst keeps its
   * order). When Watson is quiet it is the end of the queue, exactly
   * as before: a pick never interrupts anything else. */
  function cutWatsonForPick(): number {
    const isGestureItem = (q: SpeakRef) =>
      selectionItems.has(q) || guessItems.has(q);
    if (active?.who !== "watson") return queue.length;
    const firstOther = queue.findIndex((q) => !isGestureItem(q));
    heldPlaySeq += 1; // a replay mid-chain abandons ship, no drain
    stopActive();
    return firstOther === -1 ? queue.length : firstOther;
  }

  async function defaultPlayClip(
    clip: ResolvedClip,
    signal: AbortSignal,
  ): Promise<void> {
    // Gesture-wait resurrection guard (cure, panel round 1): the
    // abort listener is registered BEFORE the first-gesture wait, not
    // after it, so a stop landing while the clip was parked (a mute, a
    // case change, a replay interrupting) settles it: the parked clip
    // can never play on the next tap after it was stopped. A stopped
    // clip resolves as skipped — the queue's existing stopped-item
    // path, drain accounting untouched — and the sound gate is
    // re-checked at wake for a gate that closed without a stop.
    await new Promise<void>((resolve) => {
      let settled = false;
      let voice: VoiceFactoryHandle | null = null;
      const done = () => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", onAbort);
        resolve();
      };
      const onAbort = () => {
        try {
          voice?.stop();
        } catch {
          /* voice already gone — nothing to stop */
        }
        done();
      };
      if (signal.aborted) {
        done();
        return;
      }
      signal.addEventListener("abort", onAbort);
      void waitForGesture().then(() => {
        if (settled || disposed) return;
        if (!isSoundOn()) {
          done();
          return;
        }
        // The clip sounds through the voice port: the factory is
        // the player's own or the startup-registered one. No
        // factory (or a gated line) resolves as SKIPPED — the
        // queue must never stall (fallback law). An erroring
        // clip (404 / codec) resolves the same way, via onError.
        const makeVoice = resolveVoiceFactory(opts.createVoice);
        if (!makeVoice) {
          done();
          return;
        }
        // Adopt runClip's claim, taken synchronously before this
        // clip sounded: the voice must not claim again. If no
        // voice is made, the claim stays with runClip's release
        // paths — it is only ever handed over, never dropped.
        const adopted = pendingClaim;
        pendingClaim = null;
        try {
          voice = makeVoice(clip.url, {
            owner: "detective",
            userInitiated: true,
            ...(adopted ? { claim: adopted } : {}),
            onEnded: done,
            onError: done,
            onInterrupted: done,
          });
        } catch {
          done();
          return;
        }
        if (!voice) {
          done();
          return;
        }
        voice.play();
      });
    });
  }
  const playClip = opts.playClip ?? defaultPlayClip;

  /* -- queue processor ------------------------------------------------ */
  async function processQueue(gen: number): Promise<void> {
    if (processing) return;
    processing = true;
    let hadItems = false;
    let playedAny = false;
    let skippedUnreadClue = false;
    try {
      while (queue.length > 0) {
        if (gen !== generation || disposed) return;
        hadItems = true;
        const ref = queue.shift()!;
        // U9 speech modes: in "tap" mode the item resolves as skipped
        // (the ladder advances silently, exactly like a dropped item);
        // in "off" mode it resolves skipped and nothing is held. The
        // clue-sequence hold itself is recorded at enqueue time (see
        // enqueue below) — recordHeld here is the idempotent backstop
        // for a mode that flipped to "tap" mid-burst.
        const isGesture =
          selectionItems.has(ref) || guessItems.has(ref) || isEndingRef(ref);
        if (speechMode === "off") continue;
        if (speechMode === "tap" && !isGesture) {
          recordHeld(ref);
          // A skipped clue question must not drain. Draining here
          // opened every starting card before Watson read any of them
          // (7-10 tap mode, a 3-clue deal). The ladder stays on this
          // card until Listen plays the question. Sound off still
          // drains: there is no read to wait for.
          if (ref.kind === "clue" && isSoundOn()) skippedUnreadClue = true;
          continue;
        }
        // Gates at play time: sound off or the read-aloud preference
        // vetoes autoplay → the item is dropped, the queue moves on.
        // A tap-mode gesture-initiated read (a pick read, a guess
        // read, or the held replay) is the kid's own tap at work:
        // the sound gate applies, the autoplay veto does not.
        if (!isSoundOn()) continue;
        if (speechMode === "auto" && !canAutoPlay()) continue;
        const manifest = await loadManifest(ref, caseIndex);
        if (gen !== generation || disposed) return;
        const clip = resolveDetectiveClip(manifest, ref, caseIndex);
        if (!clip) continue; // uncovered → silent skip
        // A queued line takes the voice: a replay still sounding is
        // superseded (it never drains; this loop's drain is the one).
        heldPlaySeq += 1;
        onSpeakingChange(clip.who);
        playedAny = true;
        try {
          await runClip(clip);
        } catch {
          // A failing clip is a skipped clip — never stall the queue.
        }
      }
    } finally {
      processing = false;
      // One drain signal per emptied queue. It fires even when every
      // item was dropped or skipped (sound off, uncovered case): the
      // ladder must advance silently rather than stall — the visual
      // game is identical with or without audio (fallback law).
      // stopAll bumps the generation, so a stopped queue never drains.
      if (gen === generation && !disposed && hadItems && !(skippedUnreadClue && !playedAny)) {
        onSpeakingChange(null);
      }
      // Items enqueued while this loop was finishing (e.g. a drain
      // callback that immediately enqueued the next line) restart it.
      // That includes items enqueued right after a stopAll / replay
      // superseded THIS loop: their kick() was refused while this
      // loop still held `processing`, and stopAll already cleared
      // every older item — so whatever is queued now belongs to the
      // CURRENT generation and must not be stranded (the owner's
      // "doesn't play in time": a pin's read sat silent until the
      // next unrelated line kicked the queue).
      if (!disposed && queue.length > 0) {
        void processQueue(generation);
      }
    }
  }

  /* Processing starts on a microtask, not synchronously: a transition
   * often emits several speak effects at once (ack + decode, name +
   * suspicion) and the host enqueues them in one synchronous burst.
   * Starting immediately would let a fully-synchronous batch (e.g.
   * every item dropped by the sound gate, which never awaits) drain
   * after the FIRST item and fire a premature speechEnded. */
  let startScheduled = false;
  function kick(): void {
    if (processing || startScheduled || disposed) return;
    startScheduled = true;
    queueMicrotask(() => {
      startScheduled = false;
      void processQueue(generation);
    });
  }

  /* -- held-sequence replay (Listen button / tap-Watson, Unit A) -----
   * Plays the held refs through the same manifest/clip pipeline, in
   * order. The autoplay verdict is NOT consulted — a tap is the kid
   * choosing to listen, and "never"/"sometimes" keep the control
   * tappable by design — but the sound gate IS: sound off at play
   * time means silence. Available in "auto" and "tap" modes; in
   * "off" mode nothing is held and this is a no-op.
   *
   * RESTART semantics (Unit A): a replay request is explicit, so it
   * interrupts whatever is in flight — the normal queue or an
   * earlier replay — and starts the held sequence again from item 1.
   * Interruption = a generation bump (in-flight loops abandon ship
   * without a drain signal) + clearing the pending queue + stopping
   * the current clip. A stopAll (generation bump) likewise abandons
   * a replay between clips. The drain signal fires only when at
   * least one clip actually played, clearing the host's speaking
   * indicator — and only from the LATEST replay: a superseded loop
   * never drains, so the ladder advances exactly once. */
  async function playHeldSequence(): Promise<void> {
    if (disposed || speechMode === "off") return;
    const refs = [...held];
    if (refs.length === 0) return;
    const mySeq = ++heldPlaySeq;
    generation += 1;
    const gen = generation;
    queue = [];
    stopActive();
    let playedAny = false;
    try {
      for (const ref of refs) {
        if (mySeq !== heldPlaySeq || gen !== generation || disposed) return;
        if (!isSoundOn()) break;
        const manifest = await loadManifest(ref, caseIndex);
        if (mySeq !== heldPlaySeq || gen !== generation || disposed) return;
        const clip = resolveDetectiveClip(manifest, ref, caseIndex);
        if (!clip) continue; // uncovered → silent skip, as ever
        onSpeakingChange(clip.who);
        playedAny = true;
        try {
          await runClip(clip);
        } catch {
          // A failing clip is a skipped clip — never stall the replay.
        }
      }
    } finally {
      // Only the latest replay owns the drain: a loop a newer tap
      // superseded leaves it to its replacement.
      if (mySeq === heldPlaySeq && playedAny && gen === generation && !disposed) {
        onSpeakingChange(null);
      }
    }
  }

  return {
    enqueue(ref: SpeakRef): void {
      if (disposed) return;
      // A selection read (the player's own pick, no guess spent) takes
      // its own path: it never interrupts a playing clip, and a second
      // one that has not started yet replaces the first (latest wins).
      if (ref.kind === "name" && ref.selection === true) {
        if (speechMode === "off") return;
        const item: SpeakRef = { ...ref };
        selectionItems.add(item);
        const stale = queue.findIndex((q) => selectionItems.has(q));
        if (stale !== -1) queue.splice(stale, 1);
        queue.splice(cutWatsonForPick(), 0, item);
        kick();
        return;
      }
      // Retention at enqueue time (Unit A — see the header): the full
      // burst is held before its first clip starts, so a mid-play
      // replay restarts the complete chain, not just the clip in
      // flight. "off" mode holds nothing.
      if (speechMode !== "off" && !guessReadArmed) recordHeld(ref);
      // PR 2a cure 3: refs enqueued while the host's guess-read arm
      // stands are the guess read — mark them so tap mode plays
      // them for real (the confirm tap is the kid's gesture). The
      // mark is inert in the other modes (see armGuessRead).
      if (guessReadArmed) guessItems.add(ref);
      if (guessReadArmed) queue.splice(cutWatsonForPick(), 0, ref);
      else queue.push(ref);
      kick();
    },
    armGuessRead(): void {
      guessReadArmed = true;
    },
    disarmGuessRead(): void {
      guessReadArmed = false;
    },
    setSpeechMode(mode: SpeechMode): void {
      if (mode === speechMode) return;
      speechMode = mode;
      if (mode === "off") held = [];
    },
    getSpeechMode(): SpeechMode {
      return speechMode;
    },
    heldRefs(): readonly SpeakRef[] {
      return [...held];
    },
    playHeldSequence,
    stopAll(): void {
      generation += 1;
      queue = [];
      heldPlaySeq += 1;
      stopActive();
      onSpeakingChange(null);
    },
    dispose(): void {
      disposed = true;
      generation += 1;
      queue = [];
      heldPlaySeq += 1;
      stopActive();
      gestureWaiters = [];
    },
    setCaseIndex(next: number): void {
      if (next !== caseIndex) held = []; // a new case, a new clue chain
      caseIndex = next;
    },
  };
}
