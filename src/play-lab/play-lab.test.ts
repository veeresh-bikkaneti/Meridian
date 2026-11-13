import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  filterByAgeGroup,
  getAllItems,
  getAllJournalClips,
  getItemById,
  getItemsForSubject,
  getJournalClipById,
  getJournalClipsForAgeGroup,
  parseBridgeLinks,
} from "./data.ts";

import {
  checkAnswer,
  getCurrentYear,
  getInteractiveSpec,
  isInteractiveItem,
  INTERACTIVE_ITEM_IDS,
} from "./interactions.ts";
import { getJournalFilm, JOURNAL_FILMS, MODERN_WORLD_FILM_IDS } from "./journal-films.ts";

import { getSystemMotionTier } from "./motion.ts";

test("age-group filtering respects 7-10, 10-18, and 18+ tiers", () => {
  const allItems = getAllItems();
  assert.ok(allItems.length > 100, "Must load all scale curriculum items");

  // 7-10: only 7-10 items
  const items710 = filterByAgeGroup(allItems, "7-10");
  assert.ok(items710.length > 0, "Must have 7-10 items");
  assert.ok(
    items710.every((item) => item.group === "7-10"),
    "7-10 filter must include only 7-10 items",
  );

  // 10-18: includes 7-10 and 10-18
  const items1018 = filterByAgeGroup(allItems, "10-18");
  assert.ok(items1018.length >= items710.length, "10-18 should include 7-10 items as well");
  assert.ok(
    items1018.every((item) => item.group === "7-10" || item.group === "10-18"),
    "10-18 filter must not include 18+ items",
  );

  // 18+: includes all items
  const items18Plus = filterByAgeGroup(allItems, "18+");
  assert.equal(items18Plus.length, allItems.length, "18+ has access to all items");
});

test("subject items and journal clips filter properly by age band", () => {
  const math710 = getItemsForSubject("math", "7-10");
  assert.ok(math710.length > 0, "Must find math items for 7-10");
  assert.ok(math710.every((item) => item.subjectId === "math" && item.group === "7-10"));

  const journals710 = getJournalClipsForAgeGroup("7-10");
  assert.ok(journals710.length > 0, "Must have journal clips for 7-10");
  assert.ok(journals710.every((clip) => clip.group === "7-10"));
  assert.ok(
    journals710.some((clip) => clip.id === "great-leaders:lincoln-memorial"),
    "Lincoln Memorial clip must be accessible in 7-10",
  );
});

function narrationFromVtt(path: string): string {
  const cues: string[] = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "WEBVTT" || trimmed.includes("-->") || trimmed.startsWith("NOTE")) {
      continue;
    }
    cues.push(trimmed);
  }
  return cues.join(" ");
}

test("exactly 9 interactive items are registered", () => {
  assert.equal(INTERACTIVE_ITEM_IDS.length, 9);
  assert.ok(isInteractiveItem("math-number:groups:skip-count"));
  assert.ok(isInteractiveItem("physics:arrive:equal-steps"));
  assert.ok(isInteractiveItem("chemistry:states:solid-liquid"));
  assert.ok(isInteractiveItem("social-studies:route:trip-clock"));
  assert.ok(isInteractiveItem("general-knowledge:mixed:opera-years-ago"));
  assert.ok(isInteractiveItem("great-leaders:lincoln-memorial"));
  for (const id of MODERN_WORLD_FILM_IDS) {
    assert.ok(isInteractiveItem(id));
    assert.equal(getInteractiveSpec(id), null, `${id} has no quiz choices`);
  }
});

test("modern-world captions match narration character for character", () => {
  const slug: Record<(typeof MODERN_WORLD_FILM_IDS)[number], string> = {
    "modern-world:greenwich-zero": "greenwich-zero",
    "modern-world:liverpool-manchester": "liverpool-manchester",
    "modern-world:hearts-content-cable": "hearts-content-cable",
  };
  for (const id of MODERN_WORLD_FILM_IDS) {
    const film = getJournalFilm(id);
    assert.ok(film);
    assert.equal(film, JOURNAL_FILMS[id]);
    const fromVtt = narrationFromVtt(
      `docs/scaling/journals/modern-world/${slug[id]}.vtt`,
    );
    assert.equal(film.narration, fromVtt);
  }
});

test("math skip-count answer check verifies 40 and rejects distractors", () => {
  const id = "math-number:groups:skip-count";
  const pass = checkAnswer(id, 40);
  assert.equal(pass.correct, true);
  assert.ok(pass.reason.includes("40 coins"));

  const fail1 = checkAnswer(id, 38);
  assert.equal(fail1.correct, false);

  const fail2 = checkAnswer(id, 45);
  assert.equal(fail2.correct, false);
});

test("physics carts answer check verifies Cart A (3 tiles/step) and rejects Cart B", () => {
  const id = "physics:arrive:equal-steps";
  const pass = checkAnswer(id, "cart-a");
  assert.equal(pass.correct, true);
  assert.ok(pass.reason.includes("Cart A moves 3 tiles"));

  const fail = checkAnswer(id, "cart-b");
  assert.equal(fail.correct, false);
});

test("chemistry solid-liquid answer check verifies liquid water and rejects solid ice", () => {
  const id = "chemistry:states:solid-liquid";
  const pass = checkAnswer(id, "liquid");
  assert.equal(pass.correct, true);
  assert.ok(pass.reason.includes("melts solid ice into liquid water"));

  const fail = checkAnswer(id, "solid");
  assert.equal(fail.correct, false);
});

test("social studies trip-clock answer check verifies 3 hours and rejects 2 or 4", () => {
  const id = "social-studies:route:trip-clock";
  const pass = checkAnswer(id, 3);
  assert.equal(pass.correct, true);
  assert.ok(pass.reason.includes("3 hours"));

  const fail1 = checkAnswer(id, 2);
  assert.equal(fail1.correct, false);

  const fail2 = checkAnswer(id, 4);
  assert.equal(fail2.correct, false);
});

test("general knowledge opera house dynamically computes currentYear - 1973", () => {
  const id = "general-knowledge:mixed:opera-years-ago";
  const currentYear = getCurrentYear();
  assert.equal(typeof currentYear, "number");
  assert.ok(currentYear >= 2026, "Current year must be >= 2026");

  const expectedYearsAgo = currentYear - 1973;
  const spec = getInteractiveSpec(id);
  assert.ok(spec !== null);
  assert.equal(spec.correctValue, expectedYearsAgo);

  const pass = checkAnswer(id, expectedYearsAgo);
  assert.equal(pass.correct, true);
  assert.ok(pass.reason.includes(`${expectedYearsAgo} years ago`));

  const fail = checkAnswer(id, expectedYearsAgo - 10);
  assert.equal(fail.correct, false);
});

test("journal Lincoln Memorial two-step interaction checks construction years and seated statue", () => {
  const id = "great-leaders:lincoln-memorial";

  // Step 1: 1922 - 1914 = 8 years
  const step1Pass = checkAnswer(id, 8, 1);
  assert.equal(step1Pass.correct, true);
  assert.ok(step1Pass.reason.includes("8 years"));

  const step1Fail = checkAnswer(id, 6, 1);
  assert.equal(step1Fail.correct, false);

  // Step 2: statue sits vs stands
  const step2Pass = checkAnswer(id, "sits", 2);
  assert.equal(step2Pass.correct, true);
  assert.ok(step2Pass.reason.includes("Lincoln sits"));

  const step2Fail = checkAnswer(id, "stands", 2);
  assert.equal(step2Fail.correct, false);
});

test("useElsewhere bridge parsing produces valid cross-disciplinary links", () => {
  const mathItem = getItemById("math-number:groups:skip-count");
  assert.ok(mathItem !== null && mathItem !== undefined);
  const mathLinks = parseBridgeLinks(mathItem);
  assert.ok(mathLinks.length > 0);
  assert.equal(mathLinks[0].fromSubject, "math");
  assert.ok(mathLinks[0].toSubject.toLowerCase().includes("economics"));

  const physicsItem = getItemById("physics:arrive:equal-steps");
  assert.ok(physicsItem !== null && physicsItem !== undefined);
  const physicsLinks = parseBridgeLinks(physicsItem);
  assert.ok(physicsLinks.length > 0);
  assert.equal(physicsLinks[0].fromSubject, "physics");
  assert.ok(physicsLinks[0].toSubject.toLowerCase().includes("geography"));

  const socialItem = getItemById("social-studies:route:trip-clock");
  assert.ok(socialItem !== null && socialItem !== undefined);
  const socialLinks = parseBridgeLinks(socialItem);
  assert.ok(socialLinks.length >= 2);
  assert.ok(socialLinks.some((l) => l.toSubject.toLowerCase().includes("math")));
  assert.ok(socialLinks.some((l) => l.toSubject.toLowerCase().includes("physics")));

  const lincolnClip = getJournalClipById("great-leaders:lincoln-memorial");
  assert.ok(lincolnClip !== null && lincolnClip !== undefined);
  const lincolnLinks = parseBridgeLinks(lincolnClip);
  assert.ok(lincolnLinks.length > 0);
  assert.ok(lincolnLinks.some((l) => l.toSubject.toLowerCase().includes("math")));
});

test("motion-tier selection respects reduced motion and hardware constraints", () => {
  // In node environment without window, getSystemMotionTier returns flat
  const tier = getSystemMotionTier();
  assert.equal(tier, "flat");
});

