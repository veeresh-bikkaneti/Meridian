import { BRAND } from "./brand.ts";
import { totalFromGuesses } from "./score.ts";
import type { Edition, Guess } from "./types.ts";

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
  return now.getFullYear() === year ? `${monthName} ${day}` : `${monthName} ${day}, ${year}`;
}

export function shareText(input: {
  edition: Edition;
  dateKey: string;
  guesses: (Guess | null)[];
  now?: Date;
}): string {
  const scores = input.guesses.map((guess) => guess?.score ?? 0);
  const total = totalFromGuesses(input.guesses);
  const when = shareDateLabel(input.dateKey, input.now ?? new Date());
  const head = input.edition === "world" ? `${BRAND.shareHost} ${when}` : `${BRAND.shareHost} · Home · ${when}`;
  return [head, scores.map((score) => `${score}${scoreMark(score)}`).join(" "), `Final score: ${total}`].join("\n");
}

export function drawShareCard(
  canvas: HTMLCanvasElement,
  input: { edition: Edition; dateKey: string; guesses: (Guess | null)[]; now?: Date },
) {
  const width = 1200;
  const height = 630;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const scores = input.guesses.map((guess) => guess?.score ?? 0);
  const total = totalFromGuesses(input.guesses);
  const when = shareDateLabel(input.dateKey, input.now ?? new Date());
  const edition = input.edition === "world" ? "World" : "Home";

  ctx.fillStyle = "#101211";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#2a3330";
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, width - 72, height - 72);

  ctx.fillStyle = "#d7ddd9";
  ctx.font = "500 28px Georgia, serif";
  ctx.fillText(BRAND.name.toUpperCase(), 80, 120);
  ctx.fillStyle = "#8b9691";
  ctx.font = "400 24px Georgia, serif";
  ctx.fillText(`${edition}  ·  ${when}`, 80, 164);

  const cellW = 196;
  const gap = 16;
  const startX = 72;
  scores.forEach((score, index) => {
    const x = startX + index * (cellW + gap);
    ctx.fillStyle = "#1a221f";
    ctx.fillRect(x, 214, cellW, 210);
    ctx.fillStyle = "#f4f1ea";
    ctx.font = "500 64px Georgia, serif";
    const scoreText = String(score);
    const scoreWidth = ctx.measureText(scoreText).width;
    ctx.fillText(scoreText, x + (cellW - scoreWidth) / 2, 310);
    ctx.font = "42px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
    const mark = scoreMark(score);
    const markWidth = ctx.measureText(mark).width;
    ctx.fillText(mark, x + (cellW - markWidth) / 2, 372);
  });

  const totalText = String(total);
  ctx.fillStyle = "#f4f1ea";
  ctx.font = "500 72px Georgia, serif";
  ctx.fillText(totalText, 80, 530);
  const totalWidth = ctx.measureText(totalText).width;
  ctx.font = "400 28px Georgia, serif";
  ctx.fillStyle = "#8b9691";
  ctx.fillText("final score", 80 + totalWidth + 18, 530);
  ctx.font = "400 18px Georgia, serif";
  ctx.fillText("Five rounds. No place names.", 80, 572);
}
