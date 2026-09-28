import { ROUND_WEIGHTS, totalFromGuesses } from "./score.ts";
import type { Edition, Guess } from "./types.ts";

export function scoreMark(score: number): string {
  if (score >= 100) return "🎯";
  if (score >= 95) return "🔥";
  if (score >= 90) return "🏆";
  if (score >= 85) return "🌟";
  if (score >= 80) return "✨";
  if (score >= 70) return "🙂";
  if (score >= 55) return "🤨";
  if (score >= 40) return "😬";
  if (score >= 25) return "🧭";
  if (score >= 10) return "🌫️";
  if (score >= 1) return "💨";
  return "·";
}

export function shareText(input: {
  edition: Edition;
  dateKey: string;
  guesses: (Guess | null)[];
}): string {
  const scores = input.guesses.map((guess) => guess?.score ?? 0);
  const distances = input.guesses.map((guess) => guess?.distanceScore ?? guess?.score ?? 0);
  const weights = input.guesses.map((guess, index) => guess?.weight ?? ROUND_WEIGHTS[index] ?? 1);
  const parts = scores.map((score, index) => score * weights[index]);
  const total = totalFromGuesses(input.guesses);
  const label = input.edition === "world" ? "World" : "Home Turf";
  const lines = [
    `Waymark · ${label} · ${input.dateKey}`,
    scores.map((score) => `${score}${scoreMark(score)}`).join(" "),
    weights.map((weight) => `×${weight}`).join(" "),
    parts.join(" + "),
  ];
  if (scores.some((score, index) => score !== distances[index])) {
    lines.push(`Before lift: ${distances.join(" ")}`);
  }
  lines.push(`Final score: ${total} / 1000`);
  return lines.join("\n");
}

export function drawShareCard(
  canvas: HTMLCanvasElement,
  input: { edition: Edition; dateKey: string; guesses: (Guess | null)[] },
) {
  const width = 1200;
  const height = 630;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const scores = input.guesses.map((guess) => guess?.score ?? 0);
  const distances = input.guesses.map((guess) => guess?.distanceScore ?? guess?.score ?? 0);
  const weights = input.guesses.map((guess, index) => guess?.weight ?? ROUND_WEIGHTS[index] ?? 1);
  const parts = scores.map((score, index) => score * weights[index]);
  const total = parts.reduce((sum, part) => sum + part, 0);
  const lifted = scores.some((score, index) => score !== distances[index]);

  ctx.fillStyle = "#101211";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#2a3330";
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, width - 72, height - 72);

  ctx.fillStyle = "#d7ddd9";
  ctx.font = "500 28px Georgia, serif";
  ctx.fillText("WAYMARK", 80, 112);
  ctx.fillStyle = "#8b9691";
  ctx.font = "400 22px Georgia, serif";
  const label = input.edition === "world" ? "World" : "Home Turf";
  ctx.fillText(`${label}  ·  ${input.dateKey}`, 80, 150);

  const cellW = 196;
  const gap = 16;
  const startX = 72;
  scores.forEach((score, index) => {
    const x = startX + index * (cellW + gap);
    ctx.fillStyle = "#1a221f";
    ctx.fillRect(x, 188, cellW, lifted ? 236 : 200);
    ctx.fillStyle = "#f4f1ea";
    ctx.font = "500 52px Georgia, serif";
    const scoreText = String(score);
    const scoreWidth = ctx.measureText(scoreText).width;
    ctx.fillText(scoreText, x + (cellW - scoreWidth) / 2, 258);
    ctx.font = "34px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
    const mark = scoreMark(score);
    const markWidth = ctx.measureText(mark).width;
    ctx.fillText(mark, x + (cellW - markWidth) / 2, 308);
    ctx.fillStyle = "#8b9691";
    ctx.font = "400 20px Georgia, serif";
    const weightText = `×${weights[index]}   ${parts[index]}`;
    const weightWidth = ctx.measureText(weightText).width;
    ctx.fillText(weightText, x + (cellW - weightWidth) / 2, 352);
    if (lifted) {
      ctx.font = "400 16px Georgia, serif";
      const liftText = distances[index] === score ? "distance" : `${distances[index]} → ${score}`;
      const liftWidth = ctx.measureText(liftText).width;
      ctx.fillText(liftText, x + (cellW - liftWidth) / 2, 392);
    }
  });

  const totalText = String(total);
  ctx.fillStyle = "#f4f1ea";
  ctx.font = "500 64px Georgia, serif";
  ctx.fillText(totalText, 80, 530);
  const totalWidth = ctx.measureText(totalText).width;
  ctx.font = "400 28px Georgia, serif";
  ctx.fillStyle = "#8b9691";
  ctx.fillText("/ 1000", 80 + totalWidth + 16, 530);
  ctx.font = "400 18px Georgia, serif";
  ctx.fillText("Scores, weights, and lifts only. No place names.", 80, 572);
}
