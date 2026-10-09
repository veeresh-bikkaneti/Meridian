/**
 * Storyteller mascot — narration lines + pure helpers.
 *
 * FINAL COPY (spoken form — regenerate the mp3s if these change; the
 * pairing is positional, mirroring comet-greetings.ts).
 *
 * Voice: `am_fenrir` (Kokoro-82M, en-us male) @ speed 1.05 — the game
 * designer's 2026-10-08 pick (trailer energy; retires the old cloud `tts`
 * CLI path per the standing no-cloud/no-key/no-spend rules).
 * Audio lives at `public/audio/storyteller/*.mp3`. No runtime synthesis, ever.
 *
 * REGENERATION (exact, reproducible — closes the caption==audio drift risk):
 *   node scripts/render-storyteller-voice.mjs [--out <dir>]
 * The script refuses to render unless its lines match the `text` fields
 * below character-for-character, renders with local Kokoro-82M q8
 * (offline/$0/keyless via the aidemo-pilot engine checkout, network
 * disabled), then masters the set: edge silence trimmed to ≤150 ms,
 * ebur128-measured gain to −16 LUFS integrated, 4x-oversampled true-peak
 * limiting at −1.5 dBTP, 24 kHz mono MP3.
 * Env: AIDEMO_ENGINE_DIR (default ~/workspace/aidemo-pilot/engine).
 */

export interface StorytellerLine {
  /** Exact caption text shown in the caption card. */
  text: string;
  /** Build-time mp3 filename under public/audio/storyteller/. */
  audioFile: string;
}

/** Which narration line a host wants — resolved inside the lazy chunk. */
export type StorytellerLineKey = "reveal" | "hook" | "summary";

export const STORYTELLER_LINES: Record<StorytellerLineKey, StorytellerLine> = {
  reveal: {
    text: "Gather round, explorer! Every place hides a story. And this one? This one is a legend.",
    audioFile: "reveal-01.mp3",
  },
  hook: {
    text: "Clue four! The Hook! This is the one that changes everything. Lean in… here it comes!",
    audioFile: "hook-01.mp3",
  },
  summary: {
    text: "And so the tale ends! What. An. Adventure!",
    audioFile: "summary-01.mp3",
  },
};

/** Text-only fallback line shown when audio fails — never device-shames. */
export const STORYTELLER_AUDIO_FALLBACK_LINE =
  "The words are right here — read along with me.";

/** Safe import.meta.env read (undefined under node --test — same seam as pwa.ts's viteEnv). */
function assetBase(): string {
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
  const base = env?.BASE_URL ?? "/";
  return base.endsWith("/") ? base : `${base}/`;
}

/** Public asset URL for a storyteller mp3 (same pattern as comet's greetingAudioUrl). */
export function storytellerAudioUrl(audioFile: string): string {
  return `${assetBase()}audio/storyteller/${audioFile}`;
}

/** Public asset URL for the storyteller figure (interim: circular-masked JPEG). */
export function storytellerFigureUrl(): string {
  return `${assetBase()}images/storyteller/storyteller.jpg`;
}

/**
 * Milliseconds per word when syncing the caption's word-by-word highlight
 * to a narration clip. Mirrors comet-greeting's duration ÷ word count.
 * A non-finite/zero duration falls back to the fixed per-word cadence.
 */
export function wordMsFromDuration(
  durationMs: number,
  wordCount: number,
  fallbackMs: number,
): number {
  if (wordCount <= 0) return fallbackMs;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return fallbackMs;
  return durationMs / wordCount;
}
