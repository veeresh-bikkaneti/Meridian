#!/usr/bin/env node
/**
 * Board v3 Phase 0 — reconciliation (the truth pack).
 *
 * Reconciles src/board/snapshot.json against the captured GitHub API
 * truth (board-v2 live-verify pulls pages: the full 394-PR capture that
 * exposed v2's one-page fetch) and writes:
 *   - src/board/migration-table.json  (per story: snapshot → derived →
 *     carried status, with its record states)
 *   - src/board/record-states.json    (PR number → {merged, open})
 *
 * The derivation is the §6 migration rule (all records merged = done,
 * any open = in progress, otherwise the snapshot status stands).
 * HARD ASSERTS: 46 stories, exactly 8 recorded waits, and the derived
 * picture lands on 20 done / 8 in progress / 18 not started. Any
 * mismatch exits 1 and names the differing stories — the table is
 * never adjusted to fit.
 *
 * Usage: node scripts/board/reconcile-v3.mjs [capturesDir]
 *   capturesDir defaults to ~/workspace/board-v2/live-verify
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const capturesDir = process.argv[2] ?? path.join(homedir(), "workspace/board-v2/live-verify");

const snapshot = JSON.parse(readFileSync(path.join(repoRoot, "src/board/snapshot.json"), "utf8"));

const recordStates = new Map();
for (let i = 1; i <= 10; i++) {
  const file = path.join(capturesDir, `pulls-p${i}.json`);
  if (!existsSync(file)) break;
  for (const pr of JSON.parse(readFileSync(file, "utf8"))) {
    recordStates.set(pr.number, { merged: Boolean(pr.merged_at), open: pr.state === "open" });
  }
}
if (recordStates.size === 0) {
  console.error(`reconcile-v3: no captures found in ${capturesDir}`);
  process.exit(1);
}

function derive(story) {
  if (story.prs.length === 0) return story.status;
  const known = story.prs.map((n) => recordStates.get(n)).filter(Boolean);
  if (known.length === 0) return story.status;
  if (known.some((s) => s.open)) return "in-progress";
  if (known.length === story.prs.length && known.every((s) => s.merged)) return "done";
  return story.status;
}

const counts = { done: 0, "in-progress": 0, "not-started": 0 };
const rows = snapshot.stories.map((story) => {
  const derived = derive(story);
  counts[derived] += 1;
  return {
    id: story.id,
    snapshotStatus: story.status,
    derivedStatus: derived,
    carriedStatus: derived,
    records: story.prs,
    recordStates: Object.fromEntries(
      story.prs.filter((n) => recordStates.has(n)).map((n) => [n, recordStates.get(n)]),
    ),
  };
});
const edges = snapshot.stories.reduce((acc, s) => acc + (s.waitsOnIds ?? []).length, 0);

const problems = [];
if (snapshot.stories.length !== 46) problems.push(`stories: ${snapshot.stories.length} != 46`);
if (edges !== 8) problems.push(`waits: ${edges} != 8`);
if (counts.done !== 20 || counts["in-progress"] !== 8 || counts["not-started"] !== 18) {
  problems.push(
    `derived picture ${counts.done}/${counts["in-progress"]}/${counts["not-started"]} != 20/8/18`,
  );
}
if (problems.length > 0) {
  console.error("reconcile-v3: MISMATCH — " + problems.join("; "));
  for (const r of rows) console.error(`  ${r.id}: ${r.snapshotStatus} -> ${r.derivedStatus}`);
  process.exit(1);
}

writeFileSync(
  path.join(repoRoot, "src/board/migration-table.json"),
  JSON.stringify(
    {
      generatedFrom: "src/board/snapshot.json x board-v2 live-verify captures (394 PRs)",
      counts: { done: 20, inProgress: 8, notStarted: 18, total: 46 },
      waits: 8,
      stories: rows,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  path.join(repoRoot, "src/board/record-states.json"),
  JSON.stringify(Object.fromEntries([...recordStates.entries()].sort((a, b) => a[0] - b[0])), null, 1) +
    "\n",
);
console.log(
  `reconcile-v3: OK — 46 stories, 8 waits, derived 20 done / 8 in progress / 18 not started; ` +
    `${recordStates.size} captured PR states; flips: ` +
    rows.filter((r) => r.snapshotStatus !== r.derivedStatus).map((r) => r.id).join(", "),
);
