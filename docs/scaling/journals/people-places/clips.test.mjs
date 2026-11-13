// Contract check for the people-and-places journal screen.
// Run: node --test docs/scaling/journals/people-places/clips.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { grade } from "./readability.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(here, "clips.json"), "utf8"));
const groups = new Set(["7-10", "10-18", "18+"]);
const bannedYoung = /\b(algebra|trigonometry|tangent|sine|cosine|stadia)\b/i;

test("proposed count stays 5 and every original religion clip is cut", () => {
  assert.equal(data.count, "PROPOSED");
  assert.equal(data.proposedCount, 5);
  assert.equal(data.clips.length, 5);
  const cutIds = data.cuts.map((c) => c.id).sort();
  assert.deepEqual(cutIds, [
    "bodhidharma",
    "maya-culture",
    "shaolin",
    "vivekananda",
    "zeus",
  ]);
  for (const cut of data.cuts) {
    assert.equal(cut.verdict, "CUT");
    assert.match(cut.reason, /§7a|Mythology|religion/);
  }
});

test("each kept clip matches the I5 fields and its caption file", () => {
  const seen = new Set();
  for (const clip of data.clips) {
    assert.match(clip.id, /^people-places:[a-z0-9-]+$/);
    assert.equal(seen.has(clip.id), false);
    seen.add(clip.id);
    assert.equal(groups.has(clip.group), true);
    assert.ok(clip.objective.startsWith("After this,"));
    assert.match(clip.objective, /shown by/);
    assert.ok(clip.why.length > 0);
    assert.ok(["how far", "how many", "where"].includes(clip.opensWith));
    assert.equal(typeof clip.place.lat, "number");
    assert.equal(typeof clip.place.lon, "number");
    assert.ok(clip.place.name.length > 0);
    assert.match(clip.file, /^public\/videos\/journals\/people-places\/.+\.mp4$/);
    assert.ok(clip.retrieval.question.length > 0);
    assert.ok(String(clip.retrieval.answer).length > 0);
    assert.equal(clip.standard === "UNVERIFIED" || /^D2\./.test(clip.standard), true);
    if (clip.group !== "18+") assert.notEqual(clip.standard, "UNVERIFIED");
    const vtt = fs.readFileSync(path.join(here, "captions", clip.captions), "utf8");
    assert.match(vtt, /^WEBVTT/);
    assert.ok(vtt.includes(clip.narration));
    assert.equal(fs.existsSync(path.join(here, "captions", clip.captions.replace(/\.vtt$/, ".txt"))), true);
  }
});

test("7-10 clips do not use algebra, trigonometry, or a formula rate", () => {
  for (const clip of data.clips.filter((c) => c.group === "7-10")) {
    const blob = [clip.narration, clip.predict.prompt, clip.explain, clip.retrieval.question, clip.elsewhere.prompt].join(" ");
    assert.equal(bannedYoung.test(blob), false, clip.id);
    assert.equal(clip.skill === "multiplication" || clip.skill === "division", true);
  }
});

test("the three groups are all present", () => {
  const have = new Set(data.clips.map((c) => c.group));
  for (const g of groups) assert.equal(have.has(g), true);
});

test("child-facing lines sit at or below the band top grade", () => {
  for (const clip of data.clips) {
    const lim = data.maxGrade[clip.group];
    for (const text of [
      clip.narration,
      clip.predict.prompt,
      clip.explain,
      clip.hint,
      clip.retrieval.question,
      clip.elsewhere.prompt,
    ]) {
      assert.ok(grade(text) <= lim, `${clip.id} ${grade(text).toFixed(1)} > ${lim}: ${text}`);
    }
  }
});

test("each kept caption file matches the narration character for character and a still exists", () => {
  for (const clip of data.clips) {
    const txt = fs.readFileSync(path.join(here, "captions", `${clip.clip}.txt`), "utf8").trim();
    assert.equal(txt, clip.narration, clip.clip);
    const still = path.join(here, "..", "..", "..", "..", "public", "images", "journals", "people-places", `${clip.clip}.webp`);
    assert.equal(fs.existsSync(still), true, still);
  }
  for (const cut of data.cuts) {
    const still = path.join(here, "..", "..", "..", "..", "public", "images", "journals", "people-places", `${cut.id}.webp`);
    assert.equal(fs.existsSync(still), false, cut.id);
  }
});

test("worked answers are the sourced arithmetic, not a converted Earth size", () => {
  const byId = Object.fromEntries(data.clips.map((c) => [c.clip, c]));
  assert.equal(byId["akashi-span"].predict.answer, "1920");
  assert.equal(byId["akashi-span"].retrieval.answer, "1991");
  assert.equal(byId["pont-du-gard"].retrieval.answer, "35");
  assert.equal(byId["eratosthenes-earth"].predict.answer, "250000");
  assert.equal(byId["andean-roads"].predict.answer, "300");
  assert.equal(byId["aconcagua-height"].retrieval.answer, "no");
  const earth = byId["eratosthenes-earth"];
  const taught = [earth.narration, earth.predict.prompt, earth.explain, earth.hint, earth.retrieval.question, earth.elsewhere.prompt].join(" ");
  assert.equal(/40,?000/.test(taught), false);
});
