import type { AgeBandId } from "../age-profile/types.ts";
import type { ColdTrailVerdict } from "./engine.ts";
import type { ColdTrailSighting } from "./types.ts";

/**
 * Cold Trail band themes (WI-13). Pure data + pure functions — no React,
 * no storage, no DOM. Every string here traces to an ID approved by the
 * Child Safety gate (personas/child-safety.md): 51 approved as written in
 * PO §6 / ADR-13, the 3 APPROVED-WITH-EDIT strings and the 12 REJECTED
 * strings use the gate's verbatim replacement text. S9 (fail-closed copy)
 * is deliberately NOT a theme field — it stays hard-coded in TrailScreen.
 */

export interface VerdictText {
  title: string;
  line: string;
}

export interface ColdTrailTheme {
  id: string;
  band: AgeBandId;
  subject: string;
  /** S1 */
  eyebrow: string;
  /** S1 */
  heading: (caseNo: number) => string;
  /** S2 */
  intro: string;
  /** S3 */
  sightingEyebrow: (n: number, timestamp: string) => string;
  /** S4, composed from radiusKm/octant/cityName (never sighting.text). */
  sightingSentence: (s: ColdTrailSighting) => string;
  /** S5 */
  helper: {
    button: string;
    ariaAffordable: string;
    ariaUnavailable: (cost: number, stars: number) => string;
    hint: string;
    suffix: string;
  };
  /** S6 (+ transient hints). legendRing/legendDraft are the fragments that
   * follow the rendered "gold ring =" / "dashed ring =" spans, so the
   * composed legend reads exactly as the gate approved it. */
  map: {
    ariaLabel: string;
    statusDone: string;
    statusReadyCross: string;
    statusReadyNoCross: string;
    legendRing: string;
    legendDraft: string;
    legendNoCross: string;
    legendCross: string;
    hintAllCross: string;
    hintAllNoCross: string;
  };
  /** S7 */
  confirm: {
    ariaLabel: string;
    eyebrow: string;
    heading: string;
    body: string;
    button: string;
  };
  /** S8 */
  reveal: {
    eyebrow: string;
    targetLine: (name: string) => string;
    missLine: (distance: string) => string;
    closing: string;
    nextButton: string;
  };
  /** S8, index = score band 0..3 */
  verdicts: readonly [VerdictText, VerdictText, VerdictText, VerdictText];
}

const OCTANT_WORDS: Record<string, string> = {
  north: "north",
  "north-east": "northeast",
  east: "east",
  "south-east": "southeast",
  south: "south",
  "south-west": "southwest",
  west: "west",
  "north-west": "northwest",
};

/** The generator's fmtKm, verbatim semantics (scripts/build-coldtrail.mjs). */
export function fmtRadius(km: number): string {
  return `${Math.round(km).toLocaleString("en-US")} km`;
}

function octantWord(octant: string): string {
  return OCTANT_WORDS[octant] ?? octant;
}

// Commit 1 only: local copy of the score cut points (<=100/<=300/<=800).
// Commit 2 replaces this with engine.scoreBand as part of the engine
// split, leaving no duplicated thresholds in the final state.
function scoreBandLocal(scoreKm: number): 0 | 1 | 2 | 3 {
  if (scoreKm <= 100) return 0;
  if (scoreKm <= 300) return 1;
  if (scoreKm <= 800) return 2;
  return 3;
}

export function verdictForTheme(theme: ColdTrailTheme, scoreKm: number): ColdTrailVerdict {
  const band = scoreBandLocal(scoreKm);
  const verdict = theme.verdicts[band]!;
  return { title: verdict.title, line: verdict.line, caught: band <= 1 };
}

const STATUS_READY_NO_CROSS =
  "All 3 rings are down, but they don't cross — use ↩ Move on a ring to shift it closer.";
const LEGEND_DRAFT = "your draft — not locked yet";
const LEGEND_NO_CROSS = "use ↩ Move on a sighting card to shift a ring closer";

export const THEMES: Record<AgeBandId, ColdTrailTheme> = {
  "5-7": {
    id: "T57-A",
    band: "5-7",
    subject: "Pip the puppy",
    // T57-A-S1 (heading APPROVED WITH EDIT by the gate: no case number).
    eyebrow: "🐶 Cold Trail · Puppy Search",
    heading: () => "Find Pip the Puppy",
    // T57-A-S2
    intro:
      "Pip the puppy has wandered off. Three friends spotted Pip. Three rings on the map will show where Pip is waiting.",
    // T57-A-S3
    sightingEyebrow: (n, timestamp) => `🐾 Sighting ${n} · ${timestamp}`,
    // T57-A-S4 (= SP-NEUTRAL, puppy form)
    sightingSentence: (s) =>
      `Pip was spotted ${fmtRadius(s.radiusKm)} ${octantWord(s.octant)} of ${s.cityName}.`,
    // T57-A-S5 (all four parts)
    helper: {
      button: "🦉 Wise Owl: make this ring smaller (1⭐)",
      ariaAffordable: "Wise Owl: make ring half as big, costs 1 star",
      ariaUnavailable: (cost, stars) =>
        `Wise Owl unavailable: needs ${cost} star, you have ${stars}`,
      hint: "🦉 The Wise Owl made that ring smaller.",
      suffix: " (owl made it smaller)",
    },
    map: {
      // T57-A-S6
      ariaLabel:
        "Cold Trail map. Place each ring where Pip was spotted, then tap where the rings cross to show where Pip is.",
      // T57-A-S6 status (done)
      statusDone: "All done — the gold star shows where Pip was waiting.",
      // T57-A-S6-statusReadyCross (gate rewrite, verbatim)
      statusReadyCross: "All 3 rings are down — tap where they cross to show where Pip is.",
      // T57-A-S6-statusReadyNoCross (retain verbatim)
      statusReadyNoCross: STATUS_READY_NO_CROSS,
      // T57-A-S6b (rendered after "gold ring =")
      legendRing: "where Pip was spotted",
      // T57-A-S6b-draft (rendered after "dashed ring =")
      legendDraft: LEGEND_DRAFT,
      // T57-A-S6b-nocross (retain verbatim)
      legendNoCross: LEGEND_NO_CROSS,
      // T57-A-S6b-cross (gate rewrite, verbatim)
      legendCross: "tap where the rings cross to show your guess",
      // T57-A-S6-hintAllCross (gate rewrite, verbatim)
      hintAllCross: "All 3 rings are down — tap where they cross to show where Pip is.",
      // T57-A-S6-hintAllNoCross (retain verbatim)
      hintAllNoCross: STATUS_READY_NO_CROSS,
    },
    confirm: {
      // T57-A-S7-aria (gate rewrite, verbatim)
      ariaLabel: "Confirm your guess",
      // T57-A-S7
      eyebrow: "Your guess",
      heading: "Is Pip here?",
      body: "One guess — then we will see where Pip was waiting all along.",
      button: "📍 Show my guess",
    },
    reveal: {
      // T57-A-S8c
      eyebrow: "All done",
      // T57-A-S8 reveal
      targetLine: (name) => `Pip was waiting in ${name}.`,
      // T57-A-S8b
      missLine: (distance) => `Your guess was ${distance} away.`,
      // T57-A-S8 closing
      closing: "+1⭐ for finding Pip",
      // T57-A-S8 next
      nextButton: "🐶 Next search",
    },
    // T57-A-S8 (Near line APPROVED WITH EDIT by the gate, verbatim below)
    verdicts: [
      { title: "You found Pip!", line: "Pip was waiting right there, tail wagging." },
      { title: "So close!", line: "You were very close. One more ring would have found Pip." },
      {
        title: "Not here — keep looking.",
        line: "Pip was a little further away. Look at the rings and try the next search.",
      },
      {
        title: "Pip was far away.",
        line: "That was a different part of the map. Look at the rings and try the next search.",
      },
    ],
  },
  "8-10": {
    id: "T810-A",
    band: "8-10",
    subject: "The treasure map",
    // T810-A-S1
    eyebrow: "🗺️ Cold Trail · Map Mystery",
    heading: (caseNo) => `Case #${String(caseNo).padStart(3, "0")} — The Missing Treasure Map`,
    // T810-A-S2
    intro:
      "A treasure map has gone missing from its box. Three sightings, three rings — work out where the map ended up and tap your best guess.",
    // T810-A-S3
    sightingEyebrow: (n, timestamp) => `👀 Sighting ${n} · ${timestamp}`,
    // T810-A-S4 (= SP-NEUTRAL)
    sightingSentence: (s) =>
      `The treasure map was spotted ${fmtRadius(s.radiusKm)} ${octantWord(s.octant)} of ${s.cityName}.`,
    // T810-A-S5 (all four parts)
    helper: {
      button: "🧭 Guide: tighten this ring by half (1⭐)",
      ariaAffordable: "Guide: tighten ring to half radius, costs 1 star",
      ariaUnavailable: (cost, stars) =>
        `Guide unavailable: needs ${cost} star, you have ${stars}`,
      hint: "🧭 The Guide tightened that ring to half its size.",
      suffix: " (guide tightened)",
    },
    map: {
      // T810-A-S6
      ariaLabel:
        "Cold Trail map. Place each sighting ring where the treasure map was spotted, then tap where the rings cross to set your guess.",
      // T810-A-S6 status (done)
      statusDone: "Mystery solved — the gold star marks where the map ended up.",
      // T810-A-S6-statusReadyCross (gate rewrite, verbatim)
      statusReadyCross: "All 3 rings are down — tap where they cross to set your guess.",
      // T810-A-S6-statusReadyNoCross (retain verbatim)
      statusReadyNoCross: STATUS_READY_NO_CROSS,
      // T810-A-S6b (rendered after "gold ring =")
      legendRing: "sighting ring for the map",
      // T810-A-S6b-draft (rendered after "dashed ring =")
      legendDraft: LEGEND_DRAFT,
      // T810-A-S6b-nocross (retain verbatim)
      legendNoCross: LEGEND_NO_CROSS,
      // T810-A-S6b-cross (gate rewrite, verbatim)
      legendCross: "tap where the rings cross to set your guess",
      // T810-A-S6-hintAllCross (gate rewrite, verbatim)
      hintAllCross: "All 3 rings are down — tap where they cross to set your guess.",
      // T810-A-S6-hintAllNoCross (retain verbatim)
      hintAllNoCross: STATUS_READY_NO_CROSS,
    },
    confirm: {
      // T810-A-S7-aria (gate rewrite, verbatim)
      ariaLabel: "Confirm your guess",
      // T810-A-S7
      eyebrow: "Your guess",
      heading: "Pin this spot?",
      body: "One guess — then we will see where the map really ended up.",
      button: "📍 Pin this spot",
    },
    reveal: {
      // T810-A-S8c
      eyebrow: "Mystery solved",
      // T810-A-S8 reveal
      targetLine: (name) => `The map ended up in ${name}.`,
      // T810-A-S8b
      missLine: (distance) => `Your guess was ${distance} away.`,
      // T810-A-S8 closing
      closing: "+1⭐ for solving the mystery",
      // T810-A-S8 next
      nextButton: "🔎 Next mystery",
    },
    // T810-A-S8
    verdicts: [
      { title: "You found the map!", line: "Your pin landed right where the map ended up." },
      { title: "Warm trail — so close!", line: "You had the right area. One more ring would have done it." },
      {
        title: "The trail went quiet.",
        line: "You closed in, but the map was further along the trail.",
      },
      {
        title: "Wrong part of the map.",
        line: "The map ended up somewhere else entirely. Study the rings and try the next mystery.",
      },
    ],
  },
  "11-13": {
    id: "T1113-A",
    band: "11-13",
    subject: "the trail",
    // T1113-A-S1
    eyebrow: "🕵️ Cold Trail · Case file",
    heading: (caseNo) => `Case #${String(caseNo).padStart(3, "0")}`,
    // T1113-A-S2
    intro:
      "A trail of sightings crosses the map. Three sightings, three rings — triangulate where the trail leads and tap your best guess.",
    // T1113-A-S3 (Architect C-2 retains today's string; gate approved)
    sightingEyebrow: (n, timestamp) => `🕵️ Sighting ${n} · ${timestamp}`,
    // T1113-A-S4 (Architect ADR-13; gate approved)
    sightingSentence: (s) =>
      `Last spotted ${fmtRadius(s.radiusKm)} ${octantWord(s.octant)} of ${s.cityName}.`,
    // T1113-A-S5 (aria/hint/suffix as T810-A-S5, per PO)
    helper: {
      button: "🧭 Guide: tighten 50% (1⭐)",
      ariaAffordable: "Guide: tighten ring to half radius, costs 1 star",
      ariaUnavailable: (cost, stars) =>
        `Guide unavailable: needs ${cost} star, you have ${stars}`,
      hint: "🧭 The Guide tightened that ring to half its size.",
      suffix: " (guide tightened)",
    },
    map: {
      // T1113-A-S6
      ariaLabel:
        "Cold Trail map. Place each sighting ring where the trail was spotted, then tap where the rings cross to set your guess.",
      // T1113-A-S6 status (done) — APPROVED WITH EDIT by the gate, verbatim
      statusDone: "Case closed — the gold star marks where the trail led.",
      // T1113-A-S6-statusReadyCross (gate rewrite, verbatim)
      statusReadyCross: "All 3 rings are down — tap where they cross to set your guess.",
      // T1113-A-S6-statusReadyNoCross (retain verbatim)
      statusReadyNoCross: STATUS_READY_NO_CROSS,
      // T1113-A-S6b (rendered after "gold ring =")
      legendRing: "sighting ring",
      // T1113-A-S6b-draft (rendered after "dashed ring =")
      legendDraft: LEGEND_DRAFT,
      // T1113-A-S6b-nocross (retain verbatim)
      legendNoCross: LEGEND_NO_CROSS,
      // T1113-A-S6b-cross (gate rewrite, verbatim)
      legendCross: "tap where the rings cross to set your guess",
      // T1113-A-S6-hintAllCross (gate rewrite, verbatim)
      hintAllCross: "All 3 rings are down — tap where they cross to set your guess.",
      // T1113-A-S6-hintAllNoCross (retain verbatim)
      hintAllNoCross: STATUS_READY_NO_CROSS,
    },
    confirm: {
      // T1113-A-S7-aria (gate rewrite, verbatim)
      ariaLabel: "Confirm your guess",
      // T1113-A-S7
      eyebrow: "Your guess",
      heading: "Pin this spot?",
      body: "One guess — then we will see where the trail really led.",
      button: "📍 Pin this spot",
    },
    reveal: {
      // T1113-A-S8c (retained)
      eyebrow: "Case closed",
      // T1113-A-S8 reveal
      targetLine: (name) => `The trail led to ${name}.`,
      // T1113-A-S8b
      missLine: (distance) => `Your guess was ${distance} away.`,
      // T1113-A-S8 closing (Architect C-2 retains; SOLVE_REWARD = 1)
      closing: "+1⭐ for closing the case",
      // T1113-A-S8 next
      nextButton: "🔎 Next case",
    },
    // T1113-A-S8
    verdicts: [
      { title: "Trail solved!", line: "Your pin landed right where the trail led." },
      {
        title: "Warm trail — so close!",
        line: "You had the right neighborhood. One more ring would have done it.",
      },
      {
        title: "The trail went cold.",
        line: "You closed in, but the trail led further than the rings suggested.",
      },
      {
        title: "The trail led elsewhere.",
        line: "Wrong part of the map entirely. Study the rings and try the next case.",
      },
    ],
  },
};

export function themeForBand(band: AgeBandId): ColdTrailTheme {
  return THEMES[band];
}
