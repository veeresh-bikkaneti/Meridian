import type { Edition, Guess } from "./types.ts";

function mark(score: number): string {
  if (score >= 80) return "#";
  if (score >= 50) return "=";
  if (score >= 20) return "-";
  if (score > 0) return ".";
  return " ";
}

export function shareText(input: {
  edition: Edition;
  dateKey: string;
  guesses: (Guess | null)[];
}): string {
  const total = input.guesses.reduce((sum, guess) => sum + (guess?.score ?? 0), 0);
  const row = input.guesses.map((guess) => mark(guess?.score ?? 0)).join("");
  const label = input.edition === "world" ? "World" : "Home Turf";
  return `Waymark · ${label} · ${input.dateKey}\n[${row}] ${total}/500`;
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
  ctx.fillStyle = "#101211";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#2a3330";
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, width - 72, height - 72);
  ctx.fillStyle = "#d7ddd9";
  ctx.font = "500 28px Georgia, serif";
  ctx.fillText("WAYMARK", 88, 140);
  ctx.fillStyle = "#8b9691";
  ctx.font = "400 22px Georgia, serif";
  const label = input.edition === "world" ? "World" : "Home Turf";
  ctx.fillText(`${label}  ·  ${input.dateKey}`, 88, 184);
  const total = input.guesses.reduce((sum, guess) => sum + (guess?.score ?? 0), 0);
  input.guesses.forEach((guess, index) => {
    const x = 88 + index * 150;
    const score = guess?.score ?? 0;
    ctx.fillStyle = "#1a221f";
    ctx.fillRect(x, 250, 120, 120);
    ctx.fillStyle = "#f4f1ea";
    ctx.font = "500 42px ui-monospace, monospace";
    ctx.fillText(String(score).padStart(2, " "), x + 28, 324);
  });
  ctx.font = "500 64px Georgia, serif";
  ctx.fillText(`${total}`, 88, 500);
  const totalWidth = ctx.measureText(String(total)).width;
  ctx.font = "400 28px Georgia, serif";
  ctx.fillStyle = "#8b9691";
  ctx.fillText("/ 500", 88 + totalWidth + 18, 500);
  ctx.font = "400 20px Georgia, serif";
  ctx.fillText("No place names. Same puzzle for everyone.", 88, 548);
}
