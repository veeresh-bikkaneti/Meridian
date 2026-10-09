import { useCallback, useEffect, useRef, useState } from "react";
import { useCelebrationActive, useTourActive } from "./storyteller";
import { STORYTELLER_AUDIO_FALLBACK_LINE } from "./storyteller-lines";
import { isSoundEnabled } from "@/game/audio/sfx";
import {
  loadAssetManifest,
  resetBannerFigureForTests,
} from "./storyteller-banner-figure";
import {
  GREETINGS,
  LEAF_LINE,
  SENDOFFS,
  TOUR_RETURN_LINE,
  greetingIndexForDate,
  localDayKey,
  type StorytellerLoopKey,
} from "./storyteller-home-copy";
import {
  armTourReturnLine,
  resetStorytellerSessionForTests,
  takeTourReturnLine,
} from "./storyteller-session";
import "./storyteller-home.css";

// Storyteller banner host — owner correction 2026-10-09 (overrides #114).
//
// The figure lives IN THE BANNER (StorytellerBannerFigure, always visible,
// decorative). This host owns the greeting bubble + narration and anchors
// under the banner row as a transient popover — no hero strip, no hidden
// states, no visit counting.
//
// Narration policy (owner: EVERY home visit greets; the ONLY silence is the
// user's mute toggle):
//   - On mount, if sound is on and the greet mp3 resolved, attempt
//     audio.play() immediately. Autoplay policy will usually reject it —
//     on rejection a one-shot pointerdown/keydown listener retries on the
//     first gesture (re-checking isSoundEnabled() then).
//   - Muted at mount → no attempt, no gesture listener. Muted at gesture
//     time → the one-shot fires and gives up silently. Unmuting later in
//     the same visit does NOT retro-play (sane, matches old behavior).
//   - Home no longer consumes the session auto-narration flag — story cards
//     keep their own one-shot behavior (result-card.tsx), untouched.
//
// State machine:
//   entering → greeting_text →(play ok)→ greeting_audio →(end|dismiss|12s)→
//   idle_linger. Any state →(tour/celebration opens)→ yielded (bubble + audio
//   gone; the FIGURE stays — it's banner chrome)→(tour closes)→ re-resolve
//   (the tour-return line wins exactly once, copy G2).
// - Tour return: locked line, text-only, no mp3 (copy G2).
// - Loop pick: the loop's locked send-off rides along ≤2.5s while the loop
//   loads; navigation never waits (copy G3). He never travels into loops.
// - Reduced motion: ≤150ms opacity fade only; full caption instantly; audio
//   timing unchanged.
//
// Loaded via React.lazy by the home screen — never in the initial bundle.
// No visible name ("historian feel" per owner).

type HomePhase =
  | "entering"
  | "greeting_text"
  | "greeting_audio"
  | "idle_linger"
  | "exiting";

type BannerHomeMode = "tour-return" | "greeting";

const ENTER_MS = 150;
const EXIT_MS = 150;
const TEXT_BUBBLE_MS = 6000;
const LEAF_BUBBLE_MS = 3000;
const POST_AUDIO_HOLD_MS = 1500;
/** G1: hard cap on the greeting audio window — never a visible countdown. */
const GREETING_AUDIO_CAP_MS = 12_000;
const AUDIO_START_TAP_GUARD_MS = 600; // the tap that starts audio must not dismiss it
const SENDOFF_OVERLAY_MS = 2200;
const SENDOFF_OVERLAY_REMOVE_MS = 2500;

export const SENDOFF_EVENT = "meridian:storyteller-sendoff";

/** Same-origin base read (undefined under node --test — mirrors storyteller-lines). */
function assetBase(): string {
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
  const base = env?.BASE_URL ?? "/";
  return base.endsWith("/") ? base : `${base}/`;
}

interface ResolvedAssets {
  /** Pointing pose URL, or null when unavailable (send-off skips it silently). */
  pointing: string | null;
  /** greet-0N mp3 URL, or null until the Kokoro renders land (text-only greeting). */
  greetAudio: string | null;
}

/**
 * Imperative send-off overlay (copy G3): navigation begins immediately and
 * unmounts home, so the caption rides along in a body-level node that fades
 * itself in ≤2.5s. Below the celebration overlay (z-40).
 */
function showSendoffOverlay(line: string, pointingUrl: string | null): void {
  if (typeof document === "undefined") return;
  const reduced =
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = document.createElement("div");
  el.className = "storyteller-sendoff";
  el.setAttribute("role", "status");
  el.setAttribute("data-testid", "storyteller-sendoff");
  if (pointingUrl) {
    const img = document.createElement("img");
    img.src = pointingUrl;
    img.alt = "";
    img.setAttribute("aria-hidden", "true");
    img.decoding = "async";
    img.className = "storyteller-sendoff-figure";
    el.appendChild(img);
  }
  const caption = document.createElement("p");
  caption.className = "storyteller-sendoff-caption";
  caption.textContent = line;
  el.appendChild(caption);
  document.body.appendChild(el);
  const show = () => el.classList.add("storyteller-sendoff-show");
  if (reduced) show();
  else requestAnimationFrame(() => requestAnimationFrame(show));
  window.setTimeout(() => el.classList.add("storyteller-sendoff-hide"), SENDOFF_OVERLAY_MS);
  window.setTimeout(() => el.remove(), SENDOFF_OVERLAY_REMOVE_MS);
}

function firstEditionControl(): HTMLElement | null {
  // The difficulty picker is the first control below the banner.
  // (A single querySelector with a selector list would return the h1, which
  // precedes the picker in DOM order — so the picker is tried first.)
  return (
    document.querySelector('[data-testid="tour-stop-difficulty"] button') ??
    document.querySelector('[data-testid="home-heading"]')
  );
}

export interface StorytellerBannerHostProps {
  /** True while the first-run tutorial invite is on screen — the greeting
      bubble stays quiet until it's dismissed (no competing popups). The
      banner figure itself is unaffected (banner chrome). */
  tutorialInviteVisible?: boolean;
}

/**
 * The home banner host. Default export for React.lazy.
 */
export default function StorytellerBannerHost({
  tutorialInviteVisible = false,
}: StorytellerBannerHostProps) {
  const tourActive = useTourActive();
  const celebrationActive = useCelebrationActive();
  const yielded = tourActive || celebrationActive;

  // Every home visit greets (owner 2026-10-09): tour return wins exactly
  // once, otherwise the daily-rotating greeting. No day key, no silent mode.
  const [mode, setMode] = useState<BannerHomeMode>(() => {
    const today = localDayKey();
    return takeTourReturnLine(today) ? "tour-return" : "greeting";
  });
  const [phase, setPhase] = useState<HomePhase>("entering");
  const [bubble, setBubble] = useState<string | null>(null);
  const [audioFailed, setAudioFailed] = useState(false);
  const [leafFalling, setLeafFalling] = useState(false);
  const [assets, setAssets] = useState<ResolvedAssets>({
    pointing: null,
    greetAudio: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bubbleTimer = useRef(0);
  const capTimer = useRef(0);
  const soundWatch = useRef(0);
  const audioStartTimeRef = useRef(0);
  const attemptedRef = useRef(false);
  const gestureCleanupRef = useRef<(() => void) | null>(null);
  const leafShownRef = useRef(false);
  const wasYieldedRef = useRef(false);
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const greetIndex = useRef(greetingIndexForDate()).current;
  const greetingText = GREETINGS[greetIndex] ?? GREETINGS[0]!;

  const clearTimers = useCallback(() => {
    window.clearTimeout(bubbleTimer.current);
    window.clearTimeout(capTimer.current);
    window.clearInterval(soundWatch.current);
  }, []);

  const stopAudio = useCallback(() => {
    window.clearTimeout(capTimer.current);
    window.clearInterval(soundWatch.current);
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  const hideBubble = useCallback(() => {
    window.clearTimeout(bubbleTimer.current);
    setBubble(null);
    setAudioFailed(false);
  }, []);

  const showBubble = useCallback(
    (text: string, holdMs: number | null) => {
      window.clearTimeout(bubbleTimer.current);
      setAudioFailed(false);
      setBubble(text);
      if (holdMs !== null) {
        bubbleTimer.current = window.setTimeout(() => {
          setBubble(null);
        }, holdMs);
      }
    },
    [],
  );

  // ---- Asset manifest (F1/F2 pipeline) ---------------------------------
  // Shared module-cached promise with the banner figure: the host needs the
  // greet-audio URL and the pointing pose; the figure needs the idle pose.
  useEffect(() => {
    let cancelled = false;
    void loadAssetManifest().then((manifest) => {
      if (cancelled || !manifest) return;
      const base = assetBase();
      const audioKey = `greet-0${greetIndex + 1}`;
      const audioPath = manifest.audio[audioKey];
      setAssets({
        pointing: manifest.poses.pointing ? base + manifest.poses.pointing : null,
        greetAudio: audioPath ? base + audioPath : null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [greetIndex]);

  // ---- Yield: tour / celebration own the screen ------------------------
  // The figure stays (banner chrome); the bubble + audio yield. A
  // tour-walk-end after a yield arms the post-tour return line (copy G2).
  useEffect(() => {
    const onTourEnd = () => {
      if (wasYieldedRef.current) armTourReturnLine(localDayKey());
    };
    window.addEventListener("meridian:tour-walk-end", onTourEnd);
    return () => window.removeEventListener("meridian:tour-walk-end", onTourEnd);
  }, []);

  useEffect(() => {
    if (yielded) {
      wasYieldedRef.current = true;
      stopAudio();
      hideBubble();
      gestureCleanupRef.current?.();
      gestureCleanupRef.current = null;
      return;
    }
    if (wasYieldedRef.current) {
      wasYieldedRef.current = false;
      // The overlay closed — re-resolve (G2: the tour-return line wins once).
      const today = localDayKey();
      if (takeTourReturnLine(today)) {
        setMode("tour-return");
        setPhase("entering");
      }
      // Otherwise the pre-yield greeting stands (it already greeted — the
      // owner wants every visit to greet, and this visit did).
    }
  }, [yielded, stopAudio, hideBubble]);

  // ---- Entering --------------------------------------------------------
  useEffect(() => {
    if (phase !== "entering") return;
    if (mode === "tour-return") {
      const t1 = window.setTimeout(() => {
        setPhase("greeting_text");
        // Text-only, no mp3 — the locked return line (copy G2).
        showBubble(TOUR_RETURN_LINE, TEXT_BUBBLE_MS);
      }, ENTER_MS);
      const t2 = window.setTimeout(() => setPhase("idle_linger"), ENTER_MS + TEXT_BUBBLE_MS);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }
    // mode === "greeting": text-first, always. Audio is attempted below
    // once the mp3 URL resolves (or stays text-only when it never does).
    // A null (indefinite) hold only makes sense when an audio attempt is
    // actually pending — muted-at-mount gets the text hold instead, or the
    // bubble would sit forever with no narration coming.
    const t = window.setTimeout(() => {
      setPhase("greeting_text");
      const audioPending =
        assetsRef.current.greetAudio !== null && isSoundEnabled();
      showBubble(greetingText, audioPending ? null : TEXT_BUBBLE_MS);
    }, ENTER_MS);
    return () => window.clearTimeout(t);
  }, [phase, mode, greetingText, showBubble]);

  // ---- Falling laurel leaf (micro-delight 4) -----------------------------
  // After the greeting bubble's natural hold, one leaf drifts past and its
  // caption shows briefly. Reduced motion: static sprig, caption still shows.
  // A tap-dismissed greeting skips the leaf (the kid moved on).
  const maybeLeaf = useCallback(() => {
    if (leafShownRef.current || modeRef.current !== "greeting") return;
    leafShownRef.current = true;
    setLeafFalling(true);
    showBubble(LEAF_LINE, LEAF_BUBBLE_MS);
    window.setTimeout(() => setLeafFalling(false), LEAF_BUBBLE_MS);
  }, [showBubble]);

  // The text-only greeting's bubble timer expiry is the leaf trigger: chain
  // it by watching the bubble clear after a greeting hold.
  const bubbleGoneAfterGreeting = bubble === null && phase === "greeting_text";
  useEffect(() => {
    if (!bubbleGoneAfterGreeting) return;
    if (modeRef.current !== "greeting" || leafShownRef.current) return;
    maybeLeaf();
    const t = window.setTimeout(() => setPhase("idle_linger"), LEAF_BUBBLE_MS);
    return () => window.clearTimeout(t);
  }, [bubbleGoneAfterGreeting, maybeLeaf]);

  // ---- Greeting audio: every-visit narration ----------------------------
  const beginGreetingAudio = useCallback(() => {
    const url = assetsRef.current.greetAudio;
    if (!url || !isSoundEnabled()) return;
    stopAudio();
    const audio = new Audio(url);
    audioRef.current = audio;
    audioStartTimeRef.current = Date.now();
    setPhase("greeting_audio");
    // The greeting bubble stays up while audio plays (no hold timer).
    window.clearTimeout(bubbleTimer.current);

    const finish = () => {
      // Stale-element guard: a dismiss/yield between play() and the event
      // must not resurrect the bubble (e.g. gesture → replay → 404 after
      // the kid already dismissed).
      if (audioRef.current !== audio) return;
      stopAudio();
      // Brief hold on the greeting text, then the leaf delight.
      showBubble(greetingText, POST_AUDIO_HOLD_MS);
      window.setTimeout(() => {
        maybeLeaf();
        window.setTimeout(() => setPhase("idle_linger"), LEAF_BUBBLE_MS);
      }, POST_AUDIO_HOLD_MS);
    };
    const onFail = () => {
      // Same stale guard as finish.
      if (audioRef.current !== audio) return;
      // Audio unavailable (404/decode) — degrade to silent text-only,
      // never device-shame.
      // (showBubble clears the failure flag, so set it after.)
      showBubble(greetingText, TEXT_BUBBLE_MS);
      setAudioFailed(true);
      setPhase("idle_linger");
    };
    const onAutoplayBlocked = () => {
      // No prior gesture in this document: park the greeting as text and
      // wait for the first gesture, then try exactly once more.
      stopAudio();
      setPhase("greeting_text");
      const onGesture = () => {
        window.removeEventListener("pointerdown", onGesture);
        window.removeEventListener("keydown", onGesture);
        gestureCleanupRef.current = null;
        if (!isSoundEnabled()) return; // muted at gesture time → never play
        beginGreetingAudio();
      };
      gestureCleanupRef.current = () => {
        window.removeEventListener("pointerdown", onGesture);
        window.removeEventListener("keydown", onGesture);
      };
      window.addEventListener("pointerdown", onGesture);
      window.addEventListener("keydown", onGesture);
    };
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", onFail, { once: true });
    void audio
      .play()
      .then(() => {
        // G1: the 12s window starts when audio ACTUALLY begins.
        // (Home no longer consumes the session auto-narration flag —
        // story cards keep their own one-shot, untouched.)
        capTimer.current = window.setTimeout(() => {
          // Hard cap: stop immediately, bubble stays text-visible.
          stopAudio();
          showBubble(greetingText, TEXT_BUBBLE_MS);
          setPhase("idle_linger");
        }, GREETING_AUDIO_CAP_MS);
        // G1: sound toggled off mid-greeting cancels the window.
        soundWatch.current = window.setInterval(() => {
          if (!isSoundEnabled()) {
            stopAudio();
            setPhase("idle_linger");
          }
        }, 500);
      })
      .catch(onAutoplayBlocked);
  }, [greetingText, maybeLeaf, showBubble, stopAudio]);

  // Mount attempt: every visit, sound on, mp3 resolved → try to play.
  // Muted at mount → no attempt at all (and no gesture listener — there is
  // nothing to wait for). Autoplay rejection is handled inside
  // beginGreetingAudio via the one-shot gesture fallback.
  useEffect(() => {
    if (mode !== "greeting" || phase !== "greeting_text") return;
    if (!assets.greetAudio || attemptedRef.current) return;
    if (!isSoundEnabled()) return;
    // The text greeting already ran its course (slow manifest) — don't
    // barge in over the leaf delight.
    if (leafShownRef.current) return;
    attemptedRef.current = true;
    beginGreetingAudio();
  }, [mode, phase, assets.greetAudio, beginGreetingAudio]);

  // Tab hidden cancels the audio window (G1).
  useEffect(() => {
    if (phase !== "greeting_audio") return;
    const onHidden = () => {
      if (document.hidden) {
        stopAudio();
        setPhase("idle_linger");
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [phase, stopAudio]);

  // ---- Dismiss -----------------------------------------------------------
  const dismissBubble = useCallback(
    (viaKeyboard: boolean) => {
      stopAudio();
      hideBubble();
      gestureCleanupRef.current?.();
      gestureCleanupRef.current = null;
      if (modeRef.current === "greeting" || modeRef.current === "tour-return") {
        setPhase("idle_linger");
      }
      if (viaKeyboard) firstEditionControl()?.focus({ preventScroll: true });
    },
    [stopAudio, hideBubble],
  );

  const handleCaptionTap = useCallback(() => {
    // The tap that starts audio must not instantly dismiss it.
    if (Date.now() - audioStartTimeRef.current < AUDIO_START_TAP_GUARD_MS) return;
    dismissBubble(false);
  }, [dismissBubble]);

  // ---- Loop send-off (copy G3) --------------------------------------------
  useEffect(() => {
    const onSendoff = (event: Event) => {
      const detail = (event as CustomEvent<{ loop?: unknown }>).detail;
      const loop = detail?.loop;
      const line =
        typeof loop === "string" && loop in SENDOFFS
          ? SENDOFFS[loop as StorytellerLoopKey]
          : null;
      if (!line) return;
      // Bubble exits (150ms); navigation begins immediately — never blocked.
      setPhase("exiting");
      window.setTimeout(() => {
        showSendoffOverlay(line, assetsRef.current.pointing);
      }, EXIT_MS);
    };
    window.addEventListener(SENDOFF_EVENT, onSendoff);
    return () => window.removeEventListener(SENDOFF_EVENT, onSendoff);
  }, []);

  // ---- Unmount: never leave audio, timers, or gesture listeners behind ----
  useEffect(() => {
    return () => {
      clearTimers();
      gestureCleanupRef.current?.();
      gestureCleanupRef.current = null;
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [clearTimers]);

  // Yielded / tutorial invite → the host shows nothing (the banner figure
  // stays — it's chrome, not the host). Bubble-less idle → nothing either.
  if (tutorialInviteVisible || yielded) return null;
  if (bubble === null && !leafFalling) return null;

  return (
    <div
      className="storyteller-home"
      data-testid="storyteller-home"
      data-phase={phase}
      data-mode={mode}
    >
      {bubble !== null ? (
        <div
          className="storyteller-caption storyteller-home-bubble"
          data-testid="storyteller-home-bubble"
          role="status"
          onClick={handleCaptionTap}
        >
          <p
            className="storyteller-caption-text"
            data-testid="storyteller-home-caption"
          >
            {bubble}
          </p>
          {audioFailed ? (
            <span
              className="storyteller-fallback"
              data-testid="storyteller-home-fallback"
            >
              {STORYTELLER_AUDIO_FALLBACK_LINE}
            </span>
          ) : null}
          <button
            type="button"
            className="storyteller-home-dismiss"
            data-testid="storyteller-home-dismiss"
            aria-label="Dismiss the storyteller's greeting"
            onClick={(e) => {
              e.stopPropagation();
              dismissBubble(true);
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ) : null}
      {leafFalling ? (
        <span
          className="storyteller-home-leaf"
          data-testid="storyteller-home-leaf"
          aria-hidden="true"
        >
          🍃
        </span>
      ) : null}
    </div>
  );
}

/** Test-only: drop the cached manifest (and the session flags). */
export function resetStorytellerHomeForTests(): void {
  resetBannerFigureForTests();
  resetStorytellerSessionForTests();
}
