import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  isJournalPrefetchAllowed,
  resolveJournalPrefetchUrls,
  selectJournalPrefetchNoteIds,
  startJournalPrefetch,
  warmJournalMovie,
  JOURNAL_PREFETCH_MAX_CONCURRENT,
  JOURNAL_PREFETCH_MAX_ENTRIES,
} from "./journal-prefetch.ts";
import type { JournalMovieManifest } from "./journal-movies.ts";

const REAL_MANIFEST = JSON.parse(
  readFileSync("public/videos/journal-manifest.json", "utf8"),
) as JournalMovieManifest;

// --- Gating: Save-Data / slow effective type skips, fail-open ----------

test("isJournalPrefetchAllowed skips under Save-Data or slow-2g/2g", () => {
  assert.equal(isJournalPrefetchAllowed({ saveData: true, effectiveType: "4g" }), false);
  assert.equal(isJournalPrefetchAllowed({ saveData: false, effectiveType: "slow-2g" }), false);
  assert.equal(isJournalPrefetchAllowed({ saveData: false, effectiveType: "2g" }), false);
  assert.equal(isJournalPrefetchAllowed({ saveData: true, effectiveType: "slow-2g" }), false);
});

test("isJournalPrefetchAllowed allows fast connections and absent APIs (fail-open)", () => {
  assert.equal(isJournalPrefetchAllowed({ saveData: false, effectiveType: "4g" }), true);
  assert.equal(isJournalPrefetchAllowed({ saveData: false, effectiveType: "3g" }), true);
  assert.equal(isJournalPrefetchAllowed({}), true);
  assert.equal(isJournalPrefetchAllowed(null), true);
  assert.equal(isJournalPrefetchAllowed(undefined), true);
});

test("isJournalPrefetchAllowed fails open when the connection object throws", () => {
  const throwing = new Proxy(
    {},
    {
      get() {
        throw new Error("boom");
      },
    },
  ) as unknown as { saveData?: boolean };
  assert.equal(isJournalPrefetchAllowed(throwing), true);
});

// --- Entry selection: first 1–2 in set order, skips playing + warmed --

test("selectJournalPrefetchNoteIds takes the first two in set order", () => {
  assert.deepEqual(
    selectJournalPrefetchNoteIds(["a", "b", "c"]),
    ["a", "b"],
  );
  assert.equal(JOURNAL_PREFETCH_MAX_ENTRIES, 2);
});

test("selectJournalPrefetchNoteIds skips the playing entry and warmed ids", () => {
  assert.deepEqual(
    selectJournalPrefetchNoteIds(["a", "b", "c"], {
      playingJournalId: "a",
      warmedIds: new Set(["b"]),
    }),
    ["c"],
  );
  assert.deepEqual(
    selectJournalPrefetchNoteIds(["a", "b", "c"], { playingJournalId: "b" }),
    ["a", "c"],
  );
});

test("selectJournalPrefetchNoteIds handles the 1-note set and empty sets", () => {
  assert.deepEqual(selectJournalPrefetchNoteIds(["galapagos"]), ["galapagos"]);
  assert.deepEqual(selectJournalPrefetchNoteIds(["galapagos"], { playingJournalId: "galapagos" }), []);
  assert.deepEqual(selectJournalPrefetchNoteIds([]), []);
  assert.deepEqual(selectJournalPrefetchNoteIds(["a", "a", "b"]), ["a", "b"]);
});

test("selectJournalPrefetchNoteIds honours an explicit limit", () => {
  assert.deepEqual(selectJournalPrefetchNoteIds(["a", "b", "c"], { limit: 1 }), ["a"]);
});

// --- URL resolution: manifest ids map, unknown ids drop out -------------

test("resolveJournalPrefetchUrls maps the first two real ids to their clips", () => {
  const ids = ["old-faithful", "southpointe", "alamo"];
  const entries = resolveJournalPrefetchUrls(REAL_MANIFEST, ids);
  assert.deepEqual(entries, [
    {
      noteId: "old-faithful",
      url: "https://veeresh-bikkaneti.github.io/meridian-media/journal/old-faithful.mp4",
    },
    {
      noteId: "southpointe",
      url: "https://veeresh-bikkaneti.github.io/meridian-media/journal/southpointe.mp4",
    },
  ]);
});

test("resolveJournalPrefetchUrls drops ids with no movie and a null manifest", () => {
  assert.deepEqual(resolveJournalPrefetchUrls(REAL_MANIFEST, ["no-such-place", "alamo"]), [
    {
      noteId: "alamo",
      url: "https://veeresh-bikkaneti.github.io/meridian-media/journal/alamo.mp4",
    },
  ]);
  assert.deepEqual(resolveJournalPrefetchUrls(null, ["old-faithful"]), []);
});

// --- Warm: CORS fetch + drain, never throws ------------------------------

test("warmJournalMovie fetches CORS/omit with the signal and drains the body", async () => {
  const seen: Array<{ url: string; init: unknown }> = [];
  let drained = false;
  const fetchImpl = async (url: string, init: { mode: string; credentials: string; signal?: AbortSignal }) => {
    seen.push({ url, init });
    return {
      ok: true,
      arrayBuffer: async () => {
        drained = true;
        return new ArrayBuffer(8);
      },
    };
  };
  const signal = new AbortController().signal;
  assert.equal(
    await warmJournalMovie("https://example.invalid/x.mp4", fetchImpl, signal),
    true,
  );
  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.url, "https://example.invalid/x.mp4");
  assert.equal((seen[0]!.init as { mode: string }).mode, "cors");
  assert.equal((seen[0]!.init as { credentials: string }).credentials, "omit");
  assert.equal((seen[0]!.init as { signal?: AbortSignal }).signal, signal);
  assert.equal(drained, true);
});

test("warmJournalMovie returns false (never throws) on HTTP error, throw, or abort", async () => {
  const httpError = async () => ({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) });
  assert.equal(await warmJournalMovie("https://example.invalid/x.mp4", httpError), false);
  const throwing = async (): Promise<never> => {
    throw new Error("network down");
  };
  assert.equal(await warmJournalMovie("https://example.invalid/x.mp4", throwing), false);
  const aborting = async (_url: string, init: { signal?: AbortSignal }) => {
    init.signal?.throwIfAborted();
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
  };
  const controller = new AbortController();
  controller.abort();
  assert.equal(
    await warmJournalMovie("https://example.invalid/x.mp4", aborting, controller.signal),
    false,
  );
});

// --- Runner: bounded to 2 concurrent, abort silent, never rejects --------

test("startJournalPrefetch warms at most 2 at once", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const release: Array<() => void> = [];
  const fetchImpl = async () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise<void>((resolve) => release.push(resolve));
    inFlight--;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
  };
  const warmed: string[] = [];
  const handle = startJournalPrefetch(["u1", "u2", "u3", "u4"], {
    fetchImpl,
    onWarmed: (url) => warmed.push(url),
  });
  // Let the first two start; the rest must wait behind the bound.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(maxInFlight, 2);
  assert.equal(JOURNAL_PREFETCH_MAX_CONCURRENT, 2);
  // Drain releases as later workers start behind the bound.
  while (warmed.length < 4) {
    while (release.length > 0) release.shift()!();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  await handle.settled;
  assert.deepEqual(warmed.sort(), ["u1", "u2", "u3", "u4"]);
  assert.equal(maxInFlight, 2);
});

test("startJournalPrefetch abort stops in-flight warms and never rejects", async () => {
  const started: string[] = [];
  const fetchImpl = async (_url: string, init: { signal?: AbortSignal }) => {
    started.push(_url);
    await new Promise<void>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
  };
  const handle = startJournalPrefetch(["u1", "u2", "u3"], { fetchImpl });
  await new Promise((resolve) => setTimeout(resolve, 0));
  handle.abort();
  await handle.settled;
  // Only the first two started (bound of 2); the queued third never did.
  assert.deepEqual(started, ["u1", "u2"]);
});

test("startJournalPrefetch never rejects on failed warms and reports each", async () => {
  const fetchImpl = async (url: string) => {
    if (url === "bad") return { ok: false, arrayBuffer: async () => new ArrayBuffer(0) };
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
  };
  const results: Array<[string, boolean]> = [];
  const handle = startJournalPrefetch(["good", "bad"], {
    fetchImpl,
    onWarmed: (url, warmed) => results.push([url, warmed]),
  });
  await handle.settled;
  assert.deepEqual(results.sort(), [["bad", false], ["good", true]]);
});

test("startJournalPrefetch with no URLs settles without fetching", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
  };
  const handle = startJournalPrefetch([], { fetchImpl });
  await handle.settled;
  assert.equal(calls, 0);
});

test("startJournalPrefetch honours an already-aborted external signal", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
  };
  const controller = new AbortController();
  controller.abort();
  const handle = startJournalPrefetch(["u1"], { fetchImpl, signal: controller.signal });
  await handle.settled;
  assert.equal(calls, 0);
});
