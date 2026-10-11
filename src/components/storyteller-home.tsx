import { useCallback, useEffect, useRef, useState } from "react";
import { StorytellerMascot, isPlayAbort, useCelebrationActive, useTourActive } from "./storyteller";
import { fallbackLine, shouldReplayGreeting } from "./storyteller-audio-guards";
import { STORYTELLER_HOME_RETRY_HINT } from "./storyteller-lines";
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
  takeTourReturnLine,
} from "./storyteller-session";
import { recordMilestone } from "@/lib/observability";
import "./storyteller-home.css";

// Storyteller banner host — the Storyteller sits IN THE BANNER beside the
// Meridian branding (owner directive 2026-10-09 — the hero strip is gone).
//
// State machine:
//   entering → greeting_text →(first gesture + sound on)→
//   greeting_audio →(end|dismiss|12s)→ idle_linger
//   (tour start|celebration|dismiss|timeout)→ figure only (no unmount — the
//   figure lives in the banner).
//   tour-return (copy G2): entering → greeting_text (text-only return line)
//     →(hold elapses|dismiss)→ the greeting above runs (owner ruling #1,
//     2026-10-09 — dismissing the return line is not a dead end; panel
//     BLOCK 3).
//
// - Every home visit greets (owner 2026-10-09): the tour-return line wins
//   exactly once after Grandpa's tour, otherwise the daily greeting.
//   Text-first, audio on the first gesture.
// - Sound muted: figure + full caption render; no autoplay attempt; a muted
//   first gesture surfaces a one-line sound-off hint (then the greeting
//   caption returns); the mute toggle is the ONLY silence.
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
// Reuses StorytellerMascot (the Grandpa mascot: transparent webp sprite
// sheets bundled in the repo, cursor-tracked on desktop, static on touch).
// No visible name ("historian feel" per owner).

type BannerPhase =
  | "entering"
  | "greeting_text"
  | "greeting_audio"
  | "idle_linger"
  | "exiting";

const ENTER_MS = 150;
const EXIT_MS = 150;
const TEXT_BUBBLE_MS = 6000;
/** Panel 2026-10-09 (BLOCK 3): dismissed-return-line follow-up delay — the
    kid already waited through the line, so fire sooner than TEXT_BUBBLE_MS. */
const FOLLOWUP_AFTER_DISMISS_MS = 900;
/** Panel 2026-10-09 (BLOCK 5): sound-off hint hold. The hint copy below is
    NEW — owner/panel approval required before merge. */
const SOUND_OFF_HINT_MS = 4000;
const SOUND_OFF_HINT =
  "Psst — your sound is off, young explorer. Tap the speaker above to hear my tale.";
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

interface ResolvedAssets {
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
  // Pause state for the greeting audio — tracked via pause/play events so
  // the figure label can show "Resume the greeting" mid-greeting.
  const [greetingPaused, setGreetingPaused] = useState(false);
  // Track B (Homer motion): transient visual states — the poke startle and
  // the graceful yield-out. Neither touches the phase machine.
  const [poked, setPoked] = useState(false);
  const [yielding, setYielding] = useState(false);
  const [assets, setAssets] = useState<ResolvedAssets>({
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
  // Panel 2026-10-09 (BLOCK 3): dismissing the text-only return line must
  // not be a dead end — dismissBubble sets this; the follow-up effect
  // consumes it when the follow-up greeting runs.
  const returnLineDismissedRef = useRef(false);
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  // Fix D — greeting replay bookkeeping. The poke path used to trap a
  // failed/missed/silent greeting behind text-only lines; a figure tap now
  // replays the greeting when it was attempted but never heard.
  const greetingHeardRef = useRef(false);
  const greetAttemptedRef = useRef(false);
  const greetDismissedByUserRef = useRef(false);
  // Fix D — tour gate for the window gesture one-shot. Updated
  // synchronously on the tour's window events, so a tap that lands between
  // the tour's dispatch and React's re-render can't burn the greeting.
  const tourActiveRef = useRef(false);
  // Fix E: set when the banner greeting failed on a play() rejection
  // (not a network error) so the fallback can offer the retry affordance.
  const greetPlayRejectedRef = useRef(false);
  // A resource "error" event means the clip itself failed to load — the
  // play() promise rejects then too, but retrying is futile, so no hint.
  const greetLoadErrorRef = useRef(false);

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
    setGreetingPaused(false);
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

  // ---- Tour-active ref (Fix D) ------------------------------------------------
  // Synchronous mirror of the tour walk state for the gesture handler —
  // React state can lag the tour's dispatch by a render, and a tap in that
  // gap must not consume the greeting one-shot.
  useEffect(() => {
    const onStart = () => {
      tourActiveRef.current = true;
    };
    const onEnd = () => {
      tourActiveRef.current = false;
    };
    window.addEventListener("meridian:tour-walk-start", onStart);
    window.addEventListener("meridian:tour-walk-end", onEnd);
    return () => {
      window.removeEventListener("meridian:tour-walk-start", onStart);
      window.removeEventListener("meridian:tour-walk-end", onEnd);
    };
  }, []);

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
      const wasNarrating = phase === "greeting_audio";
      // Capture BEFORE stopAudio() nulls the ref: phase lingers as
      // "greeting_audio" for POST_AUDIO_HOLD_MS after natural end, so
      // phase alone can't tell "killed mid-flight" from "already heard".
      const audioAlive = audioRef.current !== null;
      stopAudio();
      hideBubble();
      // If the tour/celebration interrupted narration, the 12s cap timer
      // died with it — park in idle_linger so the machine doesn't stall in
      // a dead greeting_audio phase. (Tour close re-arms via
      // takeTourReturnLine, which resets phase explicitly.)
      if (wasNarrating) {
        // The tour killed audio mid-flight, but the one-shot gesture flag
        // is still consumed — the post-tour follow-up greeting would then
        // be un-startable on tap. Re-arm so the next gesture can narrate.
        // (Only when audio actually died mid-flight: if the greeting had
        // already completed during the hold window, the flag stays
        // consumed and the greeting must not replay. Tour-return mode is
        // text-only and onGesture returns early there anyway.)
        if (audioAlive) gestureDoneRef.current = false;
        setPhase("idle_linger");
      }
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
  }, [yielded, phase, stopAudio, hideBubble]);

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
  // Owner 2026-10-09 (ruling #1): the greeting happens regardless of the
  // tour. After the return line's hold elapses, run the normal greeting
  // (mp3 on gesture). Dedicated effect (not chained timers in the entering
  // effect): the phase change above would clean up a chained timer and
  // stall the machine. A tour opening cancels the follow-up — dismissing
  // the line does NOT (panel 2026-10-09, BLOCK 3): the dismissed path
  // below still runs the greeting, sooner, since the kid already waited
  // through the line.
  useEffect(() => {
    if (yielded || mode !== "tour-return") return;
    if (phase === "greeting_text") {
      const t = window.setTimeout(() => {
        returnLineDismissedRef.current = false;
        setMode("greeting");
        setPhase("entering");
      }, TEXT_BUBBLE_MS);
      return () => window.clearTimeout(t);
    }
    if (phase === "idle_linger" && returnLineDismissedRef.current) {
      const t = window.setTimeout(() => {
        returnLineDismissedRef.current = false;
        setMode("greeting");
        setPhase("entering");
      }, FOLLOWUP_AFTER_DISMISS_MS);
      return () => window.clearTimeout(t);
    }
  }, [yielded, mode, phase]);

  // ---- Greeting audio ------------------------------------------------------
  const beginGreetingAudio = useCallback(() => {
    const url = assetsRef.current.greetAudio;
    if (!url || !isSoundEnabled()) return;
    stopAudio();
    // Fix D: a new attempt resets the replay bookkeeping.
    greetAttemptedRef.current = true;
    greetingHeardRef.current = false;
    greetDismissedByUserRef.current = false;
    greetPlayRejectedRef.current = false;
    greetLoadErrorRef.current = false;
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
    const onEnded = () => {
      greetingHeardRef.current = true;
      finish();
    };
    // Fix D: the greeting counts as heard once its clock audibly advances —
    // "ended" alone misses the case where audio started then died silently.
    const onTimeUpdate = () => {
      if (audio.currentTime > 0.5) greetingHeardRef.current = true;
    };
    const onFail = () => {
      // Audio unavailable — degrade to silent text-only, never device-shame.
      // (showBubble clears the failure flag, so set it after.)
      // Release the dead element: a stale audioRef would make later figure
      // taps think audio is still in flight (Fix D replay guard).
      stopAudio();
      showBubble(greetingText, TEXT_BUBBLE_MS);
      setAudioFailed(true);
      setPhase("idle_linger");
    };
    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener(
      "error",
      () => {
        // The clip failed to load — the play() promise rejects too, but
        // this is a network failure, not a playback stall (Fix E).
        greetLoadErrorRef.current = true;
        onFail();
      },
      { once: true },
    );
    audio.addEventListener("timeupdate", onTimeUpdate);
    // Track pause state so the figure label can show "Resume the greeting".
    const onPause = () => setGreetingPaused(true);
    const onPlay = () => setGreetingPaused(false);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);
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
      .catch((err) => {
        // A play() aborted by our own pause() is the pause working, not a
        // failure — don't kill the greeting window.
        if (isPlayAbort(err)) return;
        // No resource error: the clip is fine but playback never started
        // (autoplay policy / stall) — retrying may help (Fix E).
        if (!greetLoadErrorRef.current) greetPlayRejectedRef.current = true;
        onFail();
      });
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
      // Panel 2026-10-09 (BLOCK 1): the return line is text-only by design —
      // the dismiss tap must not start the greeting mp3 under it. The
      // follow-up greeting flips mode to "greeting" and arms its own
      // gesture listener afterward.
      if (mode === "tour-return") return;
      if (isSoundEnabled() && assetsRef.current.greetAudio) {
        gestureDoneRef.current = true;
        showBubble(greetingText, null);
        beginGreetingAudio();
      }
    }
  }, [tutorialInviteVisible, greetingText, showBubble, beginGreetingAudio, yielded, mode]);

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
    if (yielded) return; // tour/celebration owns the stage — no gesture audio under it
    if (!assets.greetAudio) return; // text-only greeting, nothing to wait for
    const onGesture = () => {
      if (gestureDoneRef.current) return;
      // Fix D: a tap that lands while the tour owns the screen must not
      // burn the greeting one-shot. Checked on the ref — the `yielded`
      // closure below can be stale between the tour's dispatch and React's
      // re-render.
      if (tourActiveRef.current) return;
      if (!isSoundEnabled()) {
        // Panel 2026-10-09 (BLOCK 5, round 2): a muted tap must NOT consume
        // the one-shot — otherwise the hint below promises narration ("tap
        // the speaker to hear my tale") that can never play. The one-shot
        // stays armed; unmuting (see the meridian:sound-change listener)
        // starts the tale, so the hint never lies.
        window.clearTimeout(bubbleTimer.current);
        setBubble(SOUND_OFF_HINT);
        bubbleTimer.current = window.setTimeout(() => {
          showBubble(greetingText, null);
        }, SOUND_OFF_HINT_MS);
        return;
      }
      gestureDoneRef.current = true;
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      beginGreetingAudio();
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [started, phase, mode, yielded, assets.greetAudio, beginGreetingAudio, greetingText, showBubble]);

  // Unmute starts the pending tale (panel 2026-10-09, BLOCK 5 round 2).
  // The muted-tap hint promises "tap the speaker above to hear my tale" —
  // the speaker tap is a genuine user gesture, so playback is allowed, and
  // this makes the promise true. Fires only while the greeting is actively
  // pending; unmuting later (or for game SFX) does nothing here.
  useEffect(() => {
    const onSoundChange = (e: Event) => {
      if (!(e as CustomEvent<boolean>).detail) return; // muted — nothing to do
      if (gestureDoneRef.current) return;
      if (phase !== "greeting_text" || mode !== "greeting" || yielded) return;
      if (!assetsRef.current.greetAudio) return;
      gestureDoneRef.current = true;
      beginGreetingAudio();
    };
    window.addEventListener("meridian:sound-change", onSoundChange);
    return () =>
      window.removeEventListener("meridian:sound-change", onSoundChange);
  }, [phase, mode, yielded, beginGreetingAudio]);

  // ---- Dismiss -------------------------------------------------------------
  const dismissBubble = useCallback(
    (viaKeyboard: boolean) => {
      stopAudio();
      hideBubble();
      // Fix D: a greeting the kid explicitly dismissed stays dismissed — a
      // later figure tap pokes, it must not resurrect killed audio.
      if (phase === "greeting_audio") greetDismissedByUserRef.current = true;
      // Panel 2026-10-09 (BLOCK 3): dismissing the text-only return line is
      // not a dead end (owner ruling #1, 2026-10-09) — flag it so the
      // tour-return follow-up effect still runs the greeting afterward.
      if (mode === "tour-return") returnLineDismissedRef.current = true;
      setPhase("idle_linger");
      if (viaKeyboard) firstEditionControl()?.focus({ preventScroll: true });
    },
    [stopAudio, hideBubble, mode],
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
    // The window one-shot may have started the greeting on this tap's way
    // down (pointerdown precedes click, and phase hasn't re-rendered yet) —
    // don't poke over it, and don't double-start it.
    if (audio) return;
    // Fix D — narration-silence recovery: a greeting that was attempted
    // but never heard must be replayable. The figure tap replays it
    // instead of rotating a text-only poke line that would trap the
    // silence. A greeting the kid explicitly dismissed is excluded —
    // quiet means quiet.
    if (
      shouldReplayGreeting({
        mode,
        started: startedRef.current,
        attempted: greetAttemptedRef.current,
        heard: greetingHeardRef.current,
        dismissedByUser: greetDismissedByUserRef.current,
        oneShotConsumed: gestureDoneRef.current,
        greetAudioAvailable: assetsRef.current.greetAudio !== null,
        soundOn: isSoundEnabled(),
      })
    ) {
      // BLOCK 3 (scrum 2026-10-11): the Fix D replay branch gets the same
      // 600 ms tap debounce as the poke path — a tap storm must not fire
      // one mp3 request per tap. lastPokeRef is the shared figure-tap
      // timestamp (replay and poke are both figure taps).
      const replayNow = Date.now();
      if (replayNow - lastPokeRef.current < POKE_DEBOUNCE_MS) return;
      lastPokeRef.current = replayNow;
      beginGreetingAudio();
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
  }, [mode, phase, showBubble, pokeVisual, beginGreetingAudio]);

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

  const figureLabel =
    phase === "greeting_audio" && audioRef.current !== null
      ? greetingPaused
        ? "Resume the greeting"
        : "Pause the greeting"
      : "The storyteller";

  const bannerClassName =
    "storyteller-banner" +
    (poked ? " is-poked" : "") +
    (yielded && yielding ? " is-yielding" : "");

  // Fix E + BLOCK 1 (scrum 2026-10-11): a play() rejection appends the
  // one-time retry affordance; network errors keep the plain fallback.
  // Never device-shames. The banner has no speaker button at all, so the
  // hint names the real retry path — the figure-tap greeting replay
  // (Fix D). Copy is owner-sign-off pending before merge.
  const homeFailedLine = fallbackLine({
    failed: audioFailed,
    playRejected: greetPlayRejectedRef.current,
    retryHint: STORYTELLER_HOME_RETRY_HINT,
  });

  return (
    <div
      className={bannerClassName}
      data-testid="storyteller-home"
      data-phase={phase}
    >
      <StorytellerMascot
        label={figureLabel}
        onToggle={handleFigureTap}
        onLoaded={() => {
          try {
            recordMilestone("storyteller_ready");
          } catch {
            // Never break the home screen.
          }
        }}
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
          {homeFailedLine ? (
            <span
              className="storyteller-fallback"
              data-testid="storyteller-home-fallback"
            >
              {homeFailedLine}
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
