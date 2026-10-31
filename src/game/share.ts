import { BRAND } from "./brand.ts";
import { shareOrigin } from "../lib/og/share-meta.ts";
import type { LoopGuess, LoopStatus } from "./loop/types.ts";
import { LOOP_MAX_GUESSES } from "./loop/types.ts";

/**
 * Build base for the share URL line. Vite sets BASE_URL "/Meridian/" only
 * for the GitHub Pages build, so the URL follows the build, not the
 * serving hostname (Wave 1 P0 Item 4E/4F). Node (unit tests) has no
 * import.meta.env, so the default base "/" (Workers origin) applies.
 */
function defaultBaseUrl(): string {
  return (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
}

/**
 * Per-place grade for the share-text emoji strip (Wordle-style).
 * Five tiers matched to the real scoring-v3 range (0–415): few enough to
 * read at a glance, each emoji's meaning obvious from its rank.
 */
export function scoreMark(score: number): string {
  if (score >= 300) return "🎯";
  if (score >= 200) return "🏆";
  if (score >= 120) return "🌟";
  if (score >= 60) return "👏";
  if (score >= 1) return "🙂";
  return "💨";
}

export function shareDateLabel(dateKey: string, now = new Date()): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  const monthName = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
  return now.getUTCFullYear() === year ? `${monthName} ${day}` : `${monthName} ${day}, ${year}`;
}

export function shareText(input: {
  regionName: string;
  dateKey: string;
  totalScore: number;
  placesPlayed: number;
  averagePerPlace: number;
  bestStreak: number;
  /** Per-place scores in play order; renders the Wordle-style emoji strip. */
  scores?: number[];
  now?: Date;
  /** Vite build base; defaults to the running build's BASE_URL. */
  baseUrl?: string;
}): string {
  const when = shareDateLabel(input.dateKey, input.now ?? new Date());
  const streak = input.bestStreak >= 2 ? ` · 🔥 ${input.bestStreak} best streak` : "";
  const strip = input.scores?.length ? input.scores.map(scoreMark).join("") + "\n" : "";
  // The site URL gets its own line: messaging apps auto-linkify bare URLs,
  // so the shared score carries a tappable link back to the game.
  const origin = shareOrigin(input.baseUrl ?? defaultBaseUrl());
  return (
    `${BRAND.shareHost} ${when}\n` +
    `${origin}\n` +
    strip +
    `${input.totalScore.toLocaleString("en-US")} over ${input.placesPlayed} places · ` +
    `${input.averagePerPlace} avg/place${streak} · ${input.regionName}`
  );
}

/**
 * Grade one GeoDetective guess for the share-text strip. The winning guess
 * (the last guess of a won day) is always green, regardless of residual
 * distance; every other guess grades by distance. Spoiler-free: no names,
 * no distances.
 */
function loopGuessMark(guess: LoopGuess, isWinningGuess: boolean): string {
  if (isWinningGuess) return "🟩";
  if (guess.distKm < 500) return "🟨";
  if (guess.distKm < 2000) return "🟧";
  return "🟥";
}

/**
 * GeoDetective share text, in the same three-line shape as shareText:
 *   line 1: "meridian geodetective <date label>"
 *   line 2: the site URL on its own line (auto-linkified by messaging apps)
 *   line 3: the emoji strip (one slot per guess, ⬜ for unused guesses)
 *            plus the result ("solved in N" / "not solved").
 *   line 4 (only when streak > 0): `🔥 N` — the consecutive-solve streak.
 * The best streak rides on line 3 as ` · 🔥 N best streak` (classic
 * convention) whenever bestStreak >= 2.
 * Spoiler-free: no place names, no distances.
 */
export function shareLoopText(input: {
  /** Guesses in play order. */
  guesses: LoopGuess[];
  status: LoopStatus;
  dateKey: string;
  now?: Date;
  /** Consecutive solves. Appended as a `🔥 N` line when > 0; hidden when
   * 0 or unset so a cold or reset streak stays out of the share. */
  streak?: number;
  /** Best consecutive-solve streak. Appended to the result line as
   * ` · 🔥 N best streak` when >= 2 (classic convention); hidden when
   * < 2 or unset. */
  bestStreak?: number;
  /** Vite build base; defaults to the running build's BASE_URL. */
  baseUrl?: string;
}): string {
  const when = shareDateLabel(input.dateKey, input.now ?? new Date());
  const marks = input.guesses.map((guess, i) =>
    loopGuessMark(guess, input.status === "won" && i === input.guesses.length - 1),
  );
  while (marks.length < LOOP_MAX_GUESSES) marks.push("⬜");
  const result = input.status === "won" ? `solved in ${input.guesses.length}` : "not solved";
  const streakLine =
    typeof input.streak === "number" && input.streak > 0 ? `\n🔥 ${input.streak}` : "";
  const bestStreakSegment =
    typeof input.bestStreak === "number" && input.bestStreak >= 2
      ? ` · 🔥 ${input.bestStreak} best streak`
      : "";
  const origin = shareOrigin(input.baseUrl ?? defaultBaseUrl());
  return `${BRAND.shareHost} geodetective ${when}\n${origin}\n${marks.join("")} ${result}${bestStreakSegment}${streakLine}`;
}
