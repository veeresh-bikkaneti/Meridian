import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import curationJson from "./curation.json" with { type: "json" };
import recordStatesJson from "./record-states.json" with { type: "json" };
import {
  ATOM_RADIUS,
  LABEL_HALF_HEIGHT,
  LABEL_LIFT,
  LABEL_WIDTH,
  buildPublished,
  computeLayout,
  deriveFromRecords,
  phaseLineFor,
  scanBanned,
  scanDevLanguage,
  slugify,
  storyLine,
  storyStatus,
  type Curation,
  type CurationStory,
  type PublishedBoard,
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

describe("scanDevLanguage — the v4 player-words law", () => {
  const boardWith = (title: string, line = "Ready to play"): PublishedBoard =>
    ({
      version: 3,
      source: "generated",
      updatedAt: "2026-11-15T00:00:00.000Z",
      counts: { done: 1, inProgress: 0, notStarted: 0, total: 1 },
      epics: [
        {
          id: "e",
          name: "E",
          color: "#000",
          features: [
            {
              id: "f",
              name: "F",
              promise: "P",
              anim: "star",
              done: 1,
              total: 1,
              bonds: 0,
              stories: [{ slug: "s", title, status: "done", line }],
            },
          ],
        },
      ],
      bonds: [],
    }) as PublishedBoard;

  it("FAILS on the pre-v4 published titles (the dev language Liz flagged)", () => {
    const preV4Titles = [
      "Age groups 7-10, 10-18, 18+ in code",
      "3 unrendered clips: beat-me, win-together, truce-watson",
      "Number strand spec",
      "Science definitions and scene engine spec",
      "Shared voice channel (one speaker at a time)",
      "Truce pennant port",
      "Films (v4, dolly camera)",
      "3D film source files",
      "Journal clips (Stage B video files)",
      "Pair art sheets and endings",
      "Social studies and GK screens",
      "Maths sign-off and release",
    ];
    for (const t of preV4Titles)
      assert.ok(scanDevLanguage(boardWith(t)).length > 0, `expected a violation for: ${t}`);
  });
  it("passes every v4 player title and line (no false positives)", () => {
    const curation = curationJson as unknown as Curation;
    const recordStates = new Map(
      Object.entries(recordStatesJson as Record<string, RecordState>).map(([k, v]) => [Number(k), v]),
    );
    const published = buildPublished(curation, recordStates, {
      source: "generated",
      updatedAt: "2026-11-15T00:00:00.000Z",
    });
    assert.deepEqual(scanDevLanguage(published), []);
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

  it("reproduces the player-visible baseline: 37 stories, 20 / 4 / 13", () => {
    // 20/4/13 is the current-state picture after the record cache caught
    // up with main (PR #430 merged; the Holmes-in-Maths and Maths
    // sign-off stories' work landed) — board cleanup, 2026-11-16.
    assert.deepEqual(published.counts, { done: 24, inProgress: 4, notStarted: 9, total: 37 });
  });
  it("excludes the 9 internal items and the whole Behind the Scenes epic", () => {
    const slugs = published.epics.flatMap((e) => e.features.flatMap((f) => f.stories.map((s) => s.slug)));
    for (const slug of [
      "fix-for-how-the-site-goes-live",
      "subject-registry",
      "lean-test-strategy",
      "model-neutral-agent-rules",
      "scale-play-mockup",
      "scale-play-v2-plan",
      "the-same-tools-working-on-windows",
      "turn-the-stream-safety-rules-back-on",
      "open-pieces-of-real-work-not-yet-placed",
    ])
      assert.ok(!slugs.includes(slug), `excluded item published: ${slug}`);
    assert.ok(!published.epics.some((e) => e.id === "behind"), "Behind the Scenes must not publish");
    assert.equal(published.epics.length, 4);
  });
  it("carries the v4 line overrides (Drawing in progress; Finished, not Ready to play)", () => {
    const bySlug = new Map(
      published.epics.flatMap((e) =>
        e.features.flatMap((f) => f.stories.map((s) => [s.slug, s] as const)),
      ),
    );
    assert.equal(bySlug.get("pair-art-sheets-and-endings")?.line, "Drawing in progress");
    assert.equal(bySlug.get("religious-journal-movies-hidden")?.line, "Finished");
    // Current state (board cleanup, 2026-11-16): every recorded wait
    // is satisfied — clue pacing and the voice channel are done — so
    // no story carries a "Coming after" line today. The truce flag
    // simply hasn't started; its bonds stand in the data for when a
    // wait binds again (the waiting derivation itself is covered by
    // the deriveFromRecords suites above).
    assert.equal(bySlug.get("truce-pennant-port")?.line, "Not started yet");
    assert.equal(bySlug.get("truce-pennant-port")?.comingAfter, undefined);
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
    assert.equal(Object.keys(a.positions).length, 37);
  });
});

describe("structure-view feature labels clear every atom (item 29)", () => {
  const curation = curationJson as unknown as Curation;
  const recordStates = new Map(
    Object.entries(recordStatesJson as Record<string, RecordState>).map(([k, v]) => [Number(k), v]),
  );
  const published = buildPublished(curation, recordStates, {
    source: "generated",
    updatedAt: "2026-11-15T00:00:00.000Z",
  });
  const layout = computeLayout(published);

  it("every chip's bottom edge sits above the highest atom top in its bubble", () => {
    for (const epic of published.epics) {
      for (const feature of epic.features) {
        const c = layout.featureCenters[feature.id];
        const radius = layout.featureRadii[feature.id];
        const chipBottom = c[1] + radius + LABEL_LIFT - LABEL_HALF_HEIGHT;
        for (const s of feature.stories) {
          const atomTop = layout.positions[s.slug][1] + ATOM_RADIUS;
          assert.ok(
            chipBottom > atomTop,
            `${feature.name}: chip bottom ${chipBottom.toFixed(2)} must clear atom top ${atomTop.toFixed(2)} (${s.slug})`,
          );
        }
      }
    }
  });

  it("the label material never lets an atom clip the chip (depthTest off)", () => {
    const map = readFileSync(new URL("./molecule-map.tsx", import.meta.url), "utf8");
    assert.match(map, /SpriteMaterial\(\{[^}]*depthTest: false/);
    assert.match(map, /LABEL_LIFT/);
  });

  it("no chip's 3D bounding box overlaps any atom's 3D bounding box", () => {
    // Boxes on the 3D label layer: the chip is LABEL_WIDTH wide and
    // LABEL_HALF_HEIGHT * 2 tall around its sprite centre (the scale
    // molecule-map sets), in the plane z = feature centre z; an atom's
    // box is its centre ± ATOM_RADIUS on all three axes. Every chip is
    // checked against EVERY atom — a tall neighbour bubble's atom can
    // reach into a chip's x/y span, which the own-bubble clearance
    // above cannot see; only the z axis separates that pair today
    // (measured: the one x/y-crossing pair sits ~5 units apart in z),
    // and this test fails if a layout change ever closes that gap.
    type Box = { min: number[]; max: number[] };
    const overlaps = (a: Box, b: Box) =>
      a.min[0] < b.max[0] && a.max[0] > b.min[0] &&
      a.min[1] < b.max[1] && a.max[1] > b.min[1] &&
      a.min[2] < b.max[2] && a.max[2] > b.min[2];
    for (const epic of published.epics) {
      for (const feature of epic.features) {
        const c = layout.featureCenters[feature.id];
        const radius = layout.featureRadii[feature.id];
        const chip: Box = {
          min: [c[0] - LABEL_WIDTH / 2, c[1] + radius + LABEL_LIFT - LABEL_HALF_HEIGHT, c[2]],
          max: [c[0] + LABEL_WIDTH / 2, c[1] + radius + LABEL_LIFT + LABEL_HALF_HEIGHT, c[2]],
        };
        for (const otherEpic of published.epics) {
          for (const other of otherEpic.features) {
            for (const s of other.stories) {
              const p = layout.positions[s.slug];
              const atom: Box = {
                min: [p[0] - ATOM_RADIUS, p[1] - ATOM_RADIUS, p[2] - ATOM_RADIUS],
                max: [p[0] + ATOM_RADIUS, p[1] + ATOM_RADIUS, p[2] + ATOM_RADIUS],
              };
              assert.ok(
                !overlaps(chip, atom),
                `${feature.name}: chip box x[${chip.min[0].toFixed(2)}..${chip.max[0].toFixed(2)}] y[${chip.min[1].toFixed(2)}..${chip.max[1].toFixed(2)}] z=${chip.min[2].toFixed(2)} overlaps atom ${s.slug} (${other.name}) box x[${atom.min[0].toFixed(2)}..${atom.max[0].toFixed(2)}] y[${atom.min[1].toFixed(2)}..${atom.max[1].toFixed(2)}] z[${atom.min[2].toFixed(2)}..${atom.max[2].toFixed(2)}]`,
              );
            }
          }
        }
      }
    }
  });
});

describe("one name for the feature-request action (item 28)", () => {
  it("no player surface still calls it “Send a tip”", () => {
    for (const rel of ["../routes/board.tsx", "./feature-request-form.tsx"]) {
      const src = readFileSync(new URL(rel, import.meta.url), "utf8");
      assert.ok(!src.includes("Send a tip"), `${rel} still says “Send a tip”`);
      assert.ok(src.includes("Ask for something new"), `${rel} lost the shared name`);
    }
  });
});

describe("slugify", () => {
  it("makes human link keys from plain titles", () => {
    assert.equal(slugify("Detectives speak one at a time"), "detectives-speak-one-at-a-time");
  });
});
