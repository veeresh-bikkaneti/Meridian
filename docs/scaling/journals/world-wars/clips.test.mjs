// Contract check for the world-wars journal screen.
// Run: node --test docs/scaling/journals/world-wars/clips.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { grade } from "./readability.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(here, "clips.json"), "utf8"));
const groups = new Set(["7-10", "10-18", "18+"]);
const bannedYoung = /\b(algebra|trigonometry|tangent|sine|cosine)\b/i;
const bannedScreen = /\b(christmas|carol|hymn|pope|nazi|hitler|enemy|bomb|gun|pied|god|church)\b/i;

const childText = (clip) =>
  [
    clip.narration,
    clip.why,
    clip.predict.prompt,
    clip.explain,
    clip.hint,
    clip.retrieval.question,
    clip.elsewhere.prompt,
  ].join(" ");

test("proposed count stays 2 and both screened drafts are cut", () => {
  assert.equal(data.count, "PROPOSED");
  assert.equal(data.proposedCount, 2);
  assert.equal(data.clips.length, 2);
  assert.equal(data.buildGate, "closed");
  const cutIds = data.cuts.map((c) => c.id).sort();
  assert.deepEqual(cutIds, ["christmas-truce", "letters-home"]);
  for (const cut of data.cuts) {
    assert.equal(cut.verdict, "CUT");
    assert.match(cut.reason, /§7a|no-invented-facts/);
  }
});

test("each kept clip matches the I5 fields and its caption file", () => {
  const seen = new Set();
  for (const clip of data.clips) {
    assert.match(clip.id, /^world-wars:[a-z0-9-]+$/);
    assert.equal(seen.has(clip.id), false);
    seen.add(clip.id);
    assert.equal(groups.has(clip.group), true);
    assert.ok(clip.objective.startsWith("After this,"));
    assert.match(clip.objective, /shown by/);
    assert.ok(clip.why.length > 0);
    assert.equal(clip.opensWith, "how many years ago");
    assert.equal(typeof clip.place.lat, "number");
    assert.equal(typeof clip.place.lon, "number");
    assert.ok(clip.place.name.length > 0);
    assert.match(clip.file, /^public\/videos\/journals\/world-wars\/.+\.mp4$/);
    assert.equal(clip.standard === "UNVERIFIED" || /^D2\.His\./.test(clip.standard), true);
    assert.ok(clip.retrieval.question.length > 0);
    assert.ok(String(clip.retrieval.answer).length > 0);
    const vtt = fs.readFileSync(path.join(here, "captions", clip.captions), "utf8");
    assert.match(vtt, /^WEBVTT/);
    assert.ok(vtt.includes(clip.narration));
    const txt = fs.readFileSync(path.join(here, "captions", clip.captions.replace(/\.vtt$/, ".txt")), "utf8");
    assert.ok(txt.includes(clip.narration));
    assert.match(clip.narration, /^Hey kids, have you heard about this place\?/);
  }
});

test("7-10 has no algebra or trigonometry, and child lines skip the screen list", () => {
  for (const clip of data.clips) {
    assert.equal(bannedScreen.test(childText(clip)), false, clip.id);
  }
  for (const clip of data.clips.filter((c) => c.group === "7-10")) {
    assert.equal(bannedYoung.test(childText(clip)), false, clip.id);
    assert.equal(clip.skill, "subtraction");
  }
});

test("worked answers are the sourced arithmetic", () => {
  const byId = Object.fromEntries(data.clips.map((c) => [c.clip, c]));
  assert.equal(byId["school-morning"].predict.answer, "87");
  assert.equal(byId["school-morning"].retrieval.answer, "1939");
  assert.equal(byId["school-morning"].elsewhere.answer, "26");
  assert.equal(byId["quiet-hour"].predict.answer, "21");
  assert.equal(byId["quiet-hour"].retrieval.answer, "11");
  assert.equal(byId["quiet-hour"].elsewhere.answer, "20");
  assert.equal(byId["quiet-hour"].adult.answer, "none");
  assert.equal(byId["quiet-hour"].adult.standard, "UNVERIFIED");
  const taught = childText(byId["school-morning"]) + " " + childText(byId["quiet-hour"]);
  assert.equal(/1\.5 million|800,000|3 million/.test(taught), false);
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
  const adult = data.clips.find((c) => c.adult);
  assert.ok(grade(adult.adult.prompt) <= data.maxGrade["18+"]);
});
