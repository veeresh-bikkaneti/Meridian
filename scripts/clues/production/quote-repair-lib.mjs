// Semi-mechanical quote repair (tier-2 run): for each validator-failed
// clue, try to find a VERBATIM span in the cited extract that covers the
// worker quote's content. Strategy: split the cited extract into
// sentences; score each sentence by token overlap with the worker quote;
// if the best sentence covers >= COVER of the quote's content tokens,
// replace the quote with that sentence (verbatim). Also try contiguous
// sentence pairs and sub-sentence clauses. Purely a quote-string swap:
// clue text, answer, and labels are untouched. Reports per-clue outcome
// so the coordinator can hand-repair the residue.
import { readFileSync } from "node:fs";

export function collapse(s) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}
export function tokens(s) {
  return new Set(
    collapse(s)
      .toLowerCase()
      .replace(/[^\p{L}\p{N} ]/gu, " ")
      .split(" ")
      .filter((w) => w.length > 2),
  );
}
export function splitSpans(text) {
  const t = collapse(text);
  const spans = [];
  // sentence spans
  const re = /[^.!?]+[.!?]+["'”’)]*\s*/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const s = m[0].trim();
    if (s.length >= 24) spans.push(s);
  }
  // clause spans (split sentences on ; and —)
  for (const s of [...spans]) {
    for (const part of s.split(/;|—/)) {
      const p = part.trim();
      if (p.length >= 24) spans.push(p);
    }
  }
  // contiguous sentence pairs
  const sents = spans.filter((s) => /[.!?]["'”’)]*$/.test(s));
  for (let i = 0; i + 1 < sents.length; i++) {
    const pair = `${sents[i]} ${sents[i + 1]}`;
    if (pair.length <= 700) spans.push(pair);
  }
  return spans;
}

export function bestVerbatimSpan(quote, extractText, coverMin = 0.62) {
  const q = tokens(quote);
  if (q.size === 0) return null;
  let best = null;
  for (const span of splitSpans(extractText)) {
    const st = tokens(span);
    let hit = 0;
    for (const w of q) if (st.has(w)) hit += 1;
    const cover = hit / q.size;
    if (cover >= coverMin && (!best || cover > best.cover || (cover === best.cover && span.length < best.span.length))) {
      best = { span, cover };
    }
  }
  return best;
}
