/**
 * Storyteller mascot — narration lines + pure helpers.
 *
 * FINAL COPY (spoken form — regenerate the mp3s if these change; the
 * pairing is positional, mirroring comet-greetings.ts).
 *
 * Voice: `avocado_v2:TruthTeller` ("Wise Lighthouse" — M, Old).
 * Audio lives at `public/audio/storyteller/*.mp3`, generated at build time
 * with the TTS CLI. No runtime synthesis, ever.
 */

export interface StorytellerLine {
  /** Exact caption text shown in the caption card. */
  text: string;
  /** Build-time mp3 filename under public/audio/storyteller/. */
  audioFile: string;
}

export const STORYTELLER_LINES: Record<"reveal" | "hook" | "summary", StorytellerLine> = {
  reveal: {
    text: "Shh… listen closely. Every place has a story, and this one is a very good one.",
    audioFile: "reveal-01.mp3",
  },
  hook: {
    text: "Psst… the fourth clue. This is the one that changes everything. Lean in close…",
    audioFile: "hook-01.mp3",
  },
  summary: {
    text: "And so our tale comes to an end! You found five hidden places today — what an adventure!",
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

/**
 * First story reveal per session auto-narrates (T1); later reveals are
 * text + speaker button. Module-level flag: the SPA session is the unit,
 * a reload is a new session. `claimFirstRevealNarration` returns true only
 * for the first caller of the session.
 */
let firstRevealClaimed = false;

export function claimFirstRevealNarration(): boolean {
  if (firstRevealClaimed) return false;
  firstRevealClaimed = true;
  return true;
}

/** Test-only: drop the session flag. */
export function resetFirstRevealNarrationForTests(): void {
  firstRevealClaimed = false;
}
