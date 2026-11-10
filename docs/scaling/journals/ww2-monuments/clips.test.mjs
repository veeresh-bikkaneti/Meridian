// Checks docs/scaling/journals/ww2-monuments/clips.json against contract I5
// (docs/scaling/contracts.md). Run:
// node --test docs/scaling/journals/ww2-monuments/clips.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const clips = JSON.parse(fs.readFileSync(path.join(here, "clips.json"), "utf8"));
const KEYS = ["captions", "file", "group", "id", "objective", "place", "retrieval", "standard", "stretch", "why"];
const STRETCH_KEYS = ["answer", "fact", "group", "question"];
const PLACE_KEYS = ["lat", "lon", "name"];
const BANNED = /\b(cross|crosses|chapel|shrine|sacred|prayer|god|battle|landing|landings|explosion|bomb|torpedo|gun|attack|killed|dead|death|blood|president|congress|nazi|hitler|eisenhower|victory|defeat|d-day|dday)\b/i;

function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 1;
  const groups = w.match(/[aeiouy]+/g);
  let n = groups ? groups.length : 1;
  if (w.endsWith("e") && n > 1) n -= 1;
  return Math.max(1, n);
}

function grade(text) {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const words = text.match(/[A-Za-z0-9']+/g) ?? [];
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  if (!sentences.length || !words.length) return 0;
  return 0.39 * (words.length / sentences.length) + 11.8 * (syl / words.length) - 15.59;
}

test("two proposed clips match contract I5", () => {
  assert.equal(clips.length, 2);
  for (const clip of clips) {
    assert.deepEqual(Object.keys(clip).sort(), KEYS, clip.id);
    assert.deepEqual(Object.keys(clip.place).sort(), PLACE_KEYS, clip.id);
    assert.deepEqual(Object.keys(clip.retrieval).sort(), ["answer", "question"]);
    assert.deepEqual(Object.keys(clip.stretch).sort(), STRETCH_KEYS, clip.id);
    assert.equal(clip.stretch.group, "18+");
    const sources = fs.readFileSync(path.join(here, "sources.md"), "utf8");
    assert.ok(sources.includes(clip.stretch.fact), clip.stretch.fact);
    assert.equal(typeof clip.place.lat, "number");
    assert.equal(typeof clip.place.lon, "number");
    assert.ok(clip.place.lat >= -90 && clip.place.lat <= 90, clip.id);
    assert.ok(clip.place.lon >= -180 && clip.place.lon <= 180, clip.id);
    assert.match(clip.id, /^ww2-monuments:[a-z0-9-]+$/);
    assert.match(clip.file, /^public\/videos\/journals\/ww2-monuments\/[a-z0-9-]+\.mp4$/);
    assert.ok(fs.existsSync(path.join(here, clip.captions)), clip.captions);
    const vtt = fs.readFileSync(path.join(here, clip.captions), "utf8");
    assert.ok(vtt.startsWith("WEBVTT"), clip.captions);
    const spoken = [
      clip.why, clip.objective, clip.retrieval.question, clip.retrieval.answer,
      clip.stretch.question, clip.stretch.answer, vtt,
    ].join("\n");
    assert.equal(BANNED.test(spoken), false, `${clip.id} failed the content screen`);
  }
});

test("groups, codes, and answers stay inside the rules", () => {
  const byId = Object.fromEntries(clips.map((c) => [c.id, c]));
  const normandy = byId["ww2-monuments:normandy-where"];
  const arizona = byId["ww2-monuments:arizona-how-far"];
  assert.equal(normandy.group, "7-10");
  assert.equal(arizona.group, "10-18");
  assert.equal(normandy.standard, "D2.Geo.1.3-5");
  assert.equal(arizona.standard, "D2.Geo.1.6-8");
  assert.equal(normandy.retrieval.answer, "labeledYear - 1956");
  assert.equal(arizona.retrieval.answer, "18 steps, with 4 feet left");
  assert.equal(184, 18 * 10 + 4);
  assert.equal(184, 23 * 8);
  assert.doesNotMatch(JSON.stringify(clips), /9389|9,389|1,102|1,177|1102|1177/);
  const young = fs.readFileSync(path.join(here, normandy.captions), "utf8");
  assert.ok(grade(young) <= 5.5, `7-10 captions grade ${grade(young)}`);
  const older = fs.readFileSync(path.join(here, arizona.captions), "utf8");
  assert.ok(grade(older) <= 8, `10-18 captions grade ${grade(older)}`);
});

test("stage B media is not in this folder", () => {
  const names = fs.readdirSync(here);
  assert.equal(names.some((n) => n.endsWith(".mp4")), false);
  assert.equal(names.includes("manifest.json"), false);
});
