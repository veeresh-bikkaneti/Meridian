import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import curationJson from "./curation.json" with { type: "json" };
import recordStatesJson from "./record-states.json" with { type: "json" };
import {
  buildPublished,
  computeLayout,
  deriveFromRecords,
  phaseLineFor,
  scanBanned,
  slugify,
  storyLine,
  storyStatus,
  type Curation,
  type CurationStory,
  type RecordState,
} from "./status-core.ts";

const states = (obj: Record<number, RecordState>) => new Map(Object.entries(obj).map(([k, v]) => [Number(k), v]));
const MERGED = { merged: true, open: false };
const OPEN = { merged: false, open: true };

const story = (over: Partial<CurationStory>): CurationStory => ({
  sourceId: "lane/x",
  slug: "x",
  title: "X",
  records: [],
  carriedStatus: "not-started",
  ...over,
});

describe("deriveFromRecords — the §6 migration rule", () => {
  it("all records merged = done", () => {
    assert.equal(deriveFromRecords([1, 2], states({ 1: MERGED, 2: MERGED }), "not-started"), "done");
  });
  it("any record open = in progress", () => {
    assert.equal(deriveFromRecords([1, 2], states({ 1: MERGED, 2: OPEN }), "not-started"), "in-progress");
  });
  it("a partially-known set cannot prove done — carried status stands", () => {
    assert.equal(deriveFromRecords([1, 2], states({ 1: MERGED }), "in-progress"), "in-progress");
  });
  it("closed-but-unmerged records cannot prove done", () => {
    assert.equal(
      deriveFromRecords([1], states({ 1: { merged: false, open: false } }), "not-started"),
      "not-started",
    );
  });
  it("no records = carried status", () => {
    assert.equal(deriveFromRecords([], states({}), "done"), "done");
  });
});

describe("storyStatus — mechanical closure", () => {
  it("a task-broken story with no task done or open is NOT in progress, whatever was carried", () => {
    const s = story({
      carriedStatus: "in-progress",
      tasks: [{ title: "Pull request 9", phase: "Building", record: 9 }],
    });
    assert.equal(storyStatus(s, states({ 9: { merged: false, open: false } })), "not-started");
  });
  it("done only when every task is done", () => {
    const s = story({
      tasks: [
        { title: "Pull request 1", phase: "Building", record: 1 },
        { title: "Pull request 2", phase: "Checking", record: 2 },
      ],
    });
    assert.equal(storyStatus(s, states({ 1: MERGED, 2: OPEN })), "in-progress");
    assert.equal(storyStatus(s, states({ 1: MERGED, 2: MERGED })), "done");
  });
  it("handover is monotone: a carried-done story whose tasks are all done stays done", () => {
    const s = story({
      carriedStatus: "done",
      tasks: [{ title: "Pull request 1", phase: "Checking", record: 1 }],
    });
    assert.equal(storyStatus(s, states({ 1: MERGED })), "done");
  });
});

describe("phaseLineFor / storyLine — the one line, derived", () => {
  it("phase comes from the earliest unfinished task", () => {
    const s = story({
      tasks: [
        { title: "Pull request 1", phase: "Building", record: 1 },
        { title: "Pull request 2", phase: "Testing", record: 2 },
      ],
    });
    assert.equal(phaseLineFor(s, states({ 1: MERGED, 2: OPEN })), "Testing in progress");
  });
  it("done stories read Ready to play; waiting stories name the story they wait on", () => {
    assert.equal(storyLine("done", "Testing in progress", null), "Ready to play");
    assert.equal(storyLine("not-started", "Still planning", "Steadying the clue card"), "Coming after: Steadying the clue card");
    assert.equal(storyLine("in-progress", "Testing in progress", null), "Testing in progress");
  });
});

describe("scanBanned — the readability law as a check", () => {
  it("catches the v2 failure shapes (this scan FAILS on v2-style content)", () => {
    const v2Style = {
      header: "Live from GitHub · 36 of 36 linked PRs have live state",
      card: "waitsOn: PR 430 first",
      id: "detective-core/clue-pacing-and-one-voice-at-a-time",
      tasks: 12,
      file: "src/board/board-data.ts",
    };
    const found = scanBanned(v2Style).join("\n");
    assert.match(found, /Live from GitHub/);
    assert.match(found, /PR reference/);
    assert.match(found, /waitsOn/);
    assert.match(found, /private field/);
    assert.match(found, /story id/);
  });
  it("passes a clean published shape", () => {
    assert.deepEqual(scanBanned({ title: "Detectives speak one at a time", line: "Testing in progress" }), []);
  });
});

describe("buildPublished on the real curation file (Phase 0 baseline)", () => {
  const curation = curationJson as unknown as Curation;
  const recordStates = new Map(
    Object.entries(recordStatesJson as Record<string, RecordState>).map(([k, v]) => [Number(k), v]),
  );
  const published = buildPublished(curation, recordStates, {
    source: "generated",
    updatedAt: "2026-11-15T00:00:00.000Z",
  });

  it("reproduces the locked migration baseline: 46 stories, 20 / 8 / 18", () => {
    assert.deepEqual(published.counts, { done: 20, inProgress: 8, notStarted: 18, total: 46 });
  });
  it("draws exactly the 8 recorded waits as bonds — never more", () => {
    assert.equal(published.bonds.length, 8);
    assert.equal(curation.waits.length, 8);
  });
  it("publishes no private field and no banned token", () => {
    assert.deepEqual(scanBanned(published), []);
    const raw = JSON.stringify(published);
    assert.ok(!raw.includes("sourceId"), "source ids must not be published");
    assert.ok(!raw.includes("Pull request"), "work records must not be published");
  });
  it("every story carries exactly the public fields", () => {
    for (const epic of published.epics)
      for (const feature of epic.features)
        for (const s of feature.stories)
          assert.deepEqual(
            Object.keys(s).sort(),
            ["comingAfter", "line", "slug", "status", "title"].filter((k) => k in s).sort(),
          );
  });
  it("the committed published file matches a fresh build (no hand edits, no drift)", () => {
    const committed = JSON.parse(
      readFileSync(new URL("../../public/board-status.json", import.meta.url), "utf8"),
    ) as { counts: unknown; bonds: unknown; epics: unknown };
    assert.deepEqual(committed.counts, published.counts);
    assert.deepEqual(committed.bonds, published.bonds);
    assert.deepEqual(committed.epics, published.epics);
  });
  it("layout is precomputed, deterministic and covers every story", () => {
    const a = computeLayout(published);
    const b = computeLayout(published);
    assert.deepEqual(a, b);
    assert.equal(Object.keys(a.positions).length, 46);
  });
});

describe("slugify", () => {
  it("makes human link keys from plain titles", () => {
    assert.equal(slugify("Detectives speak one at a time"), "detectives-speak-one-at-a-time");
  });
});
