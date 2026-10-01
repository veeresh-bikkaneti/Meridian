import { BRAND } from "./brand.ts";

/** Grades in the same spirit as a MapTap share line: 86🎓 80👏 93🏆 82🌟 79👏 */
export function scoreMark(score: number): string {
  if (score >= 100) return "🎯";
  if (score >= 90) return "🏆";
  if (score >= 85) return "🎓";
  if (score >= 82) return "🌟";
  if (score >= 70) return "👏";
  if (score >= 55) return "🙂";
  if (score >= 40) return "🧭";
  if (score >= 25) return "😬";
  if (score >= 10) return "🌫️";
  if (score >= 1) return "💨";
  return "·";
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
  now?: Date;
}): string {
  const when = shareDateLabel(input.dateKey, input.now ?? new Date());
  const streak = input.bestStreak >= 2 ? ` · 🔥${input.bestStreak} best streak` : "";
  // The site URL gets its own line: messaging apps auto-linkify bare URLs,
  // so the shared score carries a tappable link back to the game.
  return (
    `${BRAND.shareHost} ${when}\n` +
    `${BRAND.siteUrl}\n` +
    `${input.totalScore.toLocaleString("en-US")} over ${input.placesPlayed} places · ` +
    `${input.averagePerPlace} avg/place${streak} · ${input.regionName}`
  );
}
