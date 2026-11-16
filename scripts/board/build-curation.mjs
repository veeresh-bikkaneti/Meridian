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
import {
  EPICS,
  EXCLUDED_SOURCE_IDS,
  FIRST_TASK_FEATURE,
  LINE_OVERRIDES,
  PHASE,
  PLAYER_TITLES,
} from "./board-v3-data.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => JSON.parse(readFileSync(path.join(repoRoot, p), "utf8"));

const snapshot = read("src/board/snapshot.json");
const migration = read("src/board/migration-table.json");
// Slugs are stable link keys (deep links, the map's bonds): a rebuild
// reuses the slug a story already carries in the committed curation
// file and only derives one for a genuinely new story — a title
// rewrite must never move a story's link.
const prevSlugs = new Map();
try {
  for (const e of read("src/board/curation.json").epics)
    for (const f of e.features) for (const s of f.stories) prevSlugs.set(s.sourceId, s.slug);
} catch {
  /* first build: every slug is derived */
}
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
      // Board v4: the title ALWAYS comes from the player-words mapping
      // in the generation source — never from the snapshot's own
      // (dev-language) title. A story missing from PLAYER_TITLES is a
      // build error, not a fallback.
      const title = PLAYER_TITLES[sourceId];
      if (!title) throw new Error(`no player-words title for story ${sourceId}`);
      const story = {
        sourceId,
        slug: prevSlugs.get(sourceId) ?? uniqueSlug(title),
        title,
        records: snap.prs,
        carriedStatus: carried.get(sourceId),
        ...(PHASE[sourceId] ? { phase: PHASE[sourceId] } : {}),
        ...(LINE_OVERRIDES[sourceId] ? { lineOverride: LINE_OVERRIDES[sourceId] } : {}),
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
const expectedCount = snapshot.stories.length - EXCLUDED_SOURCE_IDS.length;
if (assigned.length !== expectedCount || new Set(assigned).size !== expectedCount) {
  throw new Error(
    `curation must assign each player-visible story exactly once (got ${assigned.length}, want ${expectedCount})`,
  );
}
const missing = snapshot.stories.map((s) => s.id).filter((id) => !assigned.includes(id));
const missingSorted = [...missing].sort();
const excludedSorted = [...EXCLUDED_SOURCE_IDS].sort();
if (JSON.stringify(missingSorted) !== JSON.stringify(excludedSorted)) {
  throw new Error(
    `stories missing from curation must be exactly the v4 exclusion list: ${missing.join(", ")}`,
  );
}

const waits = [];
for (const story of snapshot.stories)
  for (const to of story.waitsOnIds ?? []) waits.push({ from: story.id, to });
if (waits.length !== 8) throw new Error(`waits: ${waits.length} != 8`);

writeFileSync(
  path.join(repoRoot, "src/board/curation.json"),
  JSON.stringify({ epics, waits }, null, 2) + "\n",
);
console.log(
  `build-curation: OK — ${assigned.length} player-visible stories assigned once, ` +
    `${EXCLUDED_SOURCE_IDS.length} internal excluded, 8 waits, first task breakdown: ${FIRST_TASK_FEATURE}`,
);
