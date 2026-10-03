// seed-proof.mjs — prove the GeoDetective clue pipeline on the 12 seed sets.
//
// Run from the worktree root:
//   node scripts/clues/seed-proof.mjs [cachePath]
// (cache path also overridable via GEODETECTIVE_CRAWL_CACHE; default is the
// wikipedia-crawl worktree's crawl cache, which is READ-ONLY reference —
// this script never writes to it and never copies extract text anywhere.)
//
// Method:
//   - Seed inputs are read, unmodified, from origin/feat/meridian-loop via
//     `git show` (scripts/loop-seed.json + public/loop/clues/0..11.json).
//   - Pass 1 (strict production validation): each raw seed clue file is run
//     through the imported validateClueSet() exactly as shipped. The seeds
//     are old-schema placeholders, so schema rejections are EXPECTED.
//   - Pass 2 (content-only): the pass-1 reasons are filtered to the
//     content-code classes (NAME_LEAK, TIER1_COORDS, CLIMATE_*,
//     READING_LEVEL, CLUE_TOO_LONG, SENTENCE_TOO_LONG) so the report
//     separates "old schema" failures from actual content failures.
//   - Pass 3 (composer pipeline): each seed's extract is looked up in the
//     real crawl cache via the composer. For seeds with a matched extract,
//     runComposer() is exercised with the seed's own clue texts as candidate
//     drafts and the clue texts themselves as the snippets — hand-written
//     paraphrases are not verbatim extract spans, so SOURCE_UNTRACEABLE
//     rejections are the expected, honest fail-closed outcome. Difficulty
//     and aliases are deliberately omitted, which also exercises the
//     DIFFICULTY_MISSING / ALIASES_MISSING rejections. No snippets are
//     mined or invented to force a pass.
//
// Output: scripts/clues/seed-proof-report.md (ids / titles / statuses /
// reason codes only — NO extract text) plus a summary on stdout.
// Exit code: 0 even when every set is rejected (rejection is data);
// non-zero only on runner errors.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadCacheExtract, runComposer } from "./compose-clues.mjs";
import { validateClueSet } from "./validate-clues.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const REPORT_PATH = fileURLToPath(new URL("./seed-proof-report.md", import.meta.url));
const SEED_REF = "origin/feat/meridian-loop";

const DEFAULT_CACHE_PATH = join(
  homedir(),
  "workspace/meridian-worktrees/wikipedia-crawl/.scratch/wikipedia-enrichment/crawl-cache.jsonl",
);
const cachePath = process.argv[2] ?? process.env.GEODETECTIVE_CRAWL_CACHE ?? DEFAULT_CACHE_PATH;

// Content-code classes for Pass 2 (everything else in Pass 1 is schema /
// structural). Per the proof spec, exactly these classes count as content:
// NAME_LEAK, TIER1_COORDS, CLIMATE_*, READING_LEVEL, CLUE_TOO_LONG,
// SENTENCE_TOO_LONG.
function isContentCode(code) {
  return (
    code === "NAME_LEAK" ||
    code === "TIER1_COORDS" ||
    code.startsWith("CLIMATE_") ||
    code === "READING_LEVEL" ||
    code === "CLUE_TOO_LONG" ||
    code === "SENTENCE_TOO_LONG"
  );
}

function gitShow(path) {
  return execFileSync("git", ["show", `${SEED_REF}:${path}`], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

function codesOf(reasons) {
  return (reasons ?? []).map((r) => r.code);
}

function uniqueInOrder(values) {
  return [...new Set(values)];
}

function histogram(codeLists) {
  const counts = new Map();
  for (const codes of codeLists) {
    for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  // Deterministic: count descending, then code ascending.
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
  );
}

function todayLocal() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function main() {
  const seedDoc = JSON.parse(gitShow("scripts/loop-seed.json"));
  const seeds = seedDoc.seeds;
  if (!Array.isArray(seeds) || seeds.length !== 12) {
    throw new Error(`expected 12 seeds in loop-seed.json, found ${seeds?.length}`);
  }

  const rows = [];

  seeds.forEach((seed, index) => {
    const clueFile = JSON.parse(gitShow(`public/loop/clues/${index}.json`));
    const bannedTerms = [...(seed.banned ?? []), ...(seed.eponyms ?? [])];

    // Pass 1 — strict production validation of the raw seed file.
    const pass1 = validateClueSet(clueFile, {
      placeName: seed.place,
      bannedTerms,
      extractText: undefined,
    });
    const pass1Codes = uniqueInOrder(codesOf(pass1.reasons));

    // Pass 2 — content-only view of the same reasons.
    const contentCodes = uniqueInOrder(codesOf(pass1.reasons).filter(isContentCode));

    // Pass 3 — composer pipeline against the real crawl cache.
    const extracted = loadCacheExtract(cachePath, seed.geonamesId);
    let cacheStatus;
    let composerOutcome;
    let composerCodes = [];
    if (!extracted.ok) {
      cacheStatus =
        extracted.code === "EXTRACT_STATUS"
          ? extracted.detail
          : extracted.code === "EXTRACT_EMPTY"
            ? "matched (empty extract)"
            : "absent";
      composerOutcome = `not run — extract stage: ${extracted.code}`;
    } else {
      cacheStatus = "matched";
      const result = runComposer(
        {
          geonamesId: seed.geonamesId,
          placeName: seed.place,
          placeId: clueFile.placeId,
          target: clueFile.target,
          sourceHref: seed.wikipedia,
          // The seed's own clue texts as candidate drafts, with the clue
          // texts themselves as snippets (see header: SOURCE_UNTRACEABLE
          // is the expected honest outcome). Difficulty/aliases omitted.
          clues: clueFile.clues.map((text) => ({ text, snippet: text })),
          bannedTerms,
        },
        { cachePath },
      );
      if (result.stage === "validate") {
        composerCodes = uniqueInOrder(codesOf(result.reasons));
        composerOutcome = result.ok
          ? "accepted"
          : `rejected — ${composerCodes.join(", ") || "(no reason codes)"}`;
      } else {
        composerOutcome = `not validated — ${result.stage} stage: ${result.code}`;
      }
    }

    rows.push({
      index,
      place: seed.place,
      geonamesId: seed.geonamesId,
      cacheStatus,
      pass1Ok: pass1.ok === true,
      pass1Codes,
      pass1AllCodes: codesOf(pass1.reasons),
      contentCodes,
      contentAllCodes: codesOf(pass1.reasons).filter(isContentCode),
      composerOutcome,
      composerCodes,
    });
  });

  // Totals (headline = Pass 1 strict production validation).
  const checked = rows.length;
  const accepted = rows.filter((r) => r.pass1Ok).length;
  const rejected = checked - accepted;
  const pass1Histogram = histogram(rows.map((r) => r.pass1AllCodes));
  const contentSeedCount = rows.filter((r) => r.contentCodes.length > 0).length;
  const contentHistogram = histogram(rows.map((r) => r.contentAllCodes));
  const cacheMatched = rows.filter((r) => r.cacheStatus === "matched").length;
  const composerAccepted = rows.filter((r) => r.composerOutcome === "accepted").length;
  const composerRejected = rows.filter((r) => r.composerOutcome.startsWith("rejected")).length;
  const composerNotRun = checked - composerAccepted - composerRejected;

  const fmtCodes = (codes) => (codes.length ? codes.join(", ") : "—");
  const tableRows = rows
    .map(
      (r) =>
        `| ${r.index} | ${r.place} | ${r.geonamesId} | ${r.cacheStatus} | ${r.pass1Ok ? "accepted" : "rejected"} | ${fmtCodes(r.pass1Codes)} | ${fmtCodes(r.contentCodes)} | ${r.composerOutcome} |`,
    )
    .join("\n");
  const fmtHistogram = (hist) =>
    hist.length ? hist.map(([code, n]) => `| ${code} | ${n} |`).join("\n") : "| — | 0 |";

  const report = `# GeoDetective seed proof — Phase 1

Date: ${todayLocal()} (America/Chicago)

## Method

- Runner: \`node scripts/clues/seed-proof.mjs\` (from the worktree root, branch \`feat/geodetective-clues\`).
- Seed inputs read read-only via \`git show ${SEED_REF}:scripts/loop-seed.json\` and \`git show ${SEED_REF}:public/loop/clues/<i>.json\` for i in 0..11. That branch is never modified.
- Crawl cache (read-only reference, never copied or committed): \`${cachePath}\`
- Pass 1 — strict production validation: each raw seed clue file through \`validateClueSet(set, { placeName, bannedTerms: seed.banned + seed.eponyms, extractText: undefined })\`.
- Pass 2 — content-only view: pass-1 reasons filtered to the content-code classes NAME_LEAK, TIER1_COORDS, CLIMATE_*, READING_LEVEL, CLUE_TOO_LONG, SENTENCE_TOO_LONG, separating content failures from old-schema failures.
- Pass 3 — composer pipeline: \`loadCacheExtract\` / \`runComposer\` against the real cache. For matched seeds, the seed's own clue texts are submitted as candidate drafts with the clue texts themselves as snippets. Hand-written paraphrases are not verbatim extract spans, so SOURCE_UNTRACEABLE is the expected outcome — this exercises the fail-closed path honestly. Difficulty and aliases are omitted, which also exercises those rejections. No snippets were mined or invented to force a pass.
- This report contains no extract text — place names, GeoNames ids, cache statuses, verdicts, and reason codes only.

## Totals

- Checked: ${checked}
- Pass 1 (strict production validation): accepted ${accepted} / rejected ${rejected}
- Pass 2 (content-only): ${contentSeedCount} of ${checked} seeds have at least one content-code reason
- Pass 3 (composer pipeline): cache matched for ${cacheMatched} of ${checked} seeds; composer accepted ${composerAccepted} / rejected ${composerRejected} / not run ${composerNotRun}
${accepted === 0 ? "\n> **0 accepted is the expected honest result.** The 12 seeds are old-schema engineering placeholders (no per-clue sources, no difficulty, no aliases), so strict production validation rejects every one of them. Nothing was adjusted, mined, or invented to force a pass.\n" : ""}
## Per-seed results

| # | Place | GeoNames ID | Cache status | Pass 1 verdict | Pass 1 reason codes | Content-only codes (Pass 2) | Composer outcome (Pass 3) |
| --- | --- | --- | --- | --- | --- | --- | --- |
${tableRows}

## Pass 1 reason-code histogram

| Code | Occurrences |
| --- | --- |
${fmtHistogram(pass1Histogram)}

## Pass 2 content-code histogram

| Code | Occurrences |
| --- | --- |
${fmtHistogram(contentHistogram)}
`;

  writeFileSync(REPORT_PATH, report, "utf8");

  console.log(`seed-proof: checked ${checked} seeds`);
  console.log(`pass 1 (strict production validation): accepted ${accepted} / rejected ${rejected}`);
  console.log(
    `pass 1 reason histogram: ${pass1Histogram.map(([c, n]) => `${c}×${n}`).join(", ") || "(none)"}`,
  );
  console.log(
    `pass 2 (content-only): ${contentSeedCount}/${checked} seeds with content-code reasons`,
  );
  console.log(
    `pass 3 (composer): cache matched ${cacheMatched}/${checked}; accepted ${composerAccepted} / rejected ${composerRejected} / not run ${composerNotRun}`,
  );
  for (const r of rows) {
    console.log(
      `  ${r.index}. ${r.place} (gn-${r.geonamesId}) cache=${r.cacheStatus} pass1=${r.pass1Ok ? "accepted" : "rejected"} [${r.pass1Codes.join(", ")}] content=[${r.contentCodes.join(", ")}] composer: ${r.composerOutcome}`,
    );
  }
  console.log(`report written: ${REPORT_PATH}`);
}

try {
  main();
} catch (err) {
  console.error(`seed-proof runner error: ${err.stack ?? err.message ?? err}`);
  process.exitCode = 1;
}
