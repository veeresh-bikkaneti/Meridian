#!/usr/bin/env node
/**
 * Board v3 — the publisher (spec §6, Option A).
 *
 * Reads the private curation file + record states and writes the
 * SANITISED status file the board reads:
 *   - public/board-status.json            (source: "generated")
 *   - src/board/board-status-fallback.json (source: "manual" — the
 *     bundled fallback in the identical format; the board discloses
 *     whenever it is showing this copy)
 *
 * Run with type stripping so the pure logic is shared with the app:
 *   node --experimental-strip-types scripts/board/publish-status.mjs
 *
 * The banned-token scan runs over the output before anything is
 * written: a task count, record number, story id or any other banned
 * token in the published file fails the publish, loudly.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPublished, scanBanned, scanDevLanguage } from "../../src/board/status-core.ts";
import { EXCLUDED_SLUGS } from "./board-v3-data.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => JSON.parse(readFileSync(path.join(repoRoot, p), "utf8"));

const curation = read("src/board/curation.json");
const recordStates = new Map(
  Object.entries(read("src/board/record-states.json")).map(([n, s]) => [Number(n), s]),
);
const updatedAt = new Date().toISOString();

const generated = buildPublished(curation, recordStates, { source: "generated", updatedAt });
const violations = scanBanned(generated);
if (violations.length > 0) {
  console.error("publish-status: BANNED CONTENT in published file:\n" + violations.join("\n"));
  process.exit(1);
}
// Board v4 player-words law: no dev language in any published title or
// line, and none of the 9 excluded internal items may reappear — a
// future refresh fails loudly here instead of leaking builder words.
const devViolations = scanDevLanguage(generated);
if (devViolations.length > 0) {
  console.error("publish-status: DEV LANGUAGE in published file:\n" + devViolations.join("\n"));
  process.exit(1);
}
const publishedSlugs = generated.epics.flatMap((e) =>
  e.features.flatMap((f) => f.stories.map((s) => s.slug)),
);
const leaked = publishedSlugs.filter((s) => EXCLUDED_SLUGS.includes(s));
if (leaked.length > 0) {
  console.error("publish-status: EXCLUDED internal items published: " + leaked.join(", "));
  process.exit(1);
}
if (generated.bonds.length !== curation.waits.length) {
  console.error(`publish-status: bonds ${generated.bonds.length} != recorded waits ${curation.waits.length}`);
  process.exit(1);
}

writeFileSync(path.join(repoRoot, "public/board-status.json"), JSON.stringify(generated, null, 2) + "\n");
writeFileSync(
  path.join(repoRoot, "src/board/board-status-fallback.json"),
  JSON.stringify({ ...generated, source: "manual" }, null, 2) + "\n",
);
console.log(
  `publish-status: OK — ${generated.counts.total} stories ` +
    `(${generated.counts.done} done / ${generated.counts.inProgress} in progress / ${generated.counts.notStarted} not started), ` +
    `${generated.bonds.length} bonds, banned-token scan clean`,
);
