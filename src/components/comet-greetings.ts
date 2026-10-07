/**
 * Comet's daily greeting lines — OWNED BY THE NARRATIVE DESIGNER.
 *
 * Index i (0-11) maps 1:1 to `public/audio/comet/greet-0{i+1}.mp3`
 * (e.g. index 0 ↔ greet-01.mp3). When the lines are rewritten, the TTS
 * audio for the same index must be regenerated — the pairing is positional.
 *
 * Tone (2026-10-06): suspense + excitement, movie-trailer narrator energy —
 * adventure-documentary buildup, kid-friendly but thrilling. Voice:
 * `avocado_v2:casper` (confident storyteller). Original voice, NOT a
 * celebrity impression — never claim otherwise in code or UI.
 *
 * Character: Comet is still the playful star-dragon pup, now the excitable
 * co-pilot hyping the mission — tail wagging, nose twitching, countdown
 * energy — instead of the calm bedtime-story narrator.
 */
export const COMET_GREETING_LINES: readonly string[] = [
  "Somewhere on this map, a story is hiding. Today, we hunt it down.",
  "Today, the chart hides a place no explorer has ever guessed right.",
  "Legends say every star on my tail marks a secret the world kept.",
  "Listen close. Somewhere out there, a city is calling your name.",
  "Strap in, explorer. This map is about to blow your mind.",
  "Three guesses. One hidden wonder. A thousand stories. Ready?",
  "I followed a shooting star last night, and it pointed right here.",
  "Big day ahead. The chart is practically buzzing with secrets.",
  "What if I told you... the perfect pin is waiting for you today?",
  "Engines of curiosity, ignite. We launch in three... two... one.",
  "Every legend starts with one brave guess. Make yours count today.",
  "The world left its fingerprints all over this map. Let's track them.",
];

/** The greeting line for a date: day-of-year % 12, using local time. */
export function greetingIndexFor(date: Date = new Date()): number {
  const jan1 = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / 86_400_000);
  return ((dayOfYear % COMET_GREETING_LINES.length) + COMET_GREETING_LINES.length) % COMET_GREETING_LINES.length;
}

/** localStorage key: last local YYYY-MM-DD the greeting was shown. */
export const COMET_GREETING_LAST_DATE_KEY = "meridian.cometGreeting.lastDate";

/** Local YYYY-MM-DD for a date (no UTC shifting). */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Public asset URL for greeting audio index i (0-11). */
export function greetingAudioUrl(index: number): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const withSlash = base.endsWith("/") ? base : `${base}/`;
  return `${withSlash}audio/comet/greet-${String(index + 1).padStart(2, "0")}.mp3`;
}
