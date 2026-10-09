import { useCallback, useEffect, useRef, useState } from "react";
import { StorytellerMascot, useCelebrationActive, useTourActive } from "./storyteller";
import {
  STORYTELLER_AUDIO_FALLBACK_LINE,
  storytellerFigureUrl,
} from "./storyteller-lines";
import { isSoundEnabled } from "@/game/audio/sfx";
import {
  GREETINGS,
  POKE_LINES,
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

// Storyteller banner host — the Storyteller sits IN THE BANNER beside the
// Meridian branding (owner directive 2026-10-09 — the hero strip is gone).
//
// State machine:
//   entering → greeting_text →(first gesture + sound on)→
//   greeting_audio →(end|dismiss|12s)→ idle_linger
//   (tour start|celebration|dismiss|timeout)→ figure only (no unmount — the
//   figure lives in the banner).
//
// - Every home visit greets (owner 2026-10-09): the tour-return line wins
//   exactly once after Grandpa's tour, otherwise the daily greeting.
//   Text-first, audio on the first gesture.
// - Sound muted: figure + full caption render; no autoplay attempt; the
//   mute toggle is the ONLY silence.
// - Tap the figure: rotating poke lines (copy §2). Tap mid-greeting pauses
//   or resumes the audio (card contract).
// - Loop pick: the loop's locked send-off rides along ≤2.5s while the loop
//   loads; navigation never waits (copy G3). He never travels into loops.
// - Tutorial invite visible: the figure stays in the banner, but the
//   greeting waits until the invite is dismissed (no competing popups).
// - Reduced motion: ≤150ms opacity fade only; full caption instantly; audio
//   timing unchanged.
//
// Loaded via React.lazy by the banner row — never in the initial bundle.
// Reuses StorytellerMascot (decoding=async) for the figure; the figure takes
// its asset URL from storyteller-assets.json so F1/F2 poses swap with zero
// code change. No visible name ("historian feel" per owner).

type BannerPhase =
  | "entering"
  | "greeting_text"
  | "greeting_audio"
  | "idle_linger"
  | "exiting";

const ENTER_MS = 150;
const EXIT_MS = 150;
const TEXT_BUBBLE_MS = 6000;
const POKE_BUBBLE_MS = 4000;
const POST_AUDIO_HOLD_MS = 1500;
/** G1: hard cap on the greeting audio window — never a visible countdown. */
const GREETING_AUDIO_CAP_MS = 12_000;
const POKE_DEBOUNCE_MS = 600;
const AUDIO_START_TAP_GUARD_MS = 600; // the tap that starts audio must not dismiss it
const SENDOFF_OVERLAY_MS = 2200;
const SENDOFF_OVERLAY_REMOVE_MS = 2500;
/** Track B (Homer motion): poke startle visual length. */
const POKE_VISUAL_MS = 500;
/** Track B (Homer motion): graceful-yield recede before the host unmounts. */
const YIELD_OUT_MS = 220;

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
  /** greet-0N mp3 for today's greeting rotation; null → text-only greeting. */
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
  // The difficulty picker is the first control below the banner row.
  return (
    document.querySelector('[data-testid="tour-stop-difficulty"] button') ??
    document.querySelector('[data-testid="home-heading"]')
  );
}

export interface StorytellerHomeHostProps {
  /** True while the first-run tutorial invite is on screen — the figure
      stays in the banner, but the greeting stays quiet until the invite is
      dismissed (no competing popups). */
  tutorialInviteVisible?: boolean;
}

/**
 * The banner host. Default export for React.lazy.
 */
export default function StorytellerHomeHost({
  tutorialInviteVisible = false,
}: StorytellerHomeHostProps) {
  const tourActive = useTourActive();
  const celebrationActive = useCelebrationActive();
  const yielded = tourActive || celebrationActive;

  // The greeting starts once per mount (after the tutorial invite clears).
  // Tour return wins exactly once (copy G2); otherwise the greeting.
  const [mode, setMode] = useState<"greeting" | "tour-return">(() =>
    takeTourReturnLine(localDayKey()) ? "tour-return" : "greeting",
  );
  const [started, setStarted] = useState(!tutorialInviteVisible);
  const [phase, setPhase] = useState<BannerPhase>("entering");
  const [bubble, setBubble] = useState<string | null>(null);
  const [audioFailed, setAudioFailed] = useState(false);
  // Track B (Homer motion): transient visual states — the poke startle and
  // the graceful yield-out. Neither touches the phase machine.
  const [poked, setPoked] = useState(false);
  const [yielding, setYielding] = useState(false);
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
  const pokeTimer = useRef(0);
  const audioStartTimeRef = useRef(0);
  const gestureDoneRef = useRef(false);
  const wasYieldedRef = useRef(false);
  const pokeIndexRef = useRef(0);
  const lastPokeRef = useRef(0);
  const startedRef = useRef(started);
  const assetsRef = useRef(assets);
  assetsRef.current = assets;

  const greetIndex = useRef(greetingIndexForDate()).current;
  const greetingText = GREETINGS[greetIndex] ?? GREETINGS[0]!;

  const clearTimers = useCallback(() => {
    window.clearTimeout(bubbleTimer.current);
    window.clearTimeout(capTimer.current);
    window.clearInterval(soundWatch.current);
    window.clearTimeout(pokeTimer.current);
  }, []);

  /**
   * Track B (Homer motion): the poke startle visual. The class is dropped
   * for a frame before re-adding so the keyframed take restarts even on
   * rapid taps (the pause/resume path has no debounce).
   */
  const pokeVisual = useCallback(() => {
    window.clearTimeout(pokeTimer.current);
    setPoked(false);
    pokeTimer.current = window.setTimeout(() => {
      setPoked(true);
      pokeTimer.current = window.setTimeout(
        () => setPoked(false),
        POKE_VISUAL_MS,
      );
    }, 30);
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

  // ---- Tutorial invite: greeting waits for its dismissal ----------------
  // (moved below beginGreetingAudio: the dismiss tap counts as the first
  // gesture, so this effect calls it directly)

  // ---- Yield: tour / celebration own the screen -------------------------
  // A tour-walk-end after a yield arms the post-tour return line (copy G2).
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
      if (takeTourReturnLine(localDayKey())) {
        setMode("tour-return");
        setPhase("entering");
      }
      // Otherwise the pre-yield greeting stands (it already greeted — the
      // owner wants every visit to greet, and this visit did).
    }
  }, [yielded, stopAudio, hideBubble]);

  // ---- Graceful yield (Track B) -------------------------------------------
  // When tour/celebration take the stage the figure recedes over
  // YIELD_OUT_MS (CSS: homer-yield) instead of hard-cutting to null.
  useEffect(() => {
    if (!yielded) {
      setYielding(false);
      return;
    }
    setYielding(true);
    const t = window.setTimeout(() => setYielding(false), YIELD_OUT_MS);
    return () => window.clearTimeout(t);
  }, [yielded]);

  // ---- Entering ----------------------------------------------------------
  useEffect(() => {
    if (!started || phase !== "entering") return;
    if (mode === "tour-return") {
      const t1 = window.setTimeout(() => {
        setPhase("greeting_text");
        // Text-only, no mp3 — the locked return line (copy G2).
        showBubble(TOUR_RETURN_LINE, TEXT_BUBBLE_MS);
      }, ENTER_MS);
      return () => window.clearTimeout(t1);
    }
    const t = window.setTimeout(() => {
      setPhase("greeting_text");
      // Text-first, always: audio waits for the first gesture below.
      showBubble(greetingText, assetsRef.current.greetAudio ? null : TEXT_BUBBLE_MS);
    }, ENTER_MS);
    return () => window.clearTimeout(t);
  }, [started, phase, mode, greetingText, showBubble]);

  // ---- Tour-return follow-up ------------------------------------------------
  // Owner 2026-10-09: the greeting happens regardless of the tour. After
  // the return line's hold elapses, run the normal greeting (mp3 on
  // gesture). Dedicated effect (not chained timers in the entering effect):
  // the phase change above would clean up a chained timer and stall the
  // machine. Dismissing the line or a tour opening cancels the follow-up.
  useEffect(() => {
    if (yielded || mode !== "tour-return" || phase !== "greeting_text") return;
    const t = window.setTimeout(() => {
      setMode("greeting");
      setPhase("entering");
    }, TEXT_BUBBLE_MS);
    return () => window.clearTimeout(t);
  }, [yielded, mode, phase]);

  // ---- Greeting audio ------------------------------------------------------
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
      showBubble(greetingText, POST_AUDIO_HOLD_MS);
      window.setTimeout(() => setPhase("idle_linger"), POST_AUDIO_HOLD_MS);
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
      .catch(onFail);
  }, [greetingText, showBubble, stopAudio]);

  // ---- Tutorial invite: greeting waits for its dismissal ----------------
  // The dismiss tap counts as the first gesture (owner 2026-10-09) — begin
  // narration now instead of waiting for another tap.
  useEffect(() => {
    if (!tutorialInviteVisible && !startedRef.current) {
      startedRef.current = true;
      setStarted(true);
      // If a tour owns the stage, don't narrate under it — the post-tour
      // flow (return line → greeting) handles the greeting when the tour
      // ends. Otherwise the greeting audio would play over the tour and
      // mismatch the return-line caption.
      if (yielded) return;
      if (isSoundEnabled() && assetsRef.current.greetAudio) {
        gestureDoneRef.current = true;
        showBubble(greetingText, null);
        beginGreetingAudio();
      }
    }
  }, [tutorialInviteVisible, greetingText, showBubble, beginGreetingAudio, yielded]);

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
  // retro-narrate — the opportunity is consumed by the first gesture. The
  // mute toggle is the ONLY silence.
  useEffect(() => {
    if (!started || phase !== "greeting_text") return;
    if (mode === "tour-return") return; // text-only return line — no audio
    if (!assets.greetAudio) return; // text-only greeting, nothing to wait for
    const onGesture = () => {
      if (gestureDoneRef.current) return;
      gestureDoneRef.current = true;
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      if (!isSoundEnabled()) return; // muted — text stays, audio never starts
      beginGreetingAudio();
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [started, phase, mode, assets.greetAudio, beginGreetingAudio]);

  // ---- Dismiss -------------------------------------------------------------
  const dismissBubble = useCallback(
    (viaKeyboard: boolean) => {
      stopAudio();
      hideBubble();
      setPhase("idle_linger");
      if (viaKeyboard) firstEditionControl()?.focus({ preventScroll: true });
    },
    [stopAudio, hideBubble],
  );

  const handleCaptionTap = useCallback(() => {
    // The tap that starts audio must not instantly dismiss it.
    if (Date.now() - audioStartTimeRef.current < AUDIO_START_TAP_GUARD_MS) return;
    dismissBubble(false);
  }, [dismissBubble]);

  // ---- Poke (tap the figure → rotating lines, copy §2) ---------------------
  const handleFigureTap = useCallback(() => {
    const audio = audioRef.current;
    if (audio && phase === "greeting_audio") {
      // Tapping the figure mid-greeting pauses/resumes (card contract) —
      // but the tap that STARTED the audio must not instantly pause it.
      if (Date.now() - audioStartTimeRef.current < AUDIO_START_TAP_GUARD_MS) return;
      if (audio.paused) void audio.play().catch(() => {});
      else audio.pause();
      pokeVisual();
      return;
    }
    const now = Date.now();
    // Poke lines rotate (5 max, then repeat); taps <600ms apart are ignored.
    if (now - lastPokeRef.current < POKE_DEBOUNCE_MS) return;
    lastPokeRef.current = now;
    const line = POKE_LINES[pokeIndexRef.current % POKE_LINES.length]!;
    pokeIndexRef.current += 1;
    showBubble(line, POKE_BUBBLE_MS);
    pokeVisual();
  }, [phase, showBubble, pokeVisual]);

  // ---- Loop send-off (copy G3) ----------------------------------------------
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

  // ---- Unmount: never leave audio or timers behind ---------------------------
  useEffect(() => {
    return () => {
      clearTimers();
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [clearTimers]);

  // Yielded → the figure recedes first (is-yielding), then null. The host
  // stays mounted throughout; the tour / celebration owns the screen.
  if (yielded && !yielding) return null;

  const audioPlaying = phase === "greeting_audio" && audioRef.current !== null;
  const figureLabel = audioPlaying
    ? "Pause the greeting"
    : audioRef.current && phase === "greeting_audio"
      ? "Resume the greeting"
      : "The storyteller";

  const bannerClassName =
    "storyteller-banner" +
    (poked ? " is-poked" : "") +
    (yielded && yielding ? " is-yielding" : "");

  return (
    <div
      className={bannerClassName}
      data-testid="storyteller-home"
      data-phase={phase}
    >
      <StorytellerMascot
        label={figureLabel}
        src={assets.pose}
        onToggle={handleFigureTap}
      />
      {/* Idle engagement (owner 2026-10-09): the bard hums to invite play —
          music notes rise while he "sings"; a scroll unfurls as if he's
          writing the next tale. CSS-only, idle_linger phase only. */}
      <span className="storyteller-idle" aria-hidden="true">
        <span className="storyteller-idle-note n1">♪</span>
        <span className="storyteller-idle-note n2">♫</span>
        <span className="storyteller-idle-note n3">♪</span>
        <span className="storyteller-idle-scroll" />
      </span>
      {bubble !== null && started ? (
        <div
          className="storyteller-banner-popover"
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
            className="storyteller-banner-dismiss"
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
    </div>
  );
}
