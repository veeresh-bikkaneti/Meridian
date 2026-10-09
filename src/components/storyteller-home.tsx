import { useCallback, useEffect, useRef, useState } from "react";
import { StorytellerMascot, useCelebrationActive, useTourActive } from "./storyteller";
import { claimFirstRevealNarration } from "./storyteller-claim";
import {
  STORYTELLER_AUDIO_FALLBACK_LINE,
  storytellerFigureUrl,
} from "./storyteller-lines";
import { isSoundEnabled } from "@/game/audio/sfx";
import {
  GREETINGS,
  LEAF_LINE,
  POKE_LINES,
  SCROLL_TAP_LINE,
  SENDOFFS,
  TOUR_RETURN_LINE,
  decideHomeMode,
  greetingIndexForDate,
  localDayKey,
  type HomeGreetingMode,
  type StorytellerLoopKey,
} from "./storyteller-home-copy";
import {
  armTourReturnLine,
  consumeSessionAutoNarration,
  readHomeGreetDay,
  resetStorytellerSessionForTests,
  takeTourReturnLine,
  writeHomeGreetDay,
} from "./storyteller-session";
import "./storyteller-home.css";

// Storyteller home handoff (H1) — the Storyteller becomes home's host.
//
// State machine (spec §3):
//   absent → entering → greeting_text →(first gesture + sound on)→
//   greeting_audio →(end|dismiss|12s)→ idle_linger →
//   (navigate|tour start|dismiss|timeout)→ exiting → absent.
// Any state →(tour overlay opens)→ yielded (fully unmounted, no background
// audio)→(tour closes)→ absent →(return line due)→ entering.
//
// - First visit ever / first visit of day: greeting line, text-first, audio
//   on first gesture (one-shot pointerdown/keydown). Consumes the session's
//   one auto-narration — story cards later that session are text + speaker
//   button only (copy §5).
// - Same-day return: figure sits in hero, no bubble, no voice. No nagging.
// - Post-tour return: the locked tour line, text-only, no mp3 (copy G2 —
//   tour return wins, exactly once).
// - Loop pick: the loop's locked send-off rides along ≤2.5s while the loop
//   loads; navigation never waits (copy G3). He never travels into loops.
// - Sound muted: figure + full caption render; no autoplay attempt; toggling
//   sound on later does not retro-narrate.
// - Reduced motion: ≤150ms opacity fade only; full caption instantly; audio
//   timing unchanged.
//
// Loaded via React.lazy by the home screen — never in the initial bundle.
// Reuses StorytellerMascot (decoding=async) for the figure; the figure takes
// its asset URL from storyteller-assets.json so F1/F2 poses swap with zero
// code change. No visible name ("historian feel" per owner).

type HomePhase =
  | "absent"
  | "entering"
  | "greeting_text"
  | "greeting_audio"
  | "idle_linger"
  | "exiting";

const ENTER_MS = 150;
const EXIT_MS = 150;
const TEXT_BUBBLE_MS = 6000;
const POKE_BUBBLE_MS = 4000;
const SCROLL_TAP_BUBBLE_MS = 3000;
const LEAF_BUBBLE_MS = 3000;
const POST_AUDIO_HOLD_MS = 1500;
/** G1: hard cap on the greeting audio window — never a visible countdown. */
const GREETING_AUDIO_CAP_MS = 12_000;
const POKE_DEBOUNCE_MS = 600;
const DOUBLE_TAP_MS = 450;
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

interface AssetManifest {
  version: number;
  poses: { idle: string | null; pointing: string | null };
  audio: Record<string, string | null>;
}

let manifestPromise: Promise<AssetManifest | null> | null = null;

/** storyteller-assets.json — cached; null when unreachable (fail-closed). */
function loadAssetManifest(): Promise<AssetManifest | null> {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      try {
        const res = await fetch(
          `${assetBase()}assets/storyteller/storyteller-assets.json`,
        );
        if (!res.ok) return null;
        return (await res.json()) as AssetManifest;
      } catch {
        return null;
      }
    })();
  }
  return manifestPromise;
}

/** Test-only: drop the cached manifest (and the session flags). */
export function resetStorytellerHomeForTests(): void {
  manifestPromise = null;
  resetStorytellerSessionForTests();
}

interface ResolvedAssets {
  /** Idle pose URL (placeholder until the F1 cutout lands). */
  pose: string;
  /** Pointing pose URL, or null when unavailable (send-off skips it silently). */
  pointing: string | null;
  /** Day-1: null until the TruthTeller mp3s land (text-only greeting). */
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
  // The difficulty picker is the first control below the hero strip.
  // (A single querySelector with a selector list would return the h1, which
  // precedes the picker in DOM order — so the picker is tried first.)
  return (
    document.querySelector('[data-testid="tour-stop-difficulty"] button') ??
    document.querySelector('[data-testid="home-heading"]')
  );
}

export interface StorytellerHomeHostProps {
  /** True while the first-run tutorial invite is on screen — the greeting
      stays quiet until it's dismissed (no competing popups). */
  tutorialInviteVisible?: boolean;
}

/**
 * The home hero host. Default export for React.lazy.
 */
export default function StorytellerHomeHost({
  tutorialInviteVisible = false,
}: StorytellerHomeHostProps) {
  const tourActive = useTourActive();
  const celebrationActive = useCelebrationActive();
  const yielded = tourActive || celebrationActive;

  // G2 — resolved once per mount: tour return wins exactly once, then the
  // daily greeting, else the silent figure.
  const [mode, setMode] = useState<HomeGreetingMode>(() => {
    const today = localDayKey();
    const tourDue = takeTourReturnLine(today);
    const greeted = readHomeGreetDay() === today;
    const resolved = decideHomeMode({ tourReturnDue: tourDue, greetedToday: greeted });
    if (resolved === "greeting") writeHomeGreetDay(today);
    return resolved;
  });
  const [phase, setPhase] = useState<HomePhase>(
    mode === "silent" ? "idle_linger" : "entering",
  );
  const [bubble, setBubble] = useState<string | null>(null);
  const [audioFailed, setAudioFailed] = useState(false);
  const [leafFalling, setLeafFalling] = useState(false);
  const [bowing, setBowing] = useState(false);
  const [assets, setAssets] = useState<ResolvedAssets>({
    pose: storytellerFigureUrl(),
    pointing: null,
    greetAudio: null,
  });

  const reducedMotion = useRef(
    typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  ).current;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bubbleTimer = useRef(0);
  const capTimer = useRef(0);
  const soundWatch = useRef(0);
  const audioStartTimeRef = useRef(0);
  const gestureDoneRef = useRef(false);
  const leafShownRef = useRef(false);
  const pokeIndexRef = useRef(0);
  const lastTapRef = useRef(0);
  const lastPokeRef = useRef(0);
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
  useEffect(() => {
    let cancelled = false;
    void loadAssetManifest().then((manifest) => {
      if (cancelled || !manifest) return;
      const base = assetBase();
      const audioKey = `greet-0${greetIndex + 1}`;
      const audioPath = manifest.audio[audioKey];
      setAssets({
        pose: manifest.poses.idle ? base + manifest.poses.idle : storytellerFigureUrl(),
        pointing: manifest.poses.pointing ? base + manifest.poses.pointing : null,
        greetAudio: audioPath ? base + audioPath : null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [greetIndex]);

  // ---- Yield: tour / celebration own the screen ------------------------
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
      // Otherwise the pre-yield mode stands: a shown greeting is not reshown
      // (the day key was written), a silent figure stays silent.
    }
  }, [yielded, stopAudio, hideBubble]);

  // ---- Entering --------------------------------------------------------
  useEffect(() => {
    if (phase !== "entering") return;
    if (mode === "tour-return") {
      if (!reducedMotion) setBowing(true);
      const t1 = window.setTimeout(() => {
        setBowing(false);
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
    if (mode === "greeting") {
      const t = window.setTimeout(() => {
        setPhase("greeting_text");
        // Text-first, always: audio waits for the first gesture below.
        // Day-1 (no mp3 yet) this is the whole greeting — no autoplay
        // attempt, and the session flag is NOT consumed.
        showBubble(greetingText, assetsRef.current.greetAudio ? null : TEXT_BUBBLE_MS);
      }, ENTER_MS);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [phase, mode, greetingText, reducedMotion, showBubble]);

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
    if (gestureDoneRef.current && audioRef.current) return; // audio path handles it
    maybeLeaf();
    const t = window.setTimeout(() => setPhase("idle_linger"), LEAF_BUBBLE_MS);
    return () => window.clearTimeout(t);
  }, [bubbleGoneAfterGreeting, maybeLeaf]);

  // ---- Greeting audio ----------------------------------------------------
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
      stopAudio();
      // Brief hold on the greeting text, then the leaf delight.
      showBubble(greetingText, POST_AUDIO_HOLD_MS);
      window.setTimeout(() => {
        maybeLeaf();
        window.setTimeout(() => setPhase("idle_linger"), LEAF_BUBBLE_MS);
      }, POST_AUDIO_HOLD_MS);
    };
    const onEnded = () => finish();
    const onFail = () => {
      // Audio unavailable — degrade to silent text-only, never device-shame.
      // (showBubble clears the failure flag, so set it after.)
      showBubble(greetingText, TEXT_BUBBLE_MS);
      setAudioFailed(true);
      setPhase("idle_linger");
    };
    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onFail, { once: true });
    void audio
      .play()
      .then(() => {
        // G1: the 12s window starts when audio ACTUALLY begins — and only
        // then is the session's one auto-narration consumed (copy §5).
        consumeSessionAutoNarration();
        claimFirstRevealNarration();
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
      .catch(onFail);
  }, [greetingText, maybeLeaf, showBubble, stopAudio]);

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

  // First-gesture audio (one-shot): the auto-narration policy the owner
  // picked. Sound off → no attempt, and toggling sound on later does not
  // retro-narrate — the opportunity is consumed by the first gesture.
  useEffect(() => {
    if (mode !== "greeting" || phase !== "greeting_text") return;
    if (!assets.greetAudio) return; // day-1: text-only, nothing to wait for
    const onGesture = () => {
      if (gestureDoneRef.current) return;
      gestureDoneRef.current = true;
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      if (!isSoundEnabled()) return; // toggled off between mount and gesture
      beginGreetingAudio();
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [mode, phase, assets.greetAudio, beginGreetingAudio]);

  // ---- Dismiss -----------------------------------------------------------
  const dismissBubble = useCallback(
    (viaKeyboard: boolean) => {
      stopAudio();
      hideBubble();
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

  // ---- Poke (micro-delight: tap the figure) ------------------------------
  const handleFigureTap = useCallback(() => {
    const audio = audioRef.current;
    if (audio && phase === "greeting_audio") {
      // Tapping the figure mid-greeting pauses/resumes (card contract) —
      // but the tap that STARTED the audio must not instantly pause it.
      if (Date.now() - audioStartTimeRef.current < AUDIO_START_TAP_GUARD_MS) return;
      if (audio.paused) void audio.play().catch(() => {});
      else audio.pause();
      return;
    }
    const now = Date.now();
    const sinceTap = now - lastTapRef.current;
    lastTapRef.current = now;
    if (sinceTap > 0 && sinceTap < DOUBLE_TAP_MS) {
      // Micro-delight 1: scroll-tap hello — two quick taps.
      showBubble(SCROLL_TAP_LINE, SCROLL_TAP_BUBBLE_MS);
      return;
    }
    // Poke lines rotate (5 max, then repeat); taps <600ms apart are ignored.
    if (now - lastPokeRef.current < POKE_DEBOUNCE_MS) return;
    lastPokeRef.current = now;
    const line = POKE_LINES[pokeIndexRef.current % POKE_LINES.length]!;
    pokeIndexRef.current += 1;
    showBubble(line, POKE_BUBBLE_MS);
  }, [phase, showBubble]);

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
      // Figure exits (150ms); navigation begins immediately — never blocked.
      setPhase("exiting");
      window.setTimeout(() => {
        showSendoffOverlay(line, assetsRef.current.pointing);
      }, EXIT_MS);
    };
    window.addEventListener(SENDOFF_EVENT, onSendoff);
    return () => window.removeEventListener(SENDOFF_EVENT, onSendoff);
  }, []);

  // ---- Unmount: never leave audio or timers behind -------------------------
  useEffect(() => {
    return () => {
      clearTimers();
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [clearTimers]);

  // Yielded / suppressed / exited → fully unmounted (no background audio).
  if (tutorialInviteVisible || yielded || phase === "absent") return null;

  const audioPlaying = phase === "greeting_audio" && audioRef.current !== null;
  const figureLabel = audioPlaying
    ? "Pause the greeting"
    : audioRef.current && phase === "greeting_audio"
      ? "Resume the greeting"
      : "The storyteller";

  return (
    <div
      className="storyteller-home"
      data-testid="storyteller-home"
      data-phase={phase}
      data-mode={mode}
    >
      <div
        className={`storyteller-home-strip${phase === "exiting" ? " storyteller-home-leave" : ""}${bowing ? " storyteller-home-bow" : ""}`}
      >
        <StorytellerMascot
          label={figureLabel}
          src={assets.pose}
          onToggle={handleFigureTap}
        />
        <div className="storyteller-home-captioncol">
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
      </div>
    </div>
  );
}
