import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { RotateCcw, Volume2 } from "lucide-react";
import { isSoundEnabled } from "@/game/audio/sfx";
import { CURRENT_BUILD_ID } from "@/game/build-staleness";
import {
  getObservability,
  recordMilestone,
  sanitizeError,
  type ObservabilityEvent,
} from "@/lib/observability";
import {
  STORYTELLER_AUDIO_FALLBACK_LINE,
  STORYTELLER_LINES,
  storytellerAudioUrl,
  storytellerFigureUrl,
  wordMsFromDuration,
  type StorytellerLineKey,
} from "./storyteller-lines";
import "./storyteller-mascot.css";

// Storyteller narration — the old Greek storyteller's voice.
//
// Mirrors the proven CometGreeting contract (comet-greeting.tsx):
// text shows immediately, audio waits for a gesture, and nothing ever
// flips the global meridian.sound toggle without the player.
// Loaded via React.lazy by every host — never in the initial bundle.
//
// Telemetry (COPPA-clean — screen/phase/booleans only, never place content
// or PII): storyteller_shown, narration_started/completed/replayed/failed/
// dismissed, milestone storyteller_ready.

const AUDIO_LEAD_MS = 150;
const FALLBACK_WORD_MS = 260;
const DISMISS_AFTER_AUDIO_MS = 3000;
const DISMISS_TEXT_ONLY_MS = 6000;
const DISMISS_ANIM_MS = 150;
const AUDIO_START_TAP_GUARD_MS = 600; // the tap that starts audio must not dismiss it

type AudioState = "idle" | "playing" | "paused" | "ended" | "failed";

/** Telemetry trigger vocabulary (ux-brief §4): hook uses the T1 gesture model. */
export type StorytellerTrigger = "first_gesture" | "speaker" | "summary";

export type StorytellerScreen = "story" | "summary" | "geodetective";

export interface StorytellerNarrationProps {
  screen: StorytellerScreen;
  /** "first_gesture" = auto on first gesture (T1); "speaker" = speaker-button only (T2); "summary" = T4. */
  trigger: StorytellerTrigger;
  /** Which narration line to speak — resolved to STORYTELLER_LINES inside
      this lazy chunk so hosts never import the caption copy. */
  lineKey: StorytellerLineKey;
  showFigure: boolean;
  /** "dock" = ResultCard top-left · "modal" = summary modal · "inline" = GeoDetective hook. */
  variant: "dock" | "modal" | "inline";
  /** Called on tap-caption dismiss so the host can return focus (ResultCard → Continue). */
  onDismiss?: () => void;
}

function emitStoryteller(
  type: ObservabilityEvent["type"],
  params: Record<string, unknown>,
): void {
  try {
    getObservability().emit({
      type,
      ts: Date.now(),
      buildId: CURRENT_BUILD_ID,
      ...params,
    });
  } catch {
    // Observability must never break gameplay.
  }
}

/**
 * Decorative figure. The button is the accessible pause/resume control
 * (aria-label "Pause the story"); the img itself is aria-hidden with
 * decoding="async", mirroring CometMascot's pointer-event gating.
 */
export function StorytellerMascot({
  label,
  onToggle,
  onLoaded,
  src,
}: {
  label: string;
  onToggle?: () => void;
  onLoaded?: () => void;
  /** Asset URL for the pose — from storyteller-assets.json. Defaults to the
      placeholder figure so F1/F2 poses swap with zero code change. */
  src?: string;
}) {
  return (
    <button
      type="button"
      className="storyteller-figure"
      data-testid="storyteller-figure"
      aria-label={label}
      onClick={onToggle}
    >
      <img
        src={src ?? storytellerFigureUrl()}
        alt=""
        aria-hidden="true"
        decoding="async"
        onLoad={onLoaded}
      />
    </button>
  );
}

/** True while Grandpa's tasting-tour overlay drives (the Storyteller yields). */
export function useTourActive(): boolean {
  const [active, setActive] = useState(
    () =>
      typeof document !== "undefined" &&
      document.querySelector('[data-tour="active"]') !== null,
  );
  useEffect(() => {
    const onStart = () => setActive(true);
    const onEnd = () => setActive(false);
    window.addEventListener("meridian:tour-walk-start", onStart);
    window.addEventListener("meridian:tour-walk-end", onEnd);
    // In case the tour was already walking when this mounted.
    if (document.querySelector('[data-tour="active"]') !== null) setActive(true);
    return () => {
      window.removeEventListener("meridian:tour-walk-start", onStart);
      window.removeEventListener("meridian:tour-walk-end", onEnd);
    };
  }, []);
  return active;
}

/** True while a celebration overlay owns the screen (the Storyteller yields). */
export function useCelebrationActive(): boolean {
  const [active, setActive] = useState(
    () =>
      typeof document !== "undefined" &&
      document.querySelector('[data-celebration="active"]') !== null,
  );
  useEffect(() => {
    const onOpen = () => setActive(true);
    const onClose = () => setActive(false);
    window.addEventListener("meridian:celebration-open", onOpen);
    window.addEventListener("meridian:celebration-close", onClose);
    // In case the overlay was already open when this mounted (the mount
    // effect's dispatch races a same-commit narration mount).
    if (document.querySelector('[data-celebration="active"]') !== null)
      setActive(true);
    return () => {
      window.removeEventListener("meridian:celebration-open", onOpen);
      window.removeEventListener("meridian:celebration-close", onClose);
    };
  }, []);
  return active;
}

export function StorytellerNarration({
  screen,
  trigger,
  lineKey,
  showFigure,
  variant,
  onDismiss,
}: StorytellerNarrationProps) {
  const tourActive = useTourActive();
  // P1-1: the narration yields while the celebration overlay owns the
  // screen — same pattern as the tour handshake.
  const celebrationActive = useCelebrationActive();
  const celebrationActiveRef = useRef(celebrationActive);
  celebrationActiveRef.current = celebrationActive;
  // Resolved here — inside the lazy chunk — so the host screens never
  // statically import the caption copy into the initial bundle.
  const line = STORYTELLER_LINES[lineKey];
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [wordsShown, setWordsShown] = useState(0);
  const [soundOn] = useState(() => isSoundEnabled());
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const [speakerUsed, setSpeakerUsed] = useState(false);

  const reducedMotion = useRef(
    typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  ).current;

  const wordsRef = useRef<string[]>([]);
  const gestureDoneRef = useRef(false);
  const dismissedRef = useRef(false);
  const audioStartTimeRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const revealTimer = useRef(0);
  const dismissTimer = useRef(0);
  const audioUrl = useRef(storytellerAudioUrl(line.audioFile));
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Auto path: first-gesture audio when sound is on (T1/T4 + hook). The
  // speaker trigger (T2) and the sound-off path are manual only.
  const autoAttempt = (trigger === "first_gesture" || trigger === "summary") && soundOn;

  const dismiss = useCallback(
    (reason: "tap_caption" | "screen_exit") => {
      if (dismissedRef.current) return;
      dismissedRef.current = true;
      window.clearTimeout(revealTimer.current);
      window.clearTimeout(dismissTimer.current);
      audioRef.current?.pause();
      audioRef.current = null;
      emitStoryteller("narration_dismissed", {
        screen,
        at_line: wordsShown >= wordsRef.current.length ? 1 : 0,
        reason,
      });
      setLeaving(true);
      window.setTimeout(() => setVisible(false), DISMISS_ANIM_MS);
      if (reason === "tap_caption" && !celebrationActiveRef.current)
        onDismissRef.current?.();
    },
    [audioState, screen, wordsShown],
  );

  const scheduleDismiss = useCallback(
    (ms: number, reason: "tap_caption" | "screen_exit" = "tap_caption") => {
      window.clearTimeout(dismissTimer.current);
      dismissTimer.current = window.setTimeout(() => dismiss(reason), ms);
    },
    [dismiss],
  );

  /** Reveal words one at a time; in pure-text mode the line ends with the text-only hold. */
  const beginReveal = useCallback(
    (perWordMs: number, textOnly: boolean) => {
      window.clearTimeout(revealTimer.current);
      const total = wordsRef.current.length;
      if (reducedMotion) {
        setWordsShown(total);
        if (textOnly) scheduleDismiss(DISMISS_TEXT_ONLY_MS);
        return;
      }
      let i = 0;
      setWordsShown(0);
      const tick = () => {
        if (dismissedRef.current) return;
        i += 1;
        setWordsShown(i);
        if (i < total) {
          revealTimer.current = window.setTimeout(tick, perWordMs);
        } else if (textOnly) {
          scheduleDismiss(DISMISS_TEXT_ONLY_MS);
        }
      };
      revealTimer.current = window.setTimeout(tick, perWordMs);
    },
    [reducedMotion, scheduleDismiss],
  );

  const playNarrationAudio = useCallback(
    (telemetryTrigger: "first_gesture" | "speaker" | "replay" | "summary") => {
      if (dismissedRef.current) return;
      // A replay stops the current line first.
      audioRef.current?.pause();
      audioRef.current = null;
      window.clearTimeout(dismissTimer.current);
      audioStartTimeRef.current = Date.now();
      const audio = new Audio(audioUrl.current);
      audioRef.current = audio;
      setAudioState("playing");
      const startAt = Date.now();
      emitStoryteller("narration_started", {
        screen,
        trigger: telemetryTrigger,
        sound_on: true,
        line_count: 1,
      });
      const onEnded = () => {
        setAudioState("ended");
        audioRef.current = null; // natural end — unmount must not emit screen_exit
        emitStoryteller("narration_completed", {
          screen,
          duration_ms: Date.now() - startAt,
          trigger: telemetryTrigger,
        });
        if (!dismissedRef.current) scheduleDismiss(DISMISS_AFTER_AUDIO_MS);
      };
      const onFail = (err?: unknown) => {
        // Audio unavailable — degrade to silent text-only, never device-shame.
        setAudioState("failed");
        audioRef.current = null;
        emitStoryteller("narration_failed", {
          screen,
          error_name: sanitizeError(err ?? "audio_error").name,
          trigger: telemetryTrigger,
        });
        if (!dismissedRef.current) {
          window.clearTimeout(revealTimer.current);
          setWordsShown(wordsRef.current.length);
          scheduleDismiss(DISMISS_TEXT_ONLY_MS);
        }
      };
      audio.addEventListener("ended", onEnded, { once: true });
      audio.addEventListener("error", () => onFail(), { once: true });
      void audio
        .play()
        .then(() => {
          if (dismissedRef.current) return;
          window.setTimeout(() => {
            if (dismissedRef.current) return;
            if (reducedMotion) {
              setWordsShown(wordsRef.current.length);
              return;
            }
            const perWord = wordMsFromDuration(
              (audio.duration || 0) * 1000,
              wordsRef.current.length,
              FALLBACK_WORD_MS,
            );
            beginReveal(perWord, false);
          }, AUDIO_LEAD_MS);
        })
        .catch(onFail);
    },
    [beginReveal, reducedMotion, scheduleDismiss, screen],
  );

  // Mount-once orchestration (CometGreeting pattern): caption text appears
  // instantly; audio waits for the first gesture on the auto path.
  useEffect(() => {
    wordsRef.current = line.text.split(" ");
    setVisible(true);
    if (!tourActive && !celebrationActive) {
      emitStoryteller("storyteller_shown", {
        screen,
        sound_on: soundOn,
        reduced_motion: reducedMotion,
      });
    }

    if (reducedMotion) {
      setWordsShown(wordsRef.current.length);
    }

    const onFirstGesture = () => {
      if (gestureDoneRef.current || dismissedRef.current) return;
      // P1-1: a gesture that lands while the celebration overlay owns the
      // screen belongs to the overlay — don't consume it for narration.
      if (celebrationActiveRef.current) return;
      gestureDoneRef.current = true;
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
      if (!isSoundEnabled()) return; // toggled off between mount and gesture
      playNarrationAudio(trigger === "summary" ? "summary" : "first_gesture");
    };

    if (autoAttempt && !celebrationActive) {
      window.addEventListener("pointerdown", onFirstGesture);
      window.addEventListener("keydown", onFirstGesture);
      if (!reducedMotion) beginReveal(FALLBACK_WORD_MS, false);
    } else if (!reducedMotion) {
      // Manual/sound-off path: text-first, no timed reveal.
      setWordsShown(wordsRef.current.length);
    }

    const onPageHide = () => dismiss("screen_exit");
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
      window.removeEventListener("pagehide", onPageHide);
      window.clearTimeout(revealTimer.current);
      window.clearTimeout(dismissTimer.current);
      const wasPlaying = audioRef.current !== null;
      audioRef.current?.pause();
      audioRef.current = null;
      if (wasPlaying && !dismissedRef.current) {
        dismissedRef.current = true;
        emitStoryteller("narration_dismissed", {
          screen,
          at_line: 0,
          reason: "screen_exit",
        });
      }
    };
    // Mount-once; live values flow through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // T2: the 44px speaker button plays once and NEVER flips meridian.sound.
  const handleSpeaker = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (dismissedRef.current || audioState === "playing") return;
    setSpeakerUsed(true);
    playNarrationAudio("speaker");
  };

  // T3: per-line replay (44px, hidden when muted).
  const handleReplay = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (dismissedRef.current || audioState === "playing") return;
    emitStoryteller("narration_replayed", { screen, line_index: 0, trigger: "replay" });
    playNarrationAudio("replay");
  };

  // Tap the figure: pause/resume the narration.
  const handleFigureToggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioState === "playing") {
      audio.pause();
      setAudioState("paused");
    } else if (audioState === "paused") {
      void audio.play().catch(() => {
        setAudioState("failed");
      });
      setAudioState("playing");
    }
  }, [audioState]);

  const handleCaptionClick = () => {
    // The tap that starts audio must not instantly dismiss it.
    if (Date.now() - audioStartTimeRef.current < AUDIO_START_TAP_GUARD_MS) return;
    dismiss("tap_caption");
  };

  if (celebrationActive || tourActive || !visible) return null;

  const words = wordsRef.current;
  const fullText = line.text;
  const failed = audioState === "failed";
  const showSpeaker = !autoAttempt || !soundOn;
  const showReplay = soundOn || speakerUsed;

  const figureLabel =
    audioState === "playing"
      ? "Pause the story"
      : audioState === "paused"
        ? "Resume the story"
        : "The storyteller";

  const caption = (
    <div
      className="storyteller-caption"
      data-testid="storyteller-caption"
      role="status"
      onClick={handleCaptionClick}
    >
      <p
        className="storyteller-caption-text"
        data-testid="storyteller-caption-text"
        aria-label={fullText}
      >
        {words.map((w, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={i < wordsShown ? "storyteller-word shown" : "storyteller-word"}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
      {failed ? (
        <span className="storyteller-fallback" data-testid="storyteller-fallback">
          {STORYTELLER_AUDIO_FALLBACK_LINE}
        </span>
      ) : null}
      {showSpeaker && !failed ? (
        <button
          type="button"
          className="storyteller-speaker"
          data-testid="storyteller-speaker"
          aria-label="Hear the storyteller's story"
          onClick={handleSpeaker}
        >
          <Volume2 aria-hidden="true" />
        </button>
      ) : null}
      {showReplay && !failed ? (
        <button
          type="button"
          className="storyteller-replay"
          data-testid="storyteller-replay"
          aria-label="Replay this line"
          onClick={handleReplay}
        >
          <RotateCcw aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );

  const figure = showFigure ? (
    <StorytellerMascot
      label={figureLabel}
      onToggle={handleFigureToggle}
      onLoaded={() => {
        try {
          recordMilestone("storyteller_ready");
        } catch {
          // Never break gameplay.
        }
      }}
    />
  ) : null;

  if (variant === "dock") {
    return (
      <div className="storyteller storyteller-dock" data-testid="storyteller-narration">
        <div className={`storyteller-enter${leaving ? " storyteller-leave" : ""}`}>
          {figure}
          {caption}
        </div>
      </div>
    );
  }
  if (variant === "modal") {
    return (
      <div className="storyteller storyteller-modal-host" data-testid="storyteller-narration">
        <div className={`storyteller-enter${leaving ? " storyteller-leave" : ""}`}>
          {figure}
          {caption}
        </div>
      </div>
    );
  }
  return (
    <div className="storyteller storyteller-inline" data-testid="storyteller-narration">
      <div className={`storyteller-enter${leaving ? " storyteller-leave" : ""}`}>{caption}</div>
    </div>
  );
}

// Default export for React.lazy — the narration is the unit hosts mount.
export default StorytellerNarration;
