#!/usr/bin/env node
/**
 * lint-cards.mjs — the card-pipeline gate (wired as `prebuild`).
 *
 * WHAT IT GATES: the GENERATOR's output path, not the legacy data.
 *
 * The 124,690 shipped blurbs are 95.4% flat "X is a town in…" openers
 * (median 9 words) because the generator was never given the history-first
 * rules. A naive gate that failed every legacy blurb would make every build
 * impossible and teach nothing. So this linter uses a two-tier mechanism:
 *
 *   TIER 1 — fixture gate (HARD FAIL). The pipeline's own composition
 *   functions (scripts/card-compose.mjs) are exercised against a fixed set
 *   of good and deliberately-bad fixtures. Good fixtures must compose into
 *   rule-passing cards; bad fixtures MUST be caught — if the linter fails
 *   to bite on a bad fixture, the linter itself is broken and the build
 *   fails. This gates the template as code: any future change to the
 *   composition rules must keep the fixtures green.
 *
 *   TIER 2 — chunk audit (HARD FAIL on post-pipeline records AND on
 *   curated-note bypasses). Every shipped chunk record is composed and
 *   linted, but rule failures are hard errors ONLY when the record carries
 *   a `fact` or `history` field — i.e. it went through the
 *   enrichment/fact-ladder pipeline and must obey the rules. Records are
 *   otherwise classified, never failed:
 *     - hookMissing: true → "awaiting hook" (informational; the on-main
 *       Nano fallback covers the runtime gap).
 *     - no hook fields, no marker → LEGACY, grandfathered. Counted and
 *       reported, never failed. These are the 119k flat blurbs; they age
 *       out as enrichment/fact-ladder runs cover them.
 *
 *   EXEMPTION: the two curated-note checks (curated-history-missing,
 *   embedded-history-bypass) hard-fail REGARDLESS of grandfathering. A
 *   curated notable note (src/game/data/notable-notes.json, keyed by
 *   GeoNames ID) embedded inside a geography-first blurb with no `history`
 *   field is a pipeline-era record — the generator merged notes into
 *   blurbs at build time — not legacy backlog, so the grandfather clause
 *   does not cover it. Curated notes must live in first-class `history`
 *   fields, never only in the blurb, and never duplicated inside it.
 *
 * This way a regression in the generator, the enrichment merge, or the
 * fact ladder breaks the build LOUDLY, while the legacy backlog can never
 * break it.
 *
 * VIOLATION CODES (from lintCard):
 *   hook-not-first  — hook exists but the story doesn't open with it
 *   hook-too-short  — hook under 20 chars (not a real sentence)
 *   hook-no-terminal— hook lacks terminal punctuation
 *   hook-stats-leak — hook carries coords/elevation/population/census filler
 *   geo-stats-leak  — hook-less geographic text carries stats filler
 *   coordinate-leak — raw coordinates anywhere in the card text
 *   empty-story     — nothing to show
 *
 * VIOLATION CODES (Tier 2 chunk audit only, from checkCuratedRecord —
 * these bypass the legacy grandfathering, see TIER 2 above):
 *   curated-history-missing — record's GeoNames ID has a curated notable
 *     note but the record carries no non-empty `history` field. Curated
 *     notes must live in `history`, never only in the blurb.
 *   embedded-history-bypass — the record's blurb contains its curated note
 *     text verbatim. The note must not be duplicated inside the blurb,
 *     even when `history` is also present.
 *
 * Usage: node scripts/lint-cards.mjs [--chunks <dir>] [--quiet]
 * Exit 0 when the gate passes; exit 1 with violation details otherwise.
 * Node stdlib only.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { composeCardStory, factText, lintCard } from "./card-compose.mjs";
import { readFactIndex, withFact } from "./facts-ladder.mjs";
import ts from "typescript";
import {
  BOUNDED_TEXT_REGISTRY,
  CSS_SCOPE_CLASSES,
} from "./bounded-text-registry.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);

const GEO = "Springfield is a town in central Illinois, the United States.";
const FACT = {
  text: "Named for President Abraham Lincoln, who practiced law here before the White House.",
  kind: "wikidata",
  source: "Wikidata",
  qid: "Q123",
};
const HISTORY =
  "In 1908 a race riot here shocked the nation and spurred the founding of the NAACP.";

const NOTABLE_NOTES_PATH = join(REPO, "src", "game", "data", "notable-notes.json");

/**
 * Load the curated notable notes, keyed by bare GeoNames ID string.
 * Keys starting with "_" are file comments, not places. Notes that are
 * missing or whitespace-only are skipped (nothing to enforce verbatim).
 * Node stdlib only.
 */
export function loadCuratedNotes(notesPath = NOTABLE_NOTES_PATH) {
  const raw = JSON.parse(readFileSync(notesPath, "utf8"));
  const notes = new Map();
  for (const [key, entry] of Object.entries(raw)) {
    if (key.startsWith("_")) continue;
    const note = entry && typeof entry.note === "string" ? entry.note : "";
    if (note.trim().length > 0) notes.set(key, note);
  }
  return notes;
}

/**
 * checkCuratedRecord() — the two Tier 2 curated-note checks.
 *
 * A curated notable note embedded inside a geography-first blurb with no
 * `history` field sailed through the old audit as "grandfathered legacy",
 * because the old audit only hard-failed records carrying `fact`/`history`.
 * That was a bypass, not legacy: the generator merged these notes into
 * blurbs at build time, so the records are pipeline-era. These checks close
 * it and apply regardless of the legacy grandfathering.
 *
 * Returns { ok: true } or { ok: false, violations: [codes] } with codes:
 *   curated-history-missing — the record's GeoNames ID (chunk ids are
 *     "gn-<geonameid>") is in the curated notes but the record has no
 *     non-empty `history` field.
 *   embedded-history-bypass — the record's blurb contains its curated note
 *     text verbatim. Fires even when `history` is present: the note must
 *     not be duplicated inside the blurb.
 */
export function checkCuratedRecord(record, curatedNotes) {
  const violations = [];
  const id = record && typeof record.id === "string" ? record.id : "";
  const geonamesId = id.startsWith("gn-") ? id.slice("gn-".length) : id;
  const note = curatedNotes.get(geonamesId);
  if (note === undefined) return { ok: true, violations };
  const history = typeof record.history === "string" ? record.history.trim() : "";
  if (history.length === 0) violations.push("curated-history-missing");
  const blurb = typeof record.blurb === "string" ? record.blurb : "";
  if (note.length > 0 && blurb.includes(note)) violations.push("embedded-history-bypass");
  return violations.length === 0 ? { ok: true, violations } : { ok: false, violations };
}

// ---------------------------------------------------------------------------
// Tier 1: fixture gate
// ---------------------------------------------------------------------------

function checkFixtures() {
  const failures = [];

  const good = [
    {
      name: "fact-first composition",
      input: { fact: FACT, blurb: GEO },
      expectSource: "fact",
    },
    {
      name: "history-first composition",
      input: { history: HISTORY, blurb: GEO },
      expectSource: "history",
    },
    {
      name: "fact beats history (ladder precedence)",
      input: { fact: FACT, history: HISTORY, blurb: GEO },
      expectSource: "fact",
    },
    {
      name: "plain-string fact tolerated",
      input: { fact: FACT.text, blurb: GEO },
      expectSource: "fact",
    },
    {
      name: "no hook → hookMissing, plain geo blurb",
      input: { blurb: GEO },
      expectSource: null,
    },
  ];

  for (const f of good) {
    const c = composeCardStory(f.input);
    if (c.hookSource !== f.expectSource) {
      failures.push(`GOOD fixture "${f.name}": hookSource=${c.hookSource}, want ${f.expectSource}`);
      continue;
    }
    if (f.expectSource === null && !c.hookMissing) {
      failures.push(`GOOD fixture "${f.name}": hookMissing not set on hook-less card`);
      continue;
    }
    const r = lintCard({ story: c.story, hookSource: c.hookSource, hookText: c.hookText });
    if (!r.ok) {
      failures.push(`GOOD fixture "${f.name}": lint failed [${r.violations.join(",")}]`);
    }
    // The hook must literally lead the story.
    if (f.expectSource && !c.story.startsWith(c.hookText)) {
      failures.push(`GOOD fixture "${f.name}": hook does not lead the story`);
    }
  }

  // Deliberately bad cards — the linter MUST bite on every one. If it
  // doesn't, the gate is blind and the build fails.
  const bad = [
    {
      name: "hook buried under flat opener",
      card: { story: `${GEO} ${HISTORY}`, hookSource: "history", hookText: HISTORY },
      want: "hook-not-first",
    },
    {
      name: "hook with population filler",
      card: {
        story: `Founded in 1821, it now has a population of 114,000. ${GEO}`,
        hookSource: "history",
        hookText: "Founded in 1821, it now has a population of 114,000.",
      },
      want: "hook-stats-leak",
    },
    {
      name: "hook too short to be a story",
      card: { story: `Old town. ${GEO}`, hookSource: "history", hookText: "Old town." },
      want: "hook-too-short",
    },
    {
      name: "coordinate leak in card text",
      card: {
        story: `${HISTORY} ${GEO} (39.7817° N)`,
        hookSource: "history",
        hookText: HISTORY,
      },
      want: "coordinate-leak",
    },
    {
      name: "empty story",
      card: { story: "  ", hookSource: null, hookText: "" },
      want: "empty-story",
    },
  ];

  for (const b of bad) {
    const r = lintCard(b.card);
    if (r.ok) {
      failures.push(`BAD fixture "${b.name}": linter did NOT bite (expected ${b.want})`);
    } else if (!r.violations.includes(b.want)) {
      failures.push(`BAD fixture "${b.name}": got [${r.violations.join(",")}], want ${b.want}`);
    }
  }

  // Curated-note checks (Tier 2 logic, checkCuratedRecord). Exercised here
  // with a synthetic notes map so the gate stays hermetic — the wiring to
  // the real notable-notes.json is exercised by the chunk audit below.
  const CURATED_GID = "9999999";
  const CURATED_NOTE =
    "In 1969 this fictional town hosted the first interstellar pie contest, judged by visiting astronauts.";
  const fixtureNotes = new Map([[CURATED_GID, CURATED_NOTE]]);

  const curatedGood = [
    {
      name: "curated record with history and clean blurb",
      record: { id: `gn-${CURATED_GID}`, name: "Fixtureton", history: CURATED_NOTE, blurb: GEO },
    },
    {
      name: "non-curated record untouched by curated checks",
      record: { id: "gn-12345", name: "Ordinary", blurb: GEO },
    },
  ];

  for (const f of curatedGood) {
    const r = checkCuratedRecord(f.record, fixtureNotes);
    if (!r.ok) {
      failures.push(`GOOD fixture "${f.name}": curated check failed [${r.violations.join(",")}]`);
    }
  }

  // Deliberately bad curated records — the checks MUST bite on every one.
  const curatedBad = [
    {
      name: "curated ID without history, note embedded in blurb",
      record: { id: `gn-${CURATED_GID}`, name: "Fixtureton", blurb: `${GEO} ${CURATED_NOTE}` },
      want: ["curated-history-missing", "embedded-history-bypass"],
    },
    {
      name: "curated ID without history, clean blurb",
      record: { id: `gn-${CURATED_GID}`, name: "Fixtureton", blurb: GEO },
      want: ["curated-history-missing"],
    },
    {
      name: "curated note duplicated in blurb despite history",
      record: {
        id: `gn-${CURATED_GID}`,
        name: "Fixtureton",
        history: CURATED_NOTE,
        blurb: `${GEO} ${CURATED_NOTE}`,
      },
      want: ["embedded-history-bypass"],
    },
  ];

  for (const b of curatedBad) {
    const r = checkCuratedRecord(b.record, fixtureNotes);
    if (r.ok) {
      failures.push(`BAD fixture "${b.name}": curated check did NOT bite (expected ${b.want.join(",")})`);
    } else {
      for (const w of b.want) {
        if (!r.violations.includes(w)) {
          failures.push(`BAD fixture "${b.name}": missing violation ${w}, got [${r.violations.join(",")}]`);
        }
      }
    }
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Tier 3: BoundedText wrapping-contract gate (WRAPPING_SPEC §6c)
//
// <BoundedText> is the only sanctioned way to render text inside
// `.result-card`. Four sub-checks, all HARD FAIL:
//   3a. No raw block-text JSX in result-card.tsx: every intrinsic
//       <p>/<h1>/<h2>/<h3>/<dd>/<dt>/<pre>/<a> must be a <BoundedText>
//       or match a "raw" registry entry (tag + file). span/div are
//       structural and covered by the runtime closed-world check.
//   3b. No escape hatches at <BoundedText> call sites (result-card.tsx,
//       scroll-cue.tsx, storyteller.tsx): `whitespace-nowrap` / `truncate`
//       classes or `whiteSpace` / `textOverflow` styles fail the build.
//       Registry drift: every "bounded" entry must be used; every call
//       site must carry a registered class.
//   3c. CSS guardrail (§6c.3): within `.result-card` scope, `white-space:
//       nowrap`, `text-overflow: ellipsis`, and `overflow: hidden` on text
//       selectors are forbidden unless the rule carries an
//       `approved-exception` comment linking its evidence test.
//   3d. Flex/grid containers in the card subtree must have shrink
//       allowance (`min-width: 0` / `minmax(0,…)`) — the no-shrink ancestor
//       is text-overflow mode #1. inline-flex shrink-wrappers are exempt.
// ---------------------------------------------------------------------------

/** Intrinsic block-text tags that must go through <BoundedText>. */
const BLOCK_TEXT_TAGS = new Set(["p", "h1", "h2", "h3", "dd", "dt", "pre", "a"]);

const TIER3_FILES = [
  "src/components/result-card.tsx",
  "src/components/scroll-cue.tsx",
  "src/components/storyteller.tsx",
];

function shortPath(abs) {
  return abs.startsWith(REPO + "/") ? abs.slice(REPO.length + 1) : abs;
}

/** Static className of a JSX opening element ("" when dynamic). */
function staticClassName(opening) {
  const attr = opening.attributes.properties.find(
    (p) => p.kind === ts.SyntaxKind.JsxAttribute && p.name.getText() === "className",
  );
  if (!attr || !attr.initializer) return "";
  const init = attr.initializer;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression) {
    const e = init.expression;
    if (ts.isStringLiteral(e)) return e.text;
    if (ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
    if (ts.isTemplateExpression(e)) return e.head.text;
  }
  return "";
}

function tagNameOf(opening) {
  const n = opening.tagName;
  return ts.isIdentifier(n) ? n.text : n.getText();
}

function checkTier3a() {
  const failures = [];
  const src = readFileSync(join(REPO, "src/components/result-card.tsx"), "utf8");
  const sf = ts.createSourceFile("result-card.tsx", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = tagNameOf(node);
      if (BLOCK_TEXT_TAGS.has(tag)) {
        const cls = staticClassName(node);
        const allowed = BOUNDED_TEXT_REGISTRY.some(
          (e) =>
            e.kind === "raw" &&
            e.file === "src/components/result-card.tsx" &&
            e.tag === tag &&
            (e.cls === "" || cls.split(/\s+/).includes(e.cls)),
        );
        if (!allowed) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
          failures.push(
            `Tier 3a: raw <${tag}> text element not via <BoundedText> and not allowlisted ` +
              `(result-card.tsx:${line + 1}, class="${cls}") — render through <BoundedText> or register a raw entry with a reason`,
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return failures;
}

function checkTier3b() {
  const failures = [];
  const usedBounded = new Set();
  for (const f of TIER3_FILES) {
    const abs = join(REPO, f);
    const src = readFileSync(abs, "utf8");
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node) => {
      const isOpen = ts.isJsxOpeningElement(node);
      const isSelf = ts.isJsxSelfClosingElement(node);
      if ((isOpen || isSelf) && tagNameOf(node) === "BoundedText") {
        // Both JsxOpeningElement and JsxSelfClosingElement ARE the tag node.
        const openingEl = node;
        const tagSrc = src.slice(openingEl.getStart(), openingEl.getEnd());
        const { line } = sf.getLineAndCharacterOfPosition(openingEl.getStart());
        const where = `${f}:${line + 1}`;
        if (/whitespace-nowrap/.test(tagSrc)) {
          failures.push(`Tier 3b: ${where} — whitespace-nowrap at a <BoundedText> call site (containment escape hatch refused)`);
        }
        if (/\btruncate\b/.test(tagSrc)) {
          failures.push(`Tier 3b: ${where} — truncate at a <BoundedText> call site (containment escape hatch refused)`);
        }
        if (/whiteSpace\s*:/.test(tagSrc)) {
          failures.push(`Tier 3b: ${where} — whiteSpace style at a <BoundedText> call site (containment escape hatch refused)`);
        }
        if (/textOverflow\s*:/.test(tagSrc)) {
          failures.push(`Tier 3b: ${where} — textOverflow style at a <BoundedText> call site (containment escape hatch refused)`);
        }
        const cls = staticClassName(openingEl).split(/\s+/).filter(Boolean);
        const hits = cls.filter((c) =>
          BOUNDED_TEXT_REGISTRY.some((e) => e.kind === "bounded" && e.cls === c),
        );
        if (hits.length === 0) {
          failures.push(
            `Tier 3b: ${where} — <BoundedText> call site carries no registered class (class="${cls.join(" ") || "(none)"}); register it or it fails the closed-world check`,
          );
        } else {
          for (const h of hits) usedBounded.add(h);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  for (const e of BOUNDED_TEXT_REGISTRY) {
    if (e.kind === "bounded" && !usedBounded.has(e.cls)) {
      failures.push(
        `Tier 3b: registry drift — bounded entry "${e.cls}" (${e.file}) has no <BoundedText> call site; remove the entry or restore the adoption`,
      );
    }
  }
  return failures;
}

/**
 * Minimal CSS parser: returns [{ selector, decls, comment }] with the
 * comment block immediately preceding each rule. @media/@supports nest
 * via recursion (inner rules keep their own preceding comments).
 */
function parseCssRules(css) {
  const rules = [];
  let i = 0;
  const n = css.length;
  let pendingComment = "";
  const skipWs = () => {
    while (i < n && /\s/.test(css[i])) i++;
  };
  while (i < n) {
    skipWs();
    if (i >= n) break;
    if (css.startsWith("/*", i)) {
      const end = css.indexOf("*/", i + 2);
      pendingComment = end < 0 ? css.slice(i) : css.slice(i, end + 2);
      i = end < 0 ? n : end + 2;
      continue;
    }
    // Selector (or at-rule) up to the next "{".
    let selStart = i;
    while (i < n && css[i] !== "{") i++;
    if (i >= n) break;
    const selector = css.slice(selStart, i).trim();
    i++; // past "{"
    // Balanced block.
    let depth = 1;
    const bodyStart = i;
    while (i < n && depth > 0) {
      if (css.startsWith("/*", i)) {
        const end = css.indexOf("*/", i + 2);
        i = end < 0 ? n : end + 2;
        continue;
      }
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    const body = css.slice(bodyStart, i - 1);
    if (/^@/.test(selector)) {
      // Nested at-rule: recurse; inner rules are independent.
      for (const r of parseCssRules(body)) rules.push(r);
    } else if (selector) {
      rules.push({ selector, decls: body, comment: pendingComment });
    }
    pendingComment = "";
  }
  return rules;
}

const normSel = (s) => s.replace(/\s*>\s*/g, ">").replace(/\s+/g, " ").trim();

function inCardScope(selector) {
  return selector.split(",").some((part) => {
    const p = part.trim();
    if (p.includes(".result-card")) return true;
    return CSS_SCOPE_CLASSES.some((c) => new RegExp(`\\.${c}(?![\\w-])`).test(p));
  });
}

function checkTier3c() {
  const failures = [];
  const css = readFileSync(join(REPO, "src/styles.css"), "utf8");
  for (const { selector, decls, comment } of parseCssRules(css)) {
    if (!inCardScope(selector)) continue;
    const declList = decls.split(";").map((d) => d.trim()).filter(Boolean);
    for (const d of declList) {
      const m = d.match(/^([\w-]+)\s*:\s*(.+)$/);
      if (!m) continue;
      const [, prop, value] = m;
      const forbidden =
        (prop === "white-space" && /\bnowrap\b/.test(value)) ||
        (prop === "text-overflow" && /\bellipsis\b/.test(value)) ||
        ((prop === "overflow" || prop === "overflow-x" || prop === "overflow-y") &&
          /\bhidden\b/.test(value));
      if (forbidden && !/approved-exception/.test(comment)) {
        failures.push(
          `Tier 3c: "${selector}" declares ${prop}: ${value} in .result-card scope without an approved-exception comment — wrap, don't clip (WRAPPING_SPEC §6c.3)`,
        );
      }
    }
  }
  return failures;
}

function checkTier3d() {
  const failures = [];
  const css = readFileSync(join(REPO, "src/styles.css"), "utf8");
  const rules = parseCssRules(css).filter((r) => inCardScope(r.selector));
  const hasShrink = (decls) =>
    /min-width\s*:\s*0\b/.test(decls) || /minmax\(\s*0/.test(decls);
  const containers = [];
  for (const { selector, decls } of rules) {
    for (const part of selector.split(",")) {
      const p = normSel(part);
      const displays = [...decls.matchAll(/display\s*:\s*([^;]+)/g)].map((m) => m[1].trim());
      if (displays.some((d) => /^(flex|grid)$/.test(d))) containers.push(p);
    }
  }
  for (const c of [...new Set(containers)]) {
    const covered = rules.some(({ selector, decls }) =>
      selector.split(",").some((part) => {
        const p = normSel(part);
        return (p === c || p.startsWith(c + " ") || p.startsWith(c + ">")) && hasShrink(decls);
      }),
    );
    if (!covered) {
      failures.push(
        `Tier 3d: flex/grid container "${c}" in .result-card scope has no shrink allowance (min-width: 0 / minmax(0,…)) — the no-shrink ancestor is overflow mode #1`,
      );
    }
  }
  return failures;
}

function checkTier3() {
  return [
    ...checkTier3a(),
    ...checkTier3b(),
    ...checkTier3c(),
    ...checkTier3d(),
  ];
}

// ---------------------------------------------------------------------------
// Tier 2: chunk audit (grandfathered)
// ---------------------------------------------------------------------------

function auditChunks(chunksDir) {
  const files = readdirSync(chunksDir).filter((f) => f.endsWith(".json"));
  const curatedNotes = loadCuratedNotes();
  const stats = { total: 0, withHook: 0, hookMissing: 0, legacy: 0, curated: 0 };
  const hardFailures = [];

  for (const file of files) {
    const chunk = JSON.parse(readFileSync(join(chunksDir, file), "utf8"));
    // Facts live in derived per-region indexes now (scripts/facts-ladder.mjs);
    // overlay them so fact-first cards are audited exactly as the runtime renders them.
    const regionId = file.slice(0, -".json".length);
    const factIndex = readFactIndex(regionId);
    const places = (chunk.places ?? []).map((p) =>
      factIndex && p.id && factIndex.facts[p.id] ? withFact(p, factIndex.facts[p.id]) : p,
    );
    for (const p of places) {
      stats.total++;
      // Curated-note checks run FIRST and regardless of grandfathering: an
      // embedded curated note is a pipeline-era record, not legacy backlog.
      const cr = checkCuratedRecord(p, curatedNotes);
      if (!cr.ok) {
        stats.curated++;
        hardFailures.push(
          `${file} ${p.id} (${p.name}): [${cr.violations.join(",")}] — curated notable note must live in \`history\`, never only in the blurb`,
        );
      }
      const hasHookField =
        (typeof p.fact === "string" && p.fact.trim().length > 0) ||
        (p.fact && typeof p.fact === "object") ||
        (typeof p.history === "string" && p.history.trim().length > 0);
      const c = composeCardStory({ fact: p.fact ?? null, history: p.history ?? null, blurb: p.blurb ?? "" });
      if (hasHookField) {
        stats.withHook++;
        const r = lintCard({ story: c.story, hookSource: c.hookSource, hookText: c.hookText, name: p.name });
        if (!r.ok) {
          hardFailures.push(
            `${file} ${p.id} (${p.name}): [${r.violations.join(",")}] — post-pipeline record must obey the card rules`,
          );
        }
      } else if (p.hookMissing === true) {
        stats.hookMissing++;
      } else {
        // Legacy flat blurb: grandfathered. Counted, reported, never failed.
        stats.legacy++;
      }
    }
  }
  return { stats, hardFailures };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const quiet = args.includes("--quiet");
  const dirIdx = args.indexOf("--chunks");
  const chunksDir = dirIdx >= 0 && args[dirIdx + 1] ? args[dirIdx + 1] : join(REPO, "src", "game", "data", "geonames", "chunks");
  const log = quiet ? () => {} : console.log;

  let failed = false;

  // Tier 1.
  const fixtureFailures = checkFixtures();
  if (fixtureFailures.length > 0) {
    failed = true;
    console.error("lint-cards: FIXTURE GATE FAILED");
    for (const f of fixtureFailures) console.error(`  - ${f}`);
  } else {
    log("lint-cards: fixture gate passed (good compose, bad fixtures all caught)");
  }

  // Tier 2.
  const { stats, hardFailures } = auditChunks(chunksDir);
  log(
    `lint-cards: chunk audit — ${stats.total} records: ` +
      `${stats.withHook} with hook, ${stats.hookMissing} hook-missing, ` +
      `${stats.legacy} legacy (grandfathered), ${stats.curated} curated-note violations`,
  );
  if (hardFailures.length > 0) {
    failed = true;
    console.error("lint-cards: CHUNK AUDIT FAILED — post-pipeline records violating the card rules:");
    for (const f of hardFailures.slice(0, 20)) console.error(`  - ${f}`);
    if (hardFailures.length > 20) console.error(`  … and ${hardFailures.length - 20} more`);
  }

  // Tier 3: BoundedText wrapping-contract gate.
  const tier3Failures = checkTier3();
  if (tier3Failures.length > 0) {
    failed = true;
    console.error("lint-cards: TIER 3 (BoundedText contract) FAILED");
    for (const f of tier3Failures) console.error(`  - ${f}`);
  } else {
    log("lint-cards: tier 3 passed (BoundedText-only text, no escape hatches, CSS guardrails, flex shrink allowance)");
  }

  if (failed) {
    console.error("lint-cards: GATE FAILED");
    process.exit(1);
  }
  log("lint-cards: GATE PASSED");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
