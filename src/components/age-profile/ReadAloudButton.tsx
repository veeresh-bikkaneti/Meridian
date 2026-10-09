/**
 * ReadAloudButton.tsx — the read-aloud control with three visual states
 * (Phase 2 §4), driven by the band's `audioMode`.
 *
 * - auto (5-7): filled "🔊 Listen" button; auto-plays on card reveal.
 * - button (8-10): ghost outline button; the kid chooses every time.
 * - off (11-13): no visible button per design — the button stays
 *   AVAILABLE via a small text link (deviation: the result card has no
 *   overflow menu yet, so a quiet link stands in).
 *
 * speechSynthesis is device-local (works fully offline). When speech is
 * unavailable, auto degrades to a prominent button — never silent-locked.
 * A band change never interrupts in-progress speech: the component speaks
 * at most once per `speakKey`; new modes apply from the next card.
 */

import { useEffect, useRef, useState } from "react";
import type { AudioMode } from "@/game/age-profile";

export interface ReadAloudButtonProps {
  /** The text to speak (the card story). */
  text: string;
  /** Band audio mode. */
  mode: AudioMode;
  /** Autoplay request: true when the mapper says this card should auto-play. */
  autoplay: boolean;
  /** Stable per card: re-speak only when the card changes. */
  speakKey: string;
}

function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function ReadAloudButton({ text, mode, autoplay, speakKey }: ReadAloudButtonProps) {
  const [playing, setPlaying] = useState(false);
  const spokenKey = useRef<string | null>(null);

  const speak = () => {
    if (!speechAvailable() || !text) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.onend = () => setPlaying(false);
    utter.onerror = () => setPlaying(false);
    setPlaying(true);
    synth.speak(utter);
  };

  const stop = () => {
    if (speechAvailable()) window.speechSynthesis.cancel();
    setPlaying(false);
  };

  // Auto-play once per card for the auto mode (5-7). Guarded by speakKey so
  // re-renders and mid-session band changes never restart speech.
  useEffect(() => {
    if (mode === "auto" && autoplay && spokenKey.current !== speakKey) {
      spokenKey.current = speakKey;
      speak();
    }
    // Stop speech when the card leaves (mode/button unmounts on next card).
    return () => {
      if (speechAvailable()) window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakKey, mode, autoplay]);

  if (mode === "off") {
    // Design: hidden but available. The result card has no overflow menu,
    // so a quiet text link stands in (deviation noted in the Phase 3 report).
    return (
      <button
        type="button"
        className="agep-listen-quiet"
        onClick={playing ? stop : speak}
        aria-label={playing ? "Stop reading aloud" : "Read story aloud"}
      >
        {playing ? "⏸ Stop" : "🔊 Read aloud"}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={mode === "auto" ? "agep-listen agep-listen-auto" : "agep-listen"}
      onClick={playing ? stop : speak}
      aria-label={playing ? "Pause the story" : "Listen to the story"}
      aria-pressed={playing}
    >
      {playing ? "⏸ Pause" : "🔊 Listen"}
    </button>
  );
}
