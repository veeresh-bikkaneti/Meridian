#!/usr/bin/env node
/**
 * card-compose.mjs — the card template as code (Veeresh's card rules).
 *
 * THE TEMPLATE (history first, never invented):
 *   [validated history/hook sentence] + [plain-spoken geographic context]
 *
 * The hook sentence comes from exactly two trusted sources, in precedence
 * order:
 *   1. `fact` — the fact ladder's field (scripts/facts-ladder.mjs, on the
 *      facts-ladder branch). Contract: { text, kind:
 *      'wikidata'|'wikitext'|'eb1911'|'hook', source:
 *      'Wikidata'|'Wikipedia'|'EB1911', qid?, href? }. Every composed fact
 *      passed the ladder's no-fabrication validator before merge.
 *   2. `history` — the existing hook sentence in the chunk, written by
 *      scripts/enrich-wikipedia.mjs (verbatim Wikipedia extract sentence,
 *      merge-time no-fabrication gate).
 *
 * When NEITHER exists, the card is the plain geographic blurb and the
 * record is marked hook-missing — the compose result carries
 * `hookMissing: true`, and the pipeline writes that marker onto the chunk
 * record. The on-main Nano fallback (src/game/story-ai.ts) covers the
 * runtime gap: shouldFireAiStory() fires exactly when fact and history are
 * both absent.
 *
 * THIS MODULE NEVER INVENTS TEXT. composeCardStory() only reorders fields
 * that already exist. A missing hook is reported truthfully, never papered
 * over with a fabricated story.
 *
 * Consumers:
 *   - scripts/build-geonames-dataset.mjs — marks hookMissing at generation
 *     time (the generator has no facts; enrichment adds them later).
 *   - scripts/enrich-wikipedia.mjs — clears hookMissing when it writes
 *     history. (The facts-ladder merge must do the same for `fact`.)
 *   - src/game/generated-places.ts — runtime composition (fact > history).
 *   - scripts/lint-cards.mjs — the prebuild gate; lintCard() is the rule
 *     book, exercised against fixtures AND the shipped chunks.
 */

export const HOOK_MIN_CHARS = 20;

/**
 * Extract the hook sentence from the fact ladder's `fact` field.
 * Tolerates the object contract { text, kind, source, ... } and a plain
 * string (legacy/defensive). Returns null when there is no usable hook.
 */
export function factText(fact) {
  if (typeof fact === "string") {
    const t = fact.trim();
    return t.length >= HOOK_MIN_CHARS ? t : null;
  }
  if (fact && typeof fact === "object" && typeof fact.text === "string") {
    const t = fact.text.trim();
    return t.length >= HOOK_MIN_CHARS ? t : null;
  }
  return null;
}

function historyText(history) {
  if (typeof history !== "string") return null;
  const t = history.trim();
  return t.length >= HOOK_MIN_CHARS ? t : null;
}

/**
 * Compose the card story. Returns { story, hookSource, hookText, hookMissing }.
 *   hookSource: 'fact' | 'history' | null
 *   hookText: the leading hook sentence ("" when none)
 *   hookMissing: true only when no hook exists anywhere — the caller must
 *     persist this marker on the record (the linter flags it; Nano covers
 *     the runtime gap).
 */
export function composeCardStory({ fact = null, history = null, blurb = "" } = {}) {
  const geo = typeof blurb === "string" ? blurb.trim() : "";
  const fromFact = factText(fact);
  if (fromFact) {
    return { story: geo ? `${fromFact} ${geo}` : fromFact, hookSource: "fact", hookText: fromFact, hookMissing: false };
  }
  const fromHistory = historyText(history);
  if (fromHistory) {
    return { story: geo ? `${fromHistory} ${geo}` : fromHistory, hookSource: "history", hookText: fromHistory, hookMissing: false };
  }
  return { story: geo, hookSource: null, hookText: "", hookMissing: true };
}

// ---------------------------------------------------------------------------
// lintCard(): the rule book. A composed card passes when ALL hold:
//   1. history-first — with a hook, the story OPENS with that exact hook
//      sentence (hookText), never with the geographic blurb.
//   2. one memorable hook — the hook is a real sentence (>= 20 chars,
//      terminal punctuation).
//   3. no stats leaks — the hook carries no coordinates, elevation,
//      population, or census filler (card rules 2+4).
//   4. no coordinate leaks anywhere in the card text.
// Returns { ok: true } or { ok: false, violations: [codes] }.
// ---------------------------------------------------------------------------

const STATS_LEAK_RE = /°|\belevation\b|\bpopulation\b|\bcensus\b/i;

export function lintCard({ story, hookSource, hookText = "", name = "" } = {}) {
  const violations = [];
  const text = typeof story === "string" ? story.trim() : "";
  const hook = typeof hookText === "string" ? hookText.trim() : "";

  if (!text) {
    violations.push("empty-story");
    return { ok: false, violations };
  }

  if (hookSource === "fact" || hookSource === "history") {
    // The hook must LEAD verbatim. If the story opens with anything else
    // (e.g. the flat geographic blurb), the card failed rule 1.
    if (!hook || !text.startsWith(hook)) {
      violations.push("hook-not-first");
    }
    if (hook.length < HOOK_MIN_CHARS) violations.push("hook-too-short");
    if (hook && !/[.!?]$/.test(hook)) violations.push("hook-no-terminal");
    if (hook && STATS_LEAK_RE.test(hook)) violations.push("hook-stats-leak");
  } else {
    // Hook-less cards are honest only when flagged hook-missing (the marker
    // lives on the record, checked by the chunk audit). Here we only guard
    // the geographic text itself.
    if (STATS_LEAK_RE.test(text)) violations.push("geo-stats-leak");
  }

  // The card text never carries raw coordinates, whatever the source.
  if (/[+-]?\d{1,3}\.\d+\s*°/.test(text) || /\b\d+\s*°\s*[NSEW]\b/.test(text)) {
    violations.push("coordinate-leak");
  }

  return violations.length === 0 ? { ok: true, violations } : { ok: false, violations };
}
