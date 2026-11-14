#!/usr/bin/env node
/**
 * Refresh the /board snapshot's two mechanical fields — and nothing else.
 *
 *   git fetch origin   (first: this script reads local git state, it
 *                       never fetches and never writes to git)
 *   node scripts/board/refresh-snapshot.mjs
 *
 * Refreshes ONLY:
 *   - `main`: `git rev-parse --short=8 origin/main` (8 chars, matching
 *     the existing value's style, e.g. "10affd0e"). Fails loudly when
 *     origin/main is unavailable locally.
 *   - `asOf`: "Read from the repo <Mon D, YYYY, h:MM AM/PM Central>",
 *     formatted in America/Chicago via Intl.DateTimeFormat.
 *
 * Everything else — next[], lanes, story titles/status/waitsOn prose/
 * waitsOnIds/owner/prs/inferred, donePath — is hand-written and is
 * preserved. The file is re-serialized as 2-space JSON + a trailing
 * newline, which round-trips the current file byte-for-byte, so the
 * diff stays limited to the two refreshed fields.
 *
 * Story `prs` lists are hand-curated: this script never adds, drops or
 * rewrites an association. It VALIDATES every referenced PR number
 * against the public (unauthenticated) GitHub pulls API.
 *
 * Fail-loud: any validation failure, a missing referenced PR, an
 * unreachable / non-200 GitHub API response, or missing origin/main
 * prints the problem to stderr, exits non-zero and writes NOTHING.
 * On success the write is atomic: snapshot.json.tmp in the same
 * directory, renamed over snapshot.json.
 *
 * No tokens, no secrets, no dependencies — node stdlib + global fetch.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SNAPSHOT_PATH = join(ROOT, "src", "board", "snapshot.json");
const TMP_PATH = `${SNAPSHOT_PATH}.tmp`;
const PULLS_URL =
  "https://api.github.com/repos/veeresh-bikkaneti/Meridian/pulls?state=all&per_page=100&sort=updated";

function fail(message) {
  throw new Error(message);
}

/** "Read from the repo Nov 13, 2026, 5:20 AM Central" (America/Chicago). */
function formatAsOf(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(now);
  const part = (type) => parts.find((p) => p.type === type)?.value;
  return `Read from the repo ${part("month")} ${part("day")}, ${part("year")}, ${part("hour")}:${part("minute")} ${part("dayPeriod")} Central`;
}

function gitMainShort() {
  let out;
  try {
    out = execFileSync("git", ["rev-parse", "--short=8", "origin/main"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    fail("origin/main is unavailable locally — run `git fetch origin` first");
  }
  if (!/^[0-9a-f]{8}$/.test(out)) fail(`unexpected origin/main short SHA: ${JSON.stringify(out)}`);
  return out;
}

/**
 * The buildDependencyEdges rule from src/board/board-data.ts, copied
 * standalone (this script cannot import the .ts module): a story's
 * waitsOn prose naming "PR <n>" depends on every story whose prs list
 * contains <n> (never on itself), deduplicated per (from, to, viaPr).
 */
function buildDependencyEdges(stories) {
  const owners = new Map();
  stories.forEach((story, i) => {
    for (const n of story.prs) owners.set(n, [...(owners.get(n) ?? []), i]);
  });
  const edges = [];
  const seen = new Set();
  stories.forEach((story, to) => {
    const named = new Set([...story.waitsOn.matchAll(/\bPR\s+(\d+)\b/g)].map((m) => Number(m[1])));
    for (const viaPr of [...named].sort((a, b) => a - b)) {
      for (const from of owners.get(viaPr) ?? []) {
        const key = `${from}->${to}:${viaPr}`;
        if (from === to || seen.has(key)) continue;
        seen.add(key);
        edges.push({ from, to, viaPr });
      }
    }
  });
  return edges.sort((a, b) => a.to - b.to || a.from - b.from || a.viaPr - b.viaPr);
}

/** Structural + dependency validation mirroring the snapshot tests. */
function validateSnapshot(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    fail("snapshot.json: top level is not a JSON object");
  }
  for (const key of ["asOf", "main", "next", "lanes", "stories", "donePath"]) {
    if (!(key in data)) fail(`snapshot.json: missing top-level key "${key}"`);
  }
  if (typeof data.asOf !== "string" || typeof data.main !== "string") {
    fail("snapshot.json: asOf and main must be strings");
  }
  if (!Array.isArray(data.next) || !Array.isArray(data.donePath)) {
    fail("snapshot.json: next and donePath must be arrays");
  }
  if (!Array.isArray(data.lanes) || data.lanes.length === 0) {
    fail("snapshot.json: lanes must be a non-empty array");
  }
  if (!Array.isArray(data.stories) || data.stories.length === 0) {
    fail("snapshot.json: stories must be a non-empty array");
  }
  for (const lane of data.lanes) {
    if (typeof lane?.name !== "string" || typeof lane?.note !== "string") {
      fail("snapshot.json: every lane needs a string name and note");
    }
  }
  const allIds = new Set(data.stories.map((s) => s?.id));
  const ids = new Set();
  for (const story of data.stories) {
    if (typeof story?.id !== "string" || story.id.length === 0) {
      fail(`snapshot.json: a story has no non-empty string id (title: ${story?.title})`);
    }
    if (ids.has(story.id)) fail(`snapshot.json: duplicate story id "${story.id}"`);
    ids.add(story.id);
    if (typeof story.lane !== "string" || typeof story.title !== "string") {
      fail(`snapshot.json: story "${story.id}" needs string lane and title`);
    }
    if (!["not-started", "in-progress", "done"].includes(story.status)) {
      fail(`snapshot.json: story "${story.id}" has invalid status ${JSON.stringify(story.status)}`);
    }
    if (typeof story.waitsOn !== "string" || !Array.isArray(story.waitsOnIds)) {
      fail(`snapshot.json: story "${story.id}" needs string waitsOn and array waitsOnIds`);
    }
    if (!Array.isArray(story.prs)) fail(`snapshot.json: story "${story.id}" prs is not an array`);
    for (const n of story.prs) {
      if (!Number.isInteger(n) || n <= 0) {
        fail(`snapshot.json: story "${story.id}" has a non-positive-integer PR entry: ${JSON.stringify(n)}`);
      }
    }
    for (const id of story.waitsOnIds) {
      if (!allIds.has(id)) {
        fail(`snapshot.json: story "${story.id}" waitsOnIds references unknown id "${id}"`);
      }
    }
  }
  // waitsOnIds must be exactly the buildDependencyEdges result, in
  // snapshot order — the same invariant board-data.test.ts asserts.
  const edges = buildDependencyEdges(data.stories);
  data.stories.forEach((story, to) => {
    const expected = [...new Set(edges.filter((e) => e.to === to).map((e) => data.stories[e.from].id))].sort(
      (a, b) => data.stories.findIndex((x) => x.id === a) - data.stories.findIndex((x) => x.id === b),
    );
    if (JSON.stringify(story.waitsOnIds) !== JSON.stringify(expected)) {
      fail(
        `snapshot.json: story "${story.id}" waitsOnIds ${JSON.stringify(story.waitsOnIds)} ` +
          `are inconsistent with the PR-naming rule (expected ${JSON.stringify(expected)})`,
      );
    }
  });
}

/** Page the public pulls API until a short page; any failure is fatal. */
async function fetchAllPulls() {
  const byNumber = new Map();
  for (let page = 1; ; page += 1) {
    let res;
    try {
      res = await fetch(`${PULLS_URL}&page=${page}`, {
        headers: { accept: "application/vnd.github+json" },
      });
    } catch (err) {
      fail(`GitHub pulls API unreachable (page ${page}): ${err.message}`);
    }
    if (!res.ok) fail(`GitHub pulls API returned ${res.status} (page ${page}) — not refreshing`);
    const payload = await res.json().catch(() => null);
    if (!Array.isArray(payload)) fail(`GitHub pulls API page ${page} was not a JSON array`);
    for (const item of payload) {
      if (typeof item?.number !== "number") continue;
      byNumber.set(item.number, {
        state: item.state,
        merged: typeof item.merged_at === "string" && item.merged_at.length > 0,
      });
    }
    if (payload.length < 100) return byNumber;
  }
}

async function main() {
  let data;
  try {
    data = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  } catch (err) {
    fail(`cannot read/parse ${SNAPSHOT_PATH}: ${err.message}`);
  }
  validateSnapshot(data);

  const oldMain = data.main;
  const newMain = gitMainShort();

  const pulls = await fetchAllPulls();
  const referenced = [...new Set(data.stories.flatMap((s) => s.prs))].sort((a, b) => a - b);
  const missing = referenced.filter((n) => !pulls.has(n));
  if (missing.length > 0) {
    fail(`referenced PR(s) not found in the GitHub pulls payload: ${missing.join(", ")}`);
  }
  const counts = { open: 0, merged: 0, closed: 0 };
  for (const n of referenced) {
    const pr = pulls.get(n);
    if (pr.state === "open") counts.open += 1;
    else if (pr.merged) counts.merged += 1;
    else counts.closed += 1;
  }

  data.main = newMain;
  data.asOf = formatAsOf();

  try {
    writeFileSync(TMP_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    renameSync(TMP_PATH, SNAPSHOT_PATH);
  } catch (err) {
    rmSync(TMP_PATH, { force: true });
    fail(`atomic write failed: ${err.message}`);
  }

  console.log(`main: ${oldMain} -> ${newMain}`);
  console.log(`asOf: ${data.asOf}`);
  console.log(
    `${data.stories.length} stories, ${referenced.length} referenced PRs verified ` +
      `(${counts.open} open / ${counts.merged} merged / ${counts.closed} closed-unmerged)`,
  );
}

main().catch((err) => {
  rmSync(TMP_PATH, { force: true });
  console.error(`refresh-snapshot: ${err.message}`);
  process.exit(1);
});
