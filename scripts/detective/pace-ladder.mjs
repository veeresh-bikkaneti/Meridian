/**
 * pace-ladder.mjs — the detective renderer's pace rule (PURE: no I/O).
 *
 * Why this exists: pitch alone does not prove a line is listenable.
 * Case 416's first clue once rendered at a pitch-perfect 85.1 Hz but
 * 29 words per minute — a 54-second clue read that passed as "ok"
 * because only pitch was gated. This module holds the pace decision
 * logic on its own so the rule is unit-testable without a TTS call:
 * which lines have a pace floor, which take wins when several were
 * rendered, and what status the settled take earns.
 *
 * The rule (BUILD-SCOPE cure, 2026-11-06): after the pitch ladder
 * settles, a line under its floor retries at +6 speed, at most twice.
 * The take that ships is the fastest-speaking one that stayed inside
 * the pitch family band — pace may never buy speed with a pitch the
 * family would reject. A line still under its floor after the retries
 * ships flagged, with the measured wpm in its note. A line the pitch
 * ladder already flagged stays flagged: pace never un-flags pitch.
 */
import { VOICES } from "./render-plan.mjs";

/** Council pace family for Watson clue reads is ~135–150 wpm; 100 is
 *  the sanity floor under which a read is a defect, not a style. */
export const WATSON_CLUE_WPM_FLOOR = 100;
/** Holmes speaks faster by design; his sanity floor is lower. */
export const HOLMES_WPM_FLOOR = 90;
/** Each pace retry adds this much TTS speed. */
export const PACE_STEP = 6;
/** Pace retries allowed after the pitch ladder settles. */
export const MAX_PACE_RETRIES = 2;

/**
 * The pace floor for a render spec, or null when pace is not gated.
 *
 * Watson is gated on clue reads only — his fixed fragments carry no
 * pace floor. (The cure pass superseded the old note here, which held
 * that the amazement fragment "lingered" by design: the fragment was
 * in fact under its ≥165 wpm breathless spec at 49 wpm, could not be
 * rendered up to the floor, and was cut.) Holmes is gated on his
 * lines (answers, fixed lines).
 * Selection-name reads carry no floor: a name is one to three words,
 * so its "wpm" measures the pauses around it, not a speaking pace —
 * 1,366 of the 1,460 name reads accepted in U3 sit under 90 wpm.
 */
export function paceFloorFor(spec) {
  if (spec.kind === "name") return null;
  if (spec.kind === "clue" && spec.voice === VOICES.watson) return WATSON_CLUE_WPM_FLOOR;
  if (spec.voice === VOICES.holmes) return HOLMES_WPM_FLOOR;
  return null;
}

/** Is a measured pitch inside a [low, high] band? Unmeasured is not. */
export function isInBand(hz, band) {
  return typeof hz === "number" && hz >= band[0] && hz <= band[1];
}

/**
 * Pick the take that ships from the takes rendered for one line, in
 * render order (takes[0] is the pitch ladder's settled take). Only
 * takes inside the pitch family band are eligible; among them the
 * highest wpm wins, earliest first on a tie. If no take is inside
 * the family, the pitch-settled take ships — it is already flagged
 * for pitch, and a pace take must not quietly replace it.
 */
export function selectBestTake(takes, familyBand) {
  if (!takes.length) return null;
  const eligible = takes.filter((t) => isInBand(t.hz, familyBand));
  const pool = eligible.length ? eligible : [takes[0]];
  let best = pool[0];
  for (const take of pool) {
    if ((take.wpm ?? -1) > (best.wpm ?? -1)) best = take;
  }
  return best;
}

/**
 * Settle one line after pitch + pace: choose the shipping take and
 * the final status. `pitchInTarget` is the pitch ladder's verdict on
 * its own settled take — false keeps the line flagged whatever pace
 * does. `paceFlagged` is true when a floor applies and the shipping
 * take still measures under it.
 */
export function settlePace({ takes, familyBand, floor, pitchInTarget }) {
  const best = selectBestTake(takes, familyBand);
  const paceFlagged =
    floor !== null && best !== null && typeof best.wpm === "number" && best.wpm < floor;
  const status = pitchInTarget && !paceFlagged ? "ok" : "flagged";
  return { best, paceFlagged, status };
}
