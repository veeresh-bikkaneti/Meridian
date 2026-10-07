import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Volume2 } from "lucide-react";
import { isSoundEnabled } from "@/game/audio/sfx";
import {
  COMET_GREETING_LINES,
  greetingAudioUrl,
  greetingIndexFor,
} from "./comet-greetings";

// Designer decisions (locked):
// 1. Sound ON: audio + text together, audio leads by ~150ms; text reveals
//    word-by-word timed to the narration (mp3 duration / word count).
// 2. Sound OFF: animated text only, plus a tappable speaker icon on the
//    bubble that plays the greeting once — it never flips the global toggle.
// 3. Autoplay: the text bubble shows immediately; audio waits for the first
//    user interaction (one-shot pointerdown/keydown). A gesture within ~3s
//    restarts the text in sync with the audio; later, audio plays over the
//    static bubble.
// 4. Dismissal: greeting end + 3s (6s for text-only); tap dismisses
//    instantly; leaving the home page unmounts (and silences) the greeting.
// 5. Frequency: once per local day via meridian.cometGreeting.lastDate.
// 6. Reduced motion: full text instantly, ≤150ms opacity fade on the bubble,
//    no bounce/wiggle; audio timing unchanged.
const SYNC_WINDOW_MS = 3000;
const AUDIO_LEAD_MS = 150;
const FALLBACK_WORD_MS = 260;
const DISMISS_AFTER_AUDIO_MS = 3000;
const DISMISS_TEXT_ONLY_MS = 6000;
const DISMISS_AFTER_SPEAKER_MS = 2000;

type AudioState = "idle" | "playing" | "ended" | "failed";

export function CometGreeting({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [visible, setVisible] = useState(false);
  const [wordsShown, setWordsShown] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const [speakerPlaying, setSpeakerPlaying] = useState(false);

  const reducedMotion = useRef(
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches,
  ).current;

  const indexRef = useRef(0);
  const wordsRef = useRef<string[]>([]);
  const mountTimeRef = useRef(0);
  const modeRef = useRef<"text" | "audio">("text");
  const gestureDoneRef = useRef(false);
  const dismissedRef = useRef(false);
  const revealTimer = useRef(0);
  const dismissTimer = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Veeresh 2026-10-06: the tap that starts audio must not dismiss the bubble.
  // pointerdown starts audio, click dismisses — same tap would kill it.
  const audioStartTimeRef = useRef(0);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    window.clearTimeout(revealTimer.current);
    window.clearTimeout(dismissTimer.current);
    audioRef.current?.pause();
    audioRef.current = null;
    setVisible(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  const scheduleDismiss = useCallback(
    (ms: number) => {
      window.clearTimeout(dismissTimer.current);
      dismissTimer.current = window.setTimeout(() => dismiss(), ms);
    },
    [dismiss],
  );

  /** Reveal words one at a time; in "text" mode the greeting ends with the text-only hold. */
  const beginReveal = useCallback(
    (perWordMs: number) => {
      window.clearTimeout(revealTimer.current);
      const total = wordsRef.current.length;
      let i = 0;
      setWordsShown(0);
      const tick = () => {
        if (dismissedRef.current) return;
        i += 1;
        setWordsShown(i);
        if (i < total) {
          revealTimer.current = window.setTimeout(tick, perWordMs);
        } else if (modeRef.current === "text") {
          scheduleDismiss(DISMISS_TEXT_ONLY_MS);
        }
      };
      revealTimer.current = window.setTimeout(tick, perWordMs);
    },
    [scheduleDismiss],
  );

  const playGreetingAudio = useCallback(
    (synced: boolean) => {
      modeRef.current = "audio";
      // Bug B fix: clear any stale text-mode dismiss timer so it can't cut audio mid-play.
      window.clearTimeout(dismissTimer.current);
      // Bug A fix: record when audio starts so the tap that started it doesn't dismiss.
      audioStartTimeRef.current = Date.now();
      const audio = new Audio(greetingAudioUrl(indexRef.current));
      audioRef.current = audio;
      setAudioState("playing");
      const onEnded = () => {
        setAudioState("ended");
        if (!dismissedRef.current) scheduleDismiss(DISMISS_AFTER_AUDIO_MS);
      };
      const onFail = () => {
        // Audio unavailable — degrade to the text-only path, never silence the greeting.
        setAudioState("failed");
        audioRef.current = null;
        modeRef.current = "text";
        if (!dismissedRef.current) beginReveal(FALLBACK_WORD_MS);
      };
      audio.addEventListener("ended", onEnded, { once: true });
      audio.addEventListener("error", onFail, { once: true });
      void audio
        .play()
        .then(() => {
          if (!synced || dismissedRef.current) return;
          window.setTimeout(() => {
            if (dismissedRef.current) return;
            if (reducedMotion) {
              setWordsShown(wordsRef.current.length);
              return;
            }
            const d = audio.duration;
            const perWord =
              Number.isFinite(d) && d > 0 ? (d * 1000) / wordsRef.current.length : FALLBACK_WORD_MS;
            beginReveal(perWord);
          }, AUDIO_LEAD_MS);
        })
        .catch(onFail);
    },
    [beginReveal, reducedMotion, scheduleDismiss],
  );

  // Decision 3: hold audio until the first user interaction, anywhere.
  useEffect(() => {
    // Veeresh 2026-10-06: greet on every home page visit (not once per day).
    // Muting is via the global sound toggle — isSoundEnabled() gates audio below.
    const index = greetingIndexFor();
    indexRef.current = index;
    wordsRef.current = COMET_GREETING_LINES[index].split(" ");
    mountTimeRef.current = Date.now();

    const sound = isSoundEnabled();
    setSoundOn(sound);
    setVisible(true);
    onOpenChange?.(true);

    if (reducedMotion) {
      // Decision 6: full text instantly, no word-by-word.
      setWordsShown(wordsRef.current.length);
      scheduleDismiss(DISMISS_TEXT_ONLY_MS);
    } else {
      beginReveal(FALLBACK_WORD_MS);
    }

    const onFirstGesture = () => {
      if (gestureDoneRef.current || dismissedRef.current) return;
      gestureDoneRef.current = true;
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
      if (!isSoundEnabled()) {
        // Toggled off between load and gesture — honor it, stay text-only.
        setSoundOn(false);
        return;
      }
      if (Date.now() - mountTimeRef.current <= SYNC_WINDOW_MS) {
        playGreetingAudio(true); // restart text in sync, audio leads ~150ms
      } else {
        // Past the sync window: audio plays over the static bubble.
        window.clearTimeout(revealTimer.current);
        setWordsShown(wordsRef.current.length);
        playGreetingAudio(false);
      }
    };

    if (sound) {
      window.addEventListener("pointerdown", onFirstGesture);
      window.addEventListener("keydown", onFirstGesture);
    }
    const onPageHide = () => dismiss();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
      window.removeEventListener("pagehide", onPageHide);
      window.clearTimeout(revealTimer.current);
      window.clearTimeout(dismissTimer.current);
      audioRef.current?.pause();
      audioRef.current = null;
    };
    // Mount-once orchestration; all live values flow through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Decision 2: sound OFF → a speaker icon that plays the greeting once
  // without touching the global meridian.sound toggle.
  const handleSpeaker = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (speakerPlaying || dismissedRef.current) return;
    const audio = new Audio(greetingAudioUrl(indexRef.current));
    audioRef.current = audio;
    setSpeakerPlaying(true);
    setAudioState("playing");
    window.clearTimeout(dismissTimer.current); // don't cut the audio mid-play
    audio.addEventListener(
      "ended",
      () => {
        setSpeakerPlaying(false);
        setAudioState("ended");
        if (!dismissedRef.current) scheduleDismiss(DISMISS_AFTER_SPEAKER_MS);
      },
      { once: true },
    );
    const onFail = () => {
      setSpeakerPlaying(false);
      setAudioState("failed");
      audioRef.current = null;
    };
    audio.addEventListener("error", onFail, { once: true });
    void audio.play().catch(onFail);
  };

  if (!visible) return null;
  const words = wordsRef.current;
  const fullText = words.join(" ");
  return (
    <div
      className="comet-greeting"
      data-testid="comet-greeting"
      data-sound={soundOn ? "on" : "off"}
      data-audio={audioState}
      data-greeting-index={indexRef.current}
      role="status"
      onClick={() => {
        // Bug A fix: ignore the click if it's the same tap that started the audio
        // (pointerdown starts audio, click would immediately dismiss and pause it).
        if (Date.now() - audioStartTimeRef.current < 600) return;
        dismiss();
      }}
    >
      <p
        className="comet-greeting-text"
        data-testid="comet-greeting-text"
        aria-label={fullText}
      >
        {words.map((w, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={i < wordsShown ? "comet-greeting-word shown" : "comet-greeting-word"}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
      {!soundOn ? (
        <button
          type="button"
          className="comet-greeting-speaker"
          data-testid="comet-greeting-speaker"
          aria-label={speakerPlaying ? "Playing Comet's greeting" : "Hear Comet's greeting"}
          onClick={handleSpeaker}
        >
          <Volume2 className="comet-speaker-icon" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
