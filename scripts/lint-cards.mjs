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
 *   TIER 2 — chunk audit (HARD FAIL only on post-pipeline records). Every
 *   shipped chunk record is composed and linted, but failures are hard
 *   errors ONLY when the record carries a `fact` or `history` field — i.e.
 *   it went through the enrichment/fact-ladder pipeline and must obey the
 *   rules. Records are otherwise classified, never failed:
 *     - hookMissing: true → "awaiting hook" (informational; the on-main
 *       Nano fallback covers the runtime gap).
 *     - no hook fields, no marker → LEGACY, grandfathered. Counted and
 *       reported, never failed. These are the 119k flat blurbs; they age
 *       out as enrichment/fact-ladder runs cover them.
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
 * Usage: node scripts/lint-cards.mjs [--chunks <dir>] [--quiet]
 * Exit 0 when the gate passes; exit 1 with violation details otherwise.
 * Node stdlib only.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { composeCardStory, factText, lintCard } from "./card-compose.mjs";

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

  return failures;
}

// ---------------------------------------------------------------------------
// Tier 2: chunk audit (grandfathered)
// ---------------------------------------------------------------------------

function auditChunks(chunksDir) {
  const files = readdirSync(chunksDir).filter((f) => f.endsWith(".json"));
  const stats = { total: 0, withHook: 0, hookMissing: 0, legacy: 0 };
  const hardFailures = [];

  for (const file of files) {
    const chunk = JSON.parse(readFileSync(join(chunksDir, file), "utf8"));
    for (const p of chunk.places ?? []) {
      stats.total++;
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
      `${stats.withHook} with hook, ${stats.hookMissing} hook-missing, ${stats.legacy} legacy (grandfathered)`,
  );
  if (hardFailures.length > 0) {
    failed = true;
    console.error("lint-cards: CHUNK AUDIT FAILED — post-pipeline records violating the card rules:");
    for (const f of hardFailures.slice(0, 20)) console.error(`  - ${f}`);
    if (hardFailures.length > 20) console.error(`  … and ${hardFailures.length - 20} more`);
  }

  if (failed) {
    console.error("lint-cards: GATE FAILED");
    process.exit(1);
  }
  log("lint-cards: GATE PASSED");
}

main();
