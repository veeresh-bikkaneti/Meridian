import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { shareScore, sessionShareText, SHARE_URL } from "./share-action.ts";
import { BRAND } from "./brand.ts";
import type { SessionSummary } from "./session.ts";

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
