import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ROBBEN_ISLAND_CAPTION,
  ROBBEN_ISLAND_CLIP_ID,
  ROBBEN_ISLAND_FILM,
  clipLeavesComingSoon,
} from "./robben-island-clip.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

function cueTexts(vtt: string): string[] {
  return vtt
    .split(/\r?\n/)
    .filter((line) => line && !/^(WEBVTT|NOTE|\d+$)/.test(line) && !/^\d\d:/.test(line));
}

test("robben island caption matches the vtt cues character for character", () => {
  const docsVtt = readFileSync(
    join(root, "docs/scaling/journals/freedom-fighters/captions/robben-island.vtt"),
    "utf8",
  );
  const publicVtt = readFileSync(
    join(root, "public/videos/journals/freedom-fighters/robben-island.vtt"),
    "utf8",
  );
  assert.equal(cueTexts(docsVtt).join(" "), ROBBEN_ISLAND_CAPTION);
  assert.equal(cueTexts(publicVtt).join(" "), ROBBEN_ISLAND_CAPTION);
});

test("only freedom-fighters:robben-island leaves Coming soon", () => {
  assert.equal(clipLeavesComingSoon(ROBBEN_ISLAND_CLIP_ID), true);
  assert.equal(clipLeavesComingSoon("freedom-fighters:jhansi-fort"), false);
  assert.equal(clipLeavesComingSoon("great-leaders:lincoln-memorial"), false);
});

test("the card reuses CardFilm and keeps the caption visible", () => {
  const src = readFileSync(join(here, "journal-clip-card.tsx"), "utf8");
  assert.match(src, /CardFilm/);
  assert.match(src, /ROBBEN_ISLAND_CAPTION/);
  assert.match(src, /ROBBEN_ISLAND_FILM/);
  assert.match(src, /Coming soon/);
  assert.doesNotMatch(src, /A school|A hotel|drawtext/);
  assert.equal(ROBBEN_ISLAND_FILM.stillUrl, "/images/journals/freedom-fighters/robben-island.webp");
  assert.equal(ROBBEN_ISLAND_FILM.stillUrl, ROBBEN_ISLAND_FILM.posterUrl);
  const still = readFileSync(join(root, "public/images/journals/freedom-fighters/robben-island.webp"));
  assert.ok(still.byteLength > 1000);
});
