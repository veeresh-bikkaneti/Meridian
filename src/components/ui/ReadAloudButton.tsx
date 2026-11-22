/**
 * ReadAloudButton.tsx — the read-aloud control with three visual states
 * (Phase 2 §4), driven by the band's `audioMode`.
 *
 * - auto (no current group; mode kept): filled "🔊 Listen" button; auto-plays on card reveal.
 * - button (7-10): ghost speaker ICON, 44px, no text label; tap-to-play.
 * - off (10-18, 18+): the SAME ghost speaker icon as 7-10 — identical chrome
 *   across bands, so the band stays invisible to the child (Item C/B3).
 *
 * The kid-set onboarding preference (read-aloud-pref.ts) gates auto-read:
 * "sometimes"/"never" → no auto-read anywhere; "always" → auto-read when
 * sound is on; unset → today's band default.
 *
 * speechSynthesis is device-local (works fully offline). When speech is
 * unavailable the button STAYS visible and tappable; a tap shows the locked
 * "read along" line — never hidden, never device-shaming.
 * A band change never interrupts in-progress speech: the component speaks
 * at most once per `speakKey`; new modes apply from the next card.
 */

import { useEffect, useRef, useState } from "react";
import type { AudioMode } from "@/game/age-profile";
import { getReadAloudPref, shouldAutoPlayReadAloud } from "@/game/age-profile/read-aloud-pref";
import type { ReadAloudPrefOrUnset } from "@/game/age-profile/read-aloud-pref";
import { isSoundEnabled } from "@/game/audio/sfx";
import { claimVoice, type VoiceClaim } from "@/game/audio/voice-channel";

export interface ReadAloudButtonProps {
  /** The text to speak (the card story). */
  text: string;
  /** Band audio mode. */
  mode: AudioMode;
  /** Autoplay request: true when the mapper says this card should auto-play. */
  autoplay: boolean;
  /** Stable per card: re-speak only when the card changes. */
  speakKey: string;
  /**
   * Kid-set preference; when omitted the component reads it from storage.
   * Tests may inject it to avoid storage coupling.
   */
  pref?: ReadAloudPrefOrUnset;
}

/** Locked copy — shown when the device cannot speak. Never reword. */
export const READ_ALONG_MESSAGE = "The words are right here — read along with me.";

function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Speaker icon (shared by all groups — byte-identical chrome). */
function SpeakerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9.4 9.4 0 0 1 0 13" />
    </svg>
  );
}

/** Pause icon, shown while speaking. */
function PauseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="currentColor"
    >
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

export function ReadAloudButton({ text, mode, autoplay, speakKey, pref }: ReadAloudButtonProps) {
  const [playing, setPlaying] = useState(false);
  const [showReadAlong, setShowReadAlong] = useState(false);
  const spokenKey = useRef<string | null>(null);
  const claimRef = useRef<VoiceClaim | null>(null);

  /** Speak `text` on the device voice through the app-wide channel: a
   * tap takes the channel from whoever is speaking, auto-read waits its
   * turn and stays silent if someone else has it. */
  const speak = (userInitiated: boolean) => {
    const synth = window.speechSynthesis;
    const claim = claimVoice(
      "read-aloud",
      () => {
        synth.cancel();
        setPlaying(false);
      },
      { userInitiated },
    );
    if (!claim) return;
    claimRef.current = claim;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const end = () => {
      claim.release();
      setPlaying(false);
    };
    utter.onend = end;
    utter.onerror = end;
    setPlaying(true);
    synth.speak(utter);
  };

  const handleTap = () => {
    // No speech on this device: stay visible + tappable, show the locked
    // read-along line. Never hide the kid's tool, never device-shame.
    if (!speechAvailable()) {
      setPlaying(false);
      setShowReadAlong(true);
      return;
    }
    if (playing) {
      window.speechSynthesis.cancel();
      claimRef.current?.release();
      setPlaying(false);
      return;
    }
    if (!text) return;
    speak(true);
  };

  // Auto-play once per card. Guarded by speakKey so re-renders and
  // mid-session band changes never restart speech. The kid's preference
  // gates it: "sometimes"/"never" disable auto-read; "always" plays on
  // EVERY card in EVERY band when sound is on (owner 2026-10-09 — the old
  // `mode === "auto"` gate silently broke the promise for every group);
  // unset keeps today's per-card band default (auto mode only).
  useEffect(() => {
    setShowReadAlong(false);
    const bandWantsAuto = mode === "auto" && autoplay;
    if (spokenKey.current !== speakKey) {
      spokenKey.current = speakKey;
      const kidPref = pref ?? getReadAloudPref();
      if (shouldAutoPlayReadAloud(kidPref, bandWantsAuto, isSoundEnabled()) && speechAvailable() && text) {
        speak(false);
      }
    }
    // Stop speech when the card leaves (mode unmounts on the next card).
    return () => {
      if (speechAvailable()) window.speechSynthesis.cancel();
      claimRef.current?.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakKey, mode, autoplay]);

  // Mute toggle (setSoundEnabled(false)) cancels speechSynthesis globally.
  // Reset the playing state so the button doesn't stick on the pause icon
  // after an external mute. (Owner 2026-10-09: mute is the only off switch
  // for "Always" — it must reliably silence in-progress narration.)
  useEffect(() => {
    const onSoundOff = () => setPlaying(false);
    window.addEventListener("meridian:sound-off", onSoundOff);
    return () => window.removeEventListener("meridian:sound-off", onSoundOff);
  }, []);

  const auto = mode === "auto";

  return (
    <>
      <button
        type="button"
        className={auto ? "agep-listen agep-listen-auto" : "agep-listen agep-listen-icon"}
        onClick={handleTap}
        aria-label={playing ? "Pause the story" : "Listen to the story"}
        aria-pressed={playing}
      >
        {playing ? <PauseIcon /> : auto ? "🔊 Listen" : <SpeakerIcon />}
      </button>
      {showReadAlong ? (
        <span role="status" className="agep-listen-note">
          {READ_ALONG_MESSAGE}
        </span>
      ) : null}
    </>
  );
}
