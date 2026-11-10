import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  getJournalMovieManifest,
  journalManifestUrl,
  journalMovieUrl,
  loadJournalMovieManifest,
  parseJournalMovieManifest,
  resetJournalMovieManifestCache,
  JOURNAL_MOVIE_BASE_URL,
  type JournalMovieManifest,
} from "./journal-movies.ts";

const REAL_MANIFEST = JSON.parse(
  readFileSync("public/videos/journal-manifest.json", "utf8"),
) as JournalMovieManifest;

// --- Shape guard: never crash on a bad fetch, degrade instead -----------

test("parseJournalMovieManifest accepts the real manifest", () => {
  const parsed = parseJournalMovieManifest(REAL_MANIFEST);
  assert.ok(parsed !== null);
  assert.equal(parsed!.baseUrl, "https://veeresh-bikkaneti.github.io/meridian-media/journal/");
  assert.equal(parsed!.baseUrl, JOURNAL_MOVIE_BASE_URL);
  assert.equal(Object.keys(parsed!.movies).length, 106);
  assert.equal(parsed!.version, 1);
});

test("parseJournalMovieManifest rejects a baseUrl other than the pinned one", () => {
  // Valid shape, wrong host: the runtime re-pins baseUrl to the value
  // the build validator enforces, so a swapped manifest cannot redirect
  // clip URLs elsewhere.
  assert.equal(
    parseJournalMovieManifest({ ...REAL_MANIFEST, baseUrl: "https://example.invalid/" }),
    null,
  );
  assert.equal(
    parseJournalMovieManifest({ ...REAL_MANIFEST, baseUrl: "" }),
    null,
  );
});

test("parseJournalMovieManifest rejects anything that is not a usable manifest", () => {
  for (const bad of [
    null,
    undefined,
    "x",
    42,
    [],
    {},
    { baseUrl: "https://example.invalid/", movies: {}, version: "1" },
    { baseUrl: "", movies: {}, version: 1 },
    { baseUrl: "https://example.invalid/", movies: [], version: 1 },
    { baseUrl: "https://example.invalid/", movies: null, version: 1 },
    { baseUrl: "https://example.invalid/", version: 1 },
  ]) {
    assert.equal(parseJournalMovieManifest(bad), null, `rejects ${JSON.stringify(bad)}`);
  }
});

// --- URL resolution: every note id maps to its movie --------------------

test("every manifest id resolves to <baseUrl><id>.mp4", () => {
  for (const [id, entry] of Object.entries(REAL_MANIFEST.movies)) {
    assert.equal(journalMovieUrl(REAL_MANIFEST, id), `${REAL_MANIFEST.baseUrl}${entry.file}`);
    assert.equal(entry.file, `${id}.mp4`);
  }
});

test("journalMovieUrl returns null for a missing id or a null manifest", () => {
  assert.equal(journalMovieUrl(REAL_MANIFEST, "no-such-place"), null);
  assert.equal(journalMovieUrl(null, "old-faithful"), null);
  const noFile = {
    ...REAL_MANIFEST,
    movies: { ...REAL_MANIFEST.movies, "old-faithful": { ...REAL_MANIFEST.movies["old-faithful"]!, file: "" } },
  };
  assert.equal(journalMovieUrl(noFile, "old-faithful"), null);
});

test("journalManifestUrl points at the public manifest file", () => {
  assert.ok(journalManifestUrl().endsWith("videos/journal-manifest.json"));
});

// --- Loader: failures degrade to null, never throw ----------------------

test("loadJournalMovieManifest returns the manifest on a good fetch", async () => {
  const stub = async () => ({ ok: true, json: async () => REAL_MANIFEST });
  assert.deepEqual(await loadJournalMovieManifest(stub), REAL_MANIFEST);
});

test("loadJournalMovieManifest returns null on HTTP error, bad shape, or throw", async () => {
  const httpError = async () => ({ ok: false, json: async () => REAL_MANIFEST });
  assert.equal(await loadJournalMovieManifest(httpError), null);
  const badShape = async () => ({ ok: true, json: async () => ({ nope: true }) });
  assert.equal(await loadJournalMovieManifest(badShape), null);
  const throwing = async (): Promise<never> => {
    throw new Error("network down");
  };
  assert.equal(await loadJournalMovieManifest(throwing), null);
});

test("getJournalMovieManifest fetches at most once per page load", async () => {
  let calls = 0;
  const stub = async () => {
    calls += 1;
    return { ok: true, json: async () => REAL_MANIFEST };
  };
  const first = await getJournalMovieManifest(stub);
  const second = await getJournalMovieManifest(stub);
  assert.equal(first, second);
  assert.equal(calls, 1);
});

test("resetJournalMovieManifestCache lets the next call fetch again", async () => {
  resetJournalMovieManifestCache();
  let calls = 0;
  const stub = async () => {
    calls += 1;
    return { ok: true, json: async () => REAL_MANIFEST };
  };
  const first = await getJournalMovieManifest(stub);
  assert.equal(calls, 1);
  resetJournalMovieManifestCache();
  const second = await getJournalMovieManifest(stub);
  assert.equal(calls, 2);
  assert.equal(first, second);
  resetJournalMovieManifestCache();
});
