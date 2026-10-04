import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { shareScore, sessionShareText, SHARE_URL } from "./share-action.ts";
import { BRAND } from "./brand.ts";
import type { Session, SessionSummary } from "./session.ts";
import {
  bankPlace,
  DIFFICULTY_LABELS,
  formatSuccessRate,
  startSession,
  summarizeSession,
} from "./session.ts";

const ORIGINAL_DESCRIPTOR = Object.getOwnPropertyDescriptor(globalThis, "navigator");

/** `navigator` is a getter-only property on modern Node; stub it via defineProperty. */
function setNavigator(value: unknown): void {
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  if (ORIGINAL_DESCRIPTOR) Object.defineProperty(globalThis, "navigator", ORIGINAL_DESCRIPTOR);
  else delete (globalThis as Record<string, unknown>).navigator;
});

const now = new Date(Date.UTC(2026, 9, 3));

const summary: SessionSummary = {
  totalScore: 12480,
  placesPlayed: 60,
  hits: 45,
  averagePerPlace: 208,
  bestStreak: 14,
  averageDistanceKm: 120,
  bestDistanceKm: 5,
  byEdition: [],
  byDifficulty: [],
  regions: [],
};

describe("shareScore — Web Share path", () => {
  it("calls navigator.share with the exact title/text/url payload", async () => {
    const calls: unknown[] = [];
    setNavigator({
      share: async (payload: unknown) => {
        calls.push(payload);
      },
      clipboard: { writeText: async () => assert.fail("clipboard must not be used") },
    });
    const outcome = await shareScore({
      title: "Meridian score",
      text: "meridian October 3\nhttps://veeresh-bikkaneti.github.io/Meridian/\n1,000 over 5 places · 200 avg/place · Globe",
      url: SHARE_URL,
    });
    assert.equal(outcome, "shared");
    assert.deepEqual(calls, [
      {
        title: "Meridian score",
        text: "meridian October 3\nhttps://veeresh-bikkaneti.github.io/Meridian/\n1,000 over 5 places · 200 avg/place · Globe",
        url: "https://veeresh-bikkaneti.github.io/Meridian/",
      },
    ]);
  });

  it("user-dismissed share sheet (AbortError) reports cancelled and stays quiet", async () => {
    let clipboardCalled = false;
    setNavigator({
      share: async () => {
        throw new DOMException("user dismissed", "AbortError");
      },
      clipboard: {
        writeText: async () => {
          clipboardCalled = true;
        },
      },
    });
    const outcome = await shareScore({ title: "t", text: "x", url: SHARE_URL });
    assert.equal(outcome, "cancelled");
    assert.equal(clipboardCalled, false, "no auto-copy after a user-initiated cancel");
  });

  it("a plain-Error AbortError (non-DOMException, e.g. polyfill/embedded webview) reports cancelled and stays quiet", async () => {
    let clipboardCalled = false;
    const err = new Error("user dismissed");
    err.name = "AbortError";
    assert.ok(!(err instanceof DOMException), "test setup: must be a plain Error");
    setNavigator({
      share: async () => {
        throw err;
      },
      clipboard: {
        writeText: async () => {
          clipboardCalled = true;
        },
      },
    });
    const outcome = await shareScore({ title: "t", text: "x", url: SHARE_URL });
    assert.equal(outcome, "cancelled");
    assert.equal(clipboardCalled, false, "no auto-copy after a user-initiated cancel");
  });

  it("an entirely undefined navigator (SSR guard path) reports failed", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const outcome = await shareScore({ title: "t", text: "the text", url: SHARE_URL });
    assert.equal(outcome, "failed");
  });

  it("a non-abort share failure falls through to the clipboard", async () => {
    const written: string[] = [];
    setNavigator({
      share: async () => {
        throw new Error("not supported for this payload");
      },
      clipboard: {
        writeText: async (text: string) => {
          written.push(text);
        },
      },
    });
    const outcome = await shareScore({ title: "t", text: "the text", url: SHARE_URL });
    assert.equal(outcome, "copied");
    assert.deepEqual(written, ["the text"]);
  });
});

describe("shareScore — clipboard fallback", () => {
  it("writes the exact text when navigator.share is unavailable", async () => {
    const written: string[] = [];
    setNavigator({
      clipboard: {
        writeText: async (text: string) => {
          written.push(text);
        },
      },
    });
    const outcome = await shareScore({ title: "t", text: "the text", url: SHARE_URL });
    assert.equal(outcome, "copied");
    assert.deepEqual(written, ["the text"]);
  });

  it("a rejecting clipboard reports failed", async () => {
    setNavigator({
      clipboard: {
        writeText: async () => {
          throw new DOMException("denied", "NotAllowedError");
        },
      },
    });
    const outcome = await shareScore({ title: "t", text: "the text", url: SHARE_URL });
    assert.equal(outcome, "failed");
  });

  it("a missing clipboard reports failed", async () => {
    setNavigator({});
    const outcome = await shareScore({ title: "t", text: "the text", url: SHARE_URL });
    assert.equal(outcome, "failed");
  });
});

describe("sessionShareText — session payload contract", () => {
  it("shares session totals in Veeresh's approved 3-line format", () => {
    const text = sessionShareText({ summary, regionName: "Nebraska", dateKey: "2026-10-03", now });
    assert.equal(
      text,
      "meridian October 3\nhttps://veeresh-bikkaneti.github.io/Meridian/\n12,480 over 60 places · 208 avg/place · 🔥 14 best streak · Nebraska",
    );
  });

  it("contains the game URL and carries no per-place data", () => {
    const text = sessionShareText({ summary, regionName: "Globe", dateKey: "2026-10-03", now });
    assert.ok(text.includes(BRAND.siteUrl), "payload must carry the game URL");
    // No emoji strip: the session banks totals only, never per-place scores.
    // (`u` flag: without it, the class matches lone surrogates — 🔥's high
    // surrogate collides with 🙂/💨's, giving a false positive.)
    assert.ok(!/[🎯🏆🌟👏🙂💨]/u.test(text), "payload must not include the per-place emoji strip");
    assert.equal(text.split("\n").length, 3, "exactly the approved 3 lines, no strip line");
    // No distances and no place names can leak — this builder never receives them.
    assert.ok(!text.includes("km"), "payload must not include distances");
    assert.ok(!text.includes("Manhattan"), "payload must not include place names");
  });

  it("SHARE_URL is the canonical site URL", () => {
    assert.equal(SHARE_URL, BRAND.siteUrl);
  });
});

describe("sessionShareText — cumulative breakdown", () => {
  const mixed: SessionSummary = {
    totalScore: 473,
    placesPlayed: 12,
    hits: 10,
    averagePerPlace: 39,
    bestStreak: 3,
    averageDistanceKm: 210.5,
    bestDistanceKm: 12,
    byEdition: [],
    byDifficulty: [
      { difficulty: "easy", score: 240, places: 10, hits: 8, rate: 80 },
      { difficulty: "medium", score: 233, places: 2, hits: 2, rate: 100 },
      { difficulty: "hard", score: 0, places: 0, hits: 0, rate: null },
    ],
    regions: [
      { edition: "state", regionId: "ne", regionName: "Nebraska", score: 300, places: 5, hits: 4 },
      { edition: "state", regionId: "tx", regionName: "Texas", score: 173, places: 7, hits: 6 },
    ],
  };

  it("appends one line per played difficulty and one region line, after the 3-line contract", () => {
    const text = sessionShareText({ summary: mixed, regionName: "Nebraska", dateKey: "2026-10-03", now });
    assert.equal(
      text,
      "meridian October 3\n" +
        "https://veeresh-bikkaneti.github.io/Meridian/\n" +
        "473 over 12 places · 39 avg/place · 🔥 3 best streak · Nebraska\n" +
        "Easy 8/10 (80%) · 240 pts\n" +
        "Medium 2/2 (100%) · 233 pts\n" +
        "Nebraska 300 · Texas 173",
    );
  });

  it("omits unplayed difficulty modes — never shows them as 0%", () => {
    const text = sessionShareText({ summary: mixed, regionName: "Nebraska", dateKey: "2026-10-03", now });
    const breakdownLines = text.split("\n").slice(3);
    assert.ok(
      !breakdownLines.some((line) => line.startsWith("Hard ")),
      "unplayed Hard must not appear in the share text",
    );
    assert.ok(!text.includes("(0%)"), "an unplayed mode must never read as 0%");
  });

  it("omits the region line when no region was played", () => {
    const text = sessionShareText({
      summary: { ...mixed, regions: [] },
      regionName: "Nebraska",
      dateKey: "2026-10-03",
      now,
    });
    assert.equal(text.split("\n").length, 5, "3 contract lines + 2 difficulty lines, no region line");
    assert.ok(!text.includes("Nebraska 300"), "no region line without played regions");
  });

  it("breakdown lines add no emoji beyond the contract line's streak flame", () => {
    const text = sessionShareText({ summary: mixed, regionName: "Nebraska", dateKey: "2026-10-03", now });
    const breakdown = text.split("\n").slice(3).join("\n");
    // Emoji / pictograph ranges — the "·", "—" and "%" separators are plain text.
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(breakdown), "breakdown lines must be emoji-free");
  });

  it("consistency invariant: every number in the share text comes from the same SessionSummary", () => {
    // Build a real Session through the public API: mixed difficulties and
    // editions, an unplayed mode (hard), and a replayed region (Canada is
    // banked twice and must accumulate into one first-seen row).
    let session: Session = startSession("2026-10-03", Date.now());
    const bank = (
      edition: "state" | "country" | "globe",
      difficultyChoice: "easy" | "medium" | "hard",
      regionId: string,
      regionName: string,
      score: number,
      hit: boolean,
      streakAfter: number,
    ): void => {
      session = bankPlace(session, {
        edition,
        score,
        hit,
        distanceKm: 50,
        streakAfter,
        difficultyChoice,
        regionId,
        regionName,
      });
    };
    for (let i = 0; i < 8; i++) bank("state", "easy", "ne", "Nebraska", 30, true, i + 1);
    for (let i = 0; i < 2; i++) bank("state", "easy", "ne", "Nebraska", 0, false, 0);
    bank("state", "medium", "tx", "Texas", 150, true, 1);
    bank("state", "medium", "tx", "Texas", 23, false, 0);
    bank("country", "medium", "ca", "Canada", 100, true, 1);
    bank("country", "medium", "ca", "Canada", 73, true, 2);

    const summary = summarizeSession(session);
    const text = sessionShareText({ summary, regionName: "Nebraska", dateKey: "2026-10-03", now });
    const lines = text.split("\n");

    // The approved 3-line contract stays byte-identical for identical inputs.
    assert.equal(
      lines.slice(0, 3).join("\n"),
      `meridian October 3\nhttps://veeresh-bikkaneti.github.io/Meridian/\n` +
        `${summary.totalScore.toLocaleString("en-US")} over ${summary.placesPlayed} places · ` +
        `${summary.averagePerPlace} avg/place · 🔥 ${summary.bestStreak} best streak · Nebraska`,
    );

    // Every played difficulty mode renders its summary numbers verbatim,
    // in easy → medium → hard order; unplayed modes render nothing.
    const played = summary.byDifficulty.filter((m) => m.places > 0);
    const expectedDifficultyLines = played.map(
      (m) =>
        `${DIFFICULTY_LABELS[m.difficulty]} ${m.hits}/${m.places} ` +
        `(${formatSuccessRate(m.hits, m.places)}) · ${m.score.toLocaleString("en-US")} pts`,
    );
    assert.deepEqual(
      lines.filter((l) => /^(Easy|Medium|Hard) \d+\/\d+/.test(l)),
      expectedDifficultyLines,
      "difficulty lines must match the summary's per-mode numbers in order",
    );
    for (const m of summary.byDifficulty) {
      if (m.places === 0) {
        assert.ok(
          !lines.some((l) => l.startsWith(`${DIFFICULTY_LABELS[m.difficulty]} `)),
          `unplayed ${m.difficulty} must not appear in the share text`,
        );
        assert.equal(m.rate, null, "unplayed mode rate stays null in the summary");
      } else {
        assert.equal(
          m.rate,
          Math.round((100 * m.hits) / m.places),
          "played mode rate is the whole-percent hit rate",
        );
      }
    }

    // The region line carries each region's summary score in first-seen
    // order; the replayed region accumulated into a single row.
    assert.deepEqual(
      summary.regions.map((r) => r.regionName),
      ["Nebraska", "Texas", "Canada"],
      "regions stay in first-seen order",
    );
    const canada = summary.regions.find((r) => r.regionId === "ca");
    assert.equal(canada?.places, 2, "replayed region accumulates into one row");
    const expectedRegionLine = summary.regions
      .map((r) => `${r.regionName} ${r.score.toLocaleString("en-US")}`)
      .join(" · ");
    assert.ok(lines.includes(expectedRegionLine), "region line must match the summary's per-region scores");

    // Totals on line 3 are the summary's own totals — nothing recomputed.
    assert.ok(lines[2].includes(summary.totalScore.toLocaleString("en-US")));
    assert.ok(lines[2].includes(`${summary.placesPlayed} places`));
    assert.ok(lines[2].includes(`${summary.averagePerPlace} avg/place`));
  });
});
