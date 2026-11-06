/**
 * render-plan.mjs — the detective audio render plan (PURE: no I/O, no fs).
 *
 * Why this exists: Holmes & Watson speak only from pre-rendered audio
 * (runtime synthesis cannot pin the two approved voices or hold the
 * measured pitch gates — see BUILD-SCOPE §1.5). This module is the single
 * source of truth for WHAT gets rendered: every line's exact text, voice,
 * speed and gain. The renderer (render-audio.mjs) and the staleness gate
 * (check-audio-manifest.mjs) both build their expectations from here, so
 * the words the game ships can never drift from the words that were
 * rendered without the hash gate noticing.
 *
 * Clue text is always VERBATIM from the case's clue file. Fixed lines are
 * the owner-approved prototype lines (evidence: REPORT-animated.md,
 * REPORT loop run) or the game's own on-screen copy — never new writing,
 * except the two decode templates the council left as drafts; those
 * are flagged DRAFT in their manifest notes. (A third draft, Watson's
 * amazement fragment, was cut in the cure pass — it could not reach
 * its ≥165 wpm breathless pace inside Watson's pitch family.)
 */

export const VOICES = Object.freeze({
  holmes: "avocado_v2:atlas",
  watson: "avocado_v2:pb1_music_02",
});

/** Watson's clue-read speeds by clue index (council staircase: suspense
 *  descent on clues 1–4, certainty landing on the Giveaway). */
export const CLUE_SPEEDS = Object.freeze([100, 97, 95, 92, 105]);

export const CLUE_KINDS = Object.freeze([
  "geography",
  "climate",
  "history",
  "hook",
  "giveaway",
]);

/**
 * The game's own display-name formatting, mirrored from
 * `displayLoopName` in src/game/loop/evaluate.ts: title-case the stored
 * lowercase name (first letter of each word), then append the region
 * string when present. Render text MUST be byte-identical to the name
 * the game shows on the reveal, so this helper is the only place the
 * pipeline builds a spoken name.
 *
 * @param {{ n: string, r: string }} entry unpacked names-catalog row
 * @returns {string} e.g. "Henderson, Nevada, United States"
 */
export function displayName(entry) {
  const name = entry.n.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  return entry.r ? `${name}, ${entry.r}` : name;
}

/** The fail-reveal read: the game's reveal headline + the answer name. */
export function answerText(name) {
  return `Out of guesses. The answer was ${name}.`;
}

function spec(fields) {
  return Object.freeze({ gainDb: 0, ...fields });
}

/**
 * Render specs for one case: 5 Watson clue reads (verbatim) + 1 Holmes
 * answer read.
 *
 * @param {{ clues: string[] }} clueFile parsed public/loop/clues/<i>.json
 * @param {string} name display name for the case's place (see displayName)
 * @param {number} caseIndex loop case index
 */
export function casePlan(clueFile, name, caseIndex) {
  if (!Array.isArray(clueFile?.clues) || clueFile.clues.length !== 5) {
    throw new Error(
      `case ${caseIndex}: clue file must carry exactly 5 clues — fix the clue file before rendering`,
    );
  }
  const clues = clueFile.clues.map((text, i) =>
    spec({
      kind: "clue",
      caseIndex,
      clueIndex: i,
      clueKind: CLUE_KINDS[i],
      text,
      voice: VOICES.watson,
      speed: CLUE_SPEEDS[i],
      file: `case-${caseIndex}/clue-${i + 1}.mp3`,
    }),
  );
  const answer = spec({
    kind: "answer",
    caseIndex,
    text: answerText(name),
    voice: VOICES.holmes,
    speed: 100,
    file: `case-${caseIndex}/answer.mp3`,
  });
  return { clues, answer };
}


/**
 * The fixed lines: same words every case, rendered once (Unit U2 renders
 * them; the plan lives here from U1 so the manifest schema is stable).
 * `note` values starting with DRAFT mark wording the panel still has to
 * ratify — they ship in the manifest so the draft can never pass silently.
 */
export const FIXED_LINES = Object.freeze([
  // Holmes acknowledgements — rotating, content-free (answer-blind).
  spec({ id: "ack-1", kind: "ack", text: "Right. Leave it with me.", voice: VOICES.holmes, speed: 100, file: "fixed/ack-1.mp3" }),
  spec({ id: "ack-2", kind: "ack", text: "Very well, Watson.", voice: VOICES.holmes, speed: 100, file: "fixed/ack-2.mp3" }),
  spec({ id: "ack-3", kind: "ack", text: "Noted, Watson.", voice: VOICES.holmes, speed: 100, file: "fixed/ack-3.mp3" }),
  spec({ id: "ack-4", kind: "ack", text: "Ah... the game is afoot.", voice: VOICES.holmes, speed: 100, file: "fixed/ack-4.mp3" }),
  // One identical asset for every pick — correctness cannot modulate it.
  spec({ id: "suspicion", kind: "suspicion", text: "Hmm... it could be it.", voice: VOICES.holmes, speed: 85, gainDb: -5, file: "fixed/suspicion.mp3" }),
  spec({ id: "ask-next", kind: "ask-next", text: "Watson. The next question.", voice: VOICES.holmes, speed: 100, file: "fixed/ask-next.mp3" }),
  // Hushed register: slow + quiet, measurably below Holmes's baseline.
  spec({ id: "hook-announcement", kind: "hook-announcement", text: "Clue four! The Hook! This is the one that changes everything.", voice: VOICES.holmes, speed: 85, gainDb: -5, file: "fixed/hook-announcement.mp3" }),
  // The game's own instruction copy (LoopScreen header), split at the
  // sentence boundary exactly as the approved prototype split it.
  spec({ id: "instructions-holmes", kind: "instructions", text: "Five guesses, one mystery place.", voice: VOICES.holmes, speed: 100, file: "fixed/instructions-holmes.mp3" }),
  spec({ id: "instructions-watson", kind: "instructions", text: "Each guess unlocks another clue — and tells you how far off you were, and in which direction.", voice: VOICES.watson, speed: 100, file: "fixed/instructions-watson.mp3" }),
  // Endings — the game's own solve copy.
  spec({ id: "win-holmes", kind: "win", text: "You found it!", voice: VOICES.holmes, speed: 108, file: "fixed/win-holmes.mp3" }),
  spec({ id: "win-watson", kind: "win", text: "Case closed — the gold star marks the answer.", voice: VOICES.watson, speed: 100, file: "fixed/win-watson.mp3" }),
  // Clue-local decode templates (never per-case, never combining clues).
  spec({ id: "decode-geography", kind: "decode", clueKind: "geography", text: "Borders first. The rest follows.", voice: VOICES.holmes, speed: 100, file: "fixed/decode-geography.mp3" }),
  spec({ id: "decode-climate", kind: "decode", clueKind: "climate", text: "Weather narrows the world.", voice: VOICES.holmes, speed: 100, file: "fixed/decode-climate.mp3" }),
  spec({ id: "decode-history", kind: "decode", clueKind: "history", text: "Old stories leave addresses.", voice: VOICES.holmes, speed: 100, file: "fixed/decode-history.mp3" }),
  spec({ id: "decode-hook", kind: "decode", clueKind: "hook", text: "This is the clue to weigh most carefully.", voice: VOICES.holmes, speed: 104, file: "fixed/decode-hook.mp3", note: "DRAFT wording — template decode, panel review required" }),
  spec({ id: "decode-giveaway", kind: "decode", clueKind: "giveaway", text: "That settles it — with the giveaway in hand, you can trust your pin.", voice: VOICES.holmes, speed: 104, file: "fixed/decode-giveaway.mp3", note: "DRAFT wording — template decode, panel review required" }),
  // Post-solve debrief frame: the answer's name read slots between these
  // two lines at runtime; the frame itself names no place.
  spec({ id: "debrief-frame", kind: "debrief", text: "The land. The weather. The story. The hook. The giveaway.", voice: VOICES.holmes, speed: 104, file: "fixed/debrief-frame.mp3" }),
  spec({ id: "debrief-close", kind: "debrief", text: "All of it — one place. Elementary.", voice: VOICES.holmes, speed: 100, file: "fixed/debrief-close.mp3" }),
  // Game-end celebration line (Unit B, PATH 2 — measured fallback).
  // The preferred design was a COMPOSABLE spoken score (Holmes reading
  // the total from single-word number clips). Two full pipeline passes
  // (2026-11-06) measured it broken: the single-word renders are pitch-
  // unstable (num-four measured 116.8 Hz in one pass and 222.2 Hz in
  // the next; after both passes 8 of 30 words sat outside Holmes's
  // 110–160 Hz family band) and the "points" framing line failed the
  // 90 wpm pace floor twice (83 wpm). A spoken number that can drift
  // out of the voice family — or worse, disagree with the displayed
  // total — never ships, so the pair speaks ONE fixed line here and
  // the score itself lives in the celebration frame as text, exactly
  // as the summary card displays it. The line is new writing: DRAFT.
  spec({ id: "score-celebration", kind: "score", text: "What a game! Well played, everyone!", voice: VOICES.holmes, speed: 104, file: "fixed/score-celebration.mp3", note: "DRAFT wording — Unit B game-end celebration line; panel review required" }),
]);


export function fixedLine(id) {
  const line = FIXED_LINES.find((l) => l.id === id);
  if (!line) throw new Error(`unknown fixed line id "${id}" — known ids: ${FIXED_LINES.map((l) => l.id).join(", ")}`);
  return line;
}

/**
 * Render spec for a bare selection-name read (Holmes). The row is an
 * unpacked names-catalog entry: { id: "geonames:<n>", n, r, p }.
 */
export function selectionNamePlan(row) {
  const numeric = String(row.id).replace(/^geonames:/, "");
  if (!/^\d+$/.test(numeric)) {
    throw new Error(`selection name: id "${row.id}" is not a geonames id — only catalog places get name reads`);
  }
  return spec({
    kind: "name",
    geonameId: numeric,
    text: displayName(row),
    voice: VOICES.holmes,
    speed: 100,
    file: `names/${numeric}.mp3`,
  });
}
