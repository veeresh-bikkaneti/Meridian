#!/usr/bin/env node
/**
 * Board v3 — build src/board/curation.json from the snapshot, the
 * reconciliation outputs, and the curation data (board-v3-data.mjs).
 *
 * The curation file is the PRIVATE writing surface (spec §6): story
 * source ids, work records and hidden tasks live here and are never
 * published — publish-status.mjs emits only the sanitised file.
 * Run reconcile-v3.mjs first.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EPICS, FIRST_TASK_FEATURE, PHASE, TITLE_FIX } from "./board-v3-data.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => JSON.parse(readFileSync(path.join(repoRoot, p), "utf8"));

const snapshot = read("src/board/snapshot.json");
const migration = read("src/board/migration-table.json");
const byId = new Map(snapshot.stories.map((s) => [s.id, s]));
const carried = new Map(migration.stories.map((r) => [r.id, r.carriedStatus]));

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const usedSlugs = new Set();
function uniqueSlug(title) {
  let slug = slugify(title);
  let n = 2;
  while (usedSlugs.has(slug)) slug = `${slugify(title)}-${n++}`;
  usedSlugs.add(slug);
  return slug;
}

const epics = EPICS.map((epic) => ({
  id: epic.id,
  name: epic.name,
  color: epic.color,
  features: epic.features.map((feature) => ({
    id: feature.id,
    name: feature.name,
    promise: feature.promise,
    anim: feature.anim,
    stories: feature.stories.map((sourceId) => {
      const snap = byId.get(sourceId);
      if (!snap) throw new Error(`curation references unknown story ${sourceId}`);
      const title = TITLE_FIX[sourceId] ?? snap.title;
      const story = {
        sourceId,
        slug: uniqueSlug(title),
        title,
        records: snap.prs,
        carriedStatus: carried.get(sourceId),
        ...(PHASE[sourceId] ? { phase: PHASE[sourceId] } : {}),
      };
      // First feature broken down into hidden tasks (Phase 1): one task
      // per work record, each done exactly when its record is merged.
      // All three stories are carried Done and every record is merged,
      // so the breakdown reproduces their status at handover (§6).
      if (feature.id === FIRST_TASK_FEATURE && snap.prs.length > 0) {
        story.tasks = snap.prs.map((n) => ({
          title: `Pull request ${n}`,
          phase: "Checking",
          record: n,
        }));
      }
      return story;
    }),
  })),
}));

const assigned = epics.flatMap((e) => e.features.flatMap((f) => f.stories.map((s) => s.sourceId)));
if (assigned.length !== 46 || new Set(assigned).size !== 46) {
  throw new Error(`curation must assign each of the 46 stories exactly once (got ${assigned.length})`);
}
const missing = snapshot.stories.map((s) => s.id).filter((id) => !assigned.includes(id));
if (missing.length > 0) throw new Error(`stories missing from curation: ${missing.join(", ")}`);

const waits = [];
for (const story of snapshot.stories)
  for (const to of story.waitsOnIds ?? []) waits.push({ from: story.id, to });
if (waits.length !== 8) throw new Error(`waits: ${waits.length} != 8`);

writeFileSync(
  path.join(repoRoot, "src/board/curation.json"),
  JSON.stringify({ epics, waits }, null, 2) + "\n",
);
console.log(`build-curation: OK — 46 stories assigned once, 8 waits, first task breakdown: ${FIRST_TASK_FEATURE}`);
