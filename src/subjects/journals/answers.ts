/**
 * Journals answers (Phase 3) — a projection of the records in
 * ./items.ts, plus the two year-gap generators.
 *
 * Fourteen answers are finished entries in their records (two of
 * them fixed gaps between stored dates, computed once from the
 * row's dates, never from the clock). Two are year-gap questions —
 * technology:first-phone and modern-world:liverpool-manchester —
 * whose record answer text is a template: {year} is the current
 * year, {years} the gap from the item's anchor year, {years±N} the
 * distractor offsets. The generator below fills the template at
 * play time, so the projected entry at any year is byte-identical
 * to what the old journalAnswers(year) built by hand. Year-gap
 * answers are computed from the device's year at play time (owner
 * rule), never typed.
 *
 * Judgment calls carried over from the old hand-built answers (and
 * stated in the answer text itself): the practice-rate and
 * practice-triangle items (Andean roads, Aconcagua), and the Pont
 * du Gard grouping, which the row itself labels a practice frame.
 */
import { JOURNAL_RECORDS, toAnswerEntry } from "./items.ts";
import type { SubjectItem } from "./items.ts";
import type { AnswerEntry, AnswerFor } from "../shared/answer.ts";
import { currentYear, yearsSince } from "../shared/years.ts";

export { currentYear, yearsSince };

/**
 * Anchor years for the two year-gap items — the named constants
 * beside the generator (the general-knowledge opera item keeps its
 * anchor the same way). The records hold no current year; these
 * stored dates are the static truth the computation is fed by.
 */
export const YEAR_GAP_ANCHORS: Readonly<Record<string, number>> = {
  "technology:first-phone": 1876,
  "modern-world:liverpool-manchester": 1830,
};

/** Fill a year-gap template: {years±N} first, then {year}. */
function fillYearTemplate(text: string, year: number, years: number): string {
  return text
    .replace(/\{years([+-]\d+)?\}/g, (_match, offset: string | undefined) =>
      String(years + (offset ? Number(offset) : 0)),
    )
    .replace(/\{year\}/g, String(year));
}

/** One year-gap item's answer for a given current year. */
function yearGapEntry(record: SubjectItem, anchorYear: number, year: number): AnswerEntry {
  const years = yearsSince(anchorYear, year);
  const fill = (text: string): string => fillYearTemplate(text, year, years);
  return {
    prompt: fill(record.answer.prompt),
    choices: record.answer.choices.map(fill),
    correct: fill(record.answer.correct),
    derivation: fill(record.answer.derivation),
    value: years,
  };
}

/** Every D1 answer, for a given current year (pinned in tests). */
export function journalAnswers(year: number): Record<string, AnswerEntry> {
  const out: Record<string, AnswerEntry> = {};
  for (const record of JOURNAL_RECORDS) {
    const anchorYear = YEAR_GAP_ANCHORS[record.id];
    out[record.id] =
      anchorYear !== undefined ? yearGapEntry(record, anchorYear, year) : toAnswerEntry(record);
  }
  return out;
}

/** The answer lookup used by the case flow, at the device's year. */
export const answerFor: AnswerFor = (itemId) => journalAnswers(currentYear())[itemId] ?? null;
