/**
 * watson-walk.ts — Watson's gutter walk: the pure geometry, timing,
 * and layout arithmetic for PR B ("Watson Walks", staging council Q3).
 *
 * Architecture (the pair's standing pattern): everything here is a
 * pure function or a named constant derived from other named
 * constants — no DOM, no React, no timers. DetectiveHost owns the
 * environment (the measured card anchors, the transform transition,
 * the arrival timer) and renders what these numbers decide. That
 * split is what makes the walk's arithmetic unit-testable in node,
 * and it is where PR B discharges PR A's gutter-literal obligation:
 * the 118 px gutter and the host's +6 / +62 / +118 offsets used to be
 * bare literals in three places; here they are ONE derivation.
 *
 * The gutter derivation (unit 3, the reconciliation of record):
 * the council mockup staged a 112 px gutter; PR A shipped 118 px and
 * proved it zero-overlap at 390/768/1280. 118 is KEPT — and now
 * derived, not asserted:
 *
 *   GUTTER_W = GUTTER_CARD_GAP (6)      — clear air between the clue
 *                                         card's right edge and
 *                                         Watson's figure (the host's
 *                                         old `+ 6` in gutterLeft)
 *            + WATSON_FIGURE_W (100)    — Watson's rendered width at
 *                                         the station's 104 px figure
 *                                         height (DetectiveHost's
 *                                         WATSON_DOCK_W: the 134×140
 *                                         rig at 104 px tall ≈ 99.5)
 *            + GUTTER_EDGE_CLEAR (12)   — clear air between Watson and
 *                                         the screen edge: the pair's
 *                                         standard outer clearance
 *                                         (the dock inset, 12 px)
 *            = 118
 *
 * The mockup's 112 would leave only 6 px of edge clear — half the
 * pair's standard outer clearance — and would re-narrow every clue
 * card against PR A's proven layout for no clearance gain anywhere.
 * The margin itself still applies for the whole session under
 * staging (PR A's handbook rule): cards never reflow mid-case.
 */

/* ------------------------------------------------------------------ */
/* Layout primitives (the constants of record the derivation uses)     */
/* ------------------------------------------------------------------ */

/** The station figures' rendered height (detective.css pins both
 * rigs' SVGs to 104 px; DetectiveHost's HOLMES_BOX.h is the same
 * number on the Holmes side). */
export const STATION_FIGURE_H_PX = 104;

/** Watson's rendered width at that height (see the header). */
export const WATSON_FIGURE_W_PX = 100;

/** Holmes's rendered width at that height (DetectiveHost HOLMES_BOX.w). */
export const HOLMES_FIGURE_W_PX = 70;

/** Clear air between Watson and Holmes at the station cluster
 * (DetectiveHost STATION_GAP_PX — a different gap from the dock's 8
 * and the chip's 8; the three stay distinct by name, PR A). */
export const STATION_GAP_PX = 4;

/** The speaker chip's clear air from whatever stands to its left
 * (DetectiveHost CHIP_CLEAR_PX). */
export const CHIP_CLEAR_PX = 8;

/* ------------------------------------------------------------------ */
/* The gutter (PR B unit 3)                                            */
/* ------------------------------------------------------------------ */

/** Clear air between the clue card's right edge and Watson's figure. */
export const GUTTER_CARD_GAP_PX = 6;

/** Clear air between Watson's figure and the screen edge — the
 * pair's standard outer clearance (the map dock inset is also 12). */
export const GUTTER_EDGE_CLEAR_PX = 12;

/** The reserved gutter beside the clue cards under staging:
 * 6 (card gap) + 100 (Watson's figure) + 12 (edge clear) = 118 px.
 * detective.css carries the same number as the cards' margin-right,
 * with this derivation in its comment — CSS cannot import the
 * constant, so the unit test in watson-walk.test.ts pins the
 * arithmetic and the CSS comment names this module as the source. */
export const GUTTER_W_PX =
  GUTTER_CARD_GAP_PX + WATSON_FIGURE_W_PX + GUTTER_EDGE_CLEAR_PX;

/** The gutter cluster's side controls (speaker chip, Listen button)
 * sit BELOW Watson's figure on the gutter centre line: half the
 * figure's height (52) plus 10 px of clear air under his feet. This
 * is the host's old bare `+ 62`, derived. */
export const GUTTER_BELOW_FIGURE_PX = STATION_FIGURE_H_PX / 2 + 10;

/** The tap-mode Listen button's height as laid out (10 px padding
 * top + bottom around a ~24 px label line, plus its 2 px borders —
 * the host's clearance arithmetic in PR C used the same ~48 px). */
export const LISTEN_BUTTON_H_PX = 48;

/** When Listen shows, the speaker chip drops one more row so the two
 * controls never share hittable space: below-figure (62) + Listen's
 * height (48) + the chip clear (8) = 118. The host's old bare
 * `+ 118`, derived — a different 118 from GUTTER_W_PX by coincidence
 * of the inputs, and a different meaning: this one is vertical. */
export const GUTTER_CHIP_BELOW_LISTEN_PX =
  GUTTER_BELOW_FIGURE_PX + LISTEN_BUTTON_H_PX + CHIP_CLEAR_PX;

/* ------------------------------------------------------------------ */
/* Station chip offset (carry-in c: extracted pure, unit-pinned)       */
/* ------------------------------------------------------------------ */

/**
 * The speaker chip's horizontal offset from the station anchor's
 * left edge, for every figure combination the station can show.
 * Extracted from DetectiveHost (PR B carry-in c) so the arithmetic
 * is pinned by unit tests — including the Holmes-alone branch
 * (HOLMES_FIGURE_W + CHIP_CLEAR = 78), which PR A recorded as
 * unreachable from the machine's view table: every station phase
 * pairs Holmes with Watson or shows neither, and PR B's WALKING
 * state does not change that (Watson walks WITHIN the station
 * cluster; Holmes still never joins it under staging, and the
 * non-staging station phases are untouched). The branch stays —
 * correct if a future phase ever reaches it, and now proven by a
 * pin instead of by arithmetic in a comment.
 */
export function stationChipOffsetPx(input: {
  celebrating: boolean;
  celebrateClusterW: number;
  watsonAtStation: boolean;
  holmesAtStation: boolean;
}): number {
  if (input.celebrating) return input.celebrateClusterW + CHIP_CLEAR_PX;
  if (input.watsonAtStation && input.holmesAtStation) {
    return WATSON_FIGURE_W_PX + STATION_GAP_PX + HOLMES_FIGURE_W_PX + CHIP_CLEAR_PX;
  }
  if (input.watsonAtStation) return WATSON_FIGURE_W_PX + CHIP_CLEAR_PX;
  // Holmes alone at the station (unreachable today — see header).
  return HOLMES_FIGURE_W_PX + CHIP_CLEAR_PX;
}

/** Holmes's own station offset: beside Watson when Watson is there,
 * at the origin when celebrating (the celebrate cluster's layout) or
 * when he stands alone. */
export function stationHolmesOffsetPx(input: {
  celebrating: boolean;
  watsonAtStation: boolean;
}): number {
  if (input.celebrating) return 0;
  return input.watsonAtStation ? WATSON_FIGURE_W_PX + STATION_GAP_PX : 0;
}

/* ------------------------------------------------------------------ */
/* The walk (PR B unit 1)                                              */
/* ------------------------------------------------------------------ */

/** Walk duration band (council Q3): every gutter walk takes
 * 0.6–1.0 s, distance-capped — short hops take the floor, long
 * travels the ceiling, nothing teleports and nothing dawdles. */
export const WATSON_WALK_MIN_MS = 600;
export const WATSON_WALK_MAX_MS = 1000;

/** Walk speed: the pair's shared ~260 px/s (DetectiveHost's Holmes
 * walk speed) — the duration is the distance at this speed, clamped
 * to the band above. */
export const WATSON_WALK_PX_PER_S = 260;

/** The arrival fallback: transitionend is the primary arrival
 * signal; if it never fires (an interrupted transition, a background
 * tab), the host's timer releases the held read this long after the
 * nominal duration — a read is delayed by a rendering hiccup, never
 * lost to one. */
export const WATSON_WALK_FALLBACK_GRACE_MS = 250;

/** The case-open walk's shape: Watson rises from the bench (which
 * sits in the page flow ABOVE the clue cards, directly under the
 * map) and walks down the gutter to clue 1. His start is rendered
 * this far above the clue-1 station — roughly one bench slot
 * (132 px) plus a stride — for this long. */
export const CASE_OPEN_WALK_START_OFFSET_PX = 160;
export const CASE_OPEN_WALK_MS = 800;

/** Duration for a clue-to-clue gutter walk over `distancePx` of
 * vertical travel (the gutter's x never changes — every card shares
 * the column's left and width — so the path is one-dimensional). */
export function watsonWalkDurationMs(distancePx: number): number {
  const raw = (Math.abs(distancePx) / WATSON_WALK_PX_PER_S) * 1000;
  return Math.min(
    WATSON_WALK_MAX_MS,
    Math.max(WATSON_WALK_MIN_MS, Math.round(raw)),
  );
}

/* ------------------------------------------------------------------ */
/* The announcement (PR B unit 2)                                      */
/* ------------------------------------------------------------------ */

/** The one new fixed line: Watson's case-open announcement, spoken
 * DURING the case-open walk only (council Q3 — per-clue announcing
 * fails the session dosage law; case-open-only, capped, is solvent:
 * baseline ≈27 lines + ≤2 = ≤29 of the 30-line ceiling). */
export const ANNOUNCEMENT_FIXED_ID = "lets-find-clues";

/** Session cap: at most two announcements per session (host mount),
 * however many cases the session holds. */
export const ANNOUNCEMENT_SESSION_CAP = 2;

/** May the announcement play for this walk? All of: it is the
 * case-open walk (the first clue walk of a case), the session cap
 * has room, and speech is in auto mode (in tap mode the line would
 * be held inaudibly and in off mode dropped — neither is a spoken
 * announcement, so neither spends the cap). */
export function shouldAnnounce(input: {
  isCaseOpenWalk: boolean;
  announcedThisSession: number;
  speechMode: string;
}): boolean {
  return (
    input.isCaseOpenWalk &&
    input.announcedThisSession < ANNOUNCEMENT_SESSION_CAP &&
    input.speechMode === "auto"
  );
}
