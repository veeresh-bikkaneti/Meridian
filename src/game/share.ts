import { BRAND } from "./brand.ts";

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
}): string {
  const when = shareDateLabel(input.dateKey, input.now ?? new Date());
  const streak = input.bestStreak >= 2 ? ` · 🔥 ${input.bestStreak} best streak` : "";
  const strip = input.scores?.length ? input.scores.map(scoreMark).join("") + "\n" : "";
  // The site URL gets its own line: messaging apps auto-linkify bare URLs,
  // so the shared score carries a tappable link back to the game.
  return (
    `${BRAND.shareHost} ${when}\n` +
    `${BRAND.siteUrl}\n` +
    strip +
    `${input.totalScore.toLocaleString("en-US")} over ${input.placesPlayed} places · ` +
    `${input.averagePerPlace} avg/place${streak} · ${input.regionName}`
  );
}
