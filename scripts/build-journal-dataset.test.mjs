/**
 * build-journal-dataset.mjs tests: spec §1 exclusion, §3 set formation,
 * §4 confidence rubric, the citation protocol guard (security F1), and
 * the art-manifest merge (plan item 4 / Q5: hard-fail validation +
 * losslessness of the 6 art values across regeneration).
 * Run: node --test scripts/build-journal-dataset.test.mjs
 *
 * Unit tests hit the exported pure functions (parseCatalog / formSets /
 * confidenceForHref). The exclusion + protocol + manifest behaviour lives
 * in the generator's main(), so those cases run the real generator as a
 * subprocess against a synthetic catalog in a temp dir laid out like the
 * repo (scripts/ + src/game/ + src/components/) — the same method the
 * scrum review's one-off synthetic proofs used, now committed so CI keeps
 * them honest.
 */
import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { confidenceForHref, formSets, parseCatalog } from "./build-journal-dataset.mjs";

const GENERATOR = fileURLToPath(new URL("./build-journal-dataset.mjs", import.meta.url));
const REPO_ROOT = path.resolve(path.dirname(GENERATOR), "..");

/** One catalog entry in the catalog's real formatting. Pass null to omit a field entirely. */
function entry({ id, name = id, ring = "lincoln", story = "A true story.", source = 'src("Source", "https://example.org/")' }) {
  const lines = ["  {", `    id: "${id}",`, `    name: "${name}",`, `    ring: "${ring}",`];
  if (story !== null) lines.push(`    story:\n      "${story}",`);
  if (source !== null) lines.push(`    source: ${source},`);
  lines.push("  },");
  return lines.join("\n");
}

function catalogOf(...entries) {
  return `export const PLACES = [\n${entries.join("\n")}\n];\n`;
}

/**
 * Run the generator against a synthetic catalog; returns
 * {status, stdout, stderr, out}. The temp layout mirrors the repo: the
 * generator, the art manifest (pass null to omit the file entirely), and
 * the catalog go in; the dataset is read back from
 * src/components/home-journal.data.ts.
 */
function runGenerator(catalogText, manifestText = "{}\n") {
  const dir = mkdtempSync(path.join(tmpdir(), "journal-gen-test-"));
  try {
    mkdirSync(path.join(dir, "scripts"), { recursive: true });
    mkdirSync(path.join(dir, "src/game"), { recursive: true });
    mkdirSync(path.join(dir, "src/components"), { recursive: true });
    copyFileSync(GENERATOR, path.join(dir, "scripts/build-journal-dataset.mjs"));
    if (manifestText !== null) {
      writeFileSync(path.join(dir, "scripts/journal-art-manifest.json"), manifestText);
    }
    writeFileSync(path.join(dir, "src/game/catalog.ts"), catalogText);
    const res = spawnSync(process.execPath, [path.join(dir, "scripts/build-journal-dataset.mjs")], {
      encoding: "utf8",
    });
    let out = null;
    try {
      out = readFileSync(path.join(dir, "src/components/home-journal.data.ts"), "utf8");
    } catch {
      out = null;
    }
    return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "", out };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Run the generator in a temp layout against the REAL catalog + manifest; returns the regenerated dataset text. */
function runRealGenerator() {
  const dir = mkdtempSync(path.join(tmpdir(), "journal-gen-real-"));
  try {
    mkdirSync(path.join(dir, "scripts"), { recursive: true });
    mkdirSync(path.join(dir, "src/game"), { recursive: true });
    mkdirSync(path.join(dir, "src/components"), { recursive: true });
    copyFileSync(GENERATOR, path.join(dir, "scripts/build-journal-dataset.mjs"));
    copyFileSync(path.join(REPO_ROOT, "src/game/catalog.ts"), path.join(dir, "src/game/catalog.ts"));
    copyFileSync(
      path.join(REPO_ROOT, "scripts/journal-art-manifest.json"),
      path.join(dir, "scripts/journal-art-manifest.json"),
    );
    execFileSync(process.execPath, [path.join(dir, "scripts/build-journal-dataset.mjs")], { encoding: "utf8" });
    return readFileSync(path.join(dir, "src/components/home-journal.data.ts"), "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Extract the JOURNAL_NOTES array (emitted as plain JSON) from generated dataset text. */
function notesFromDataset(datasetText) {
  const marker = datasetText.indexOf("export const JOURNAL_NOTES");
  const arrStart = datasetText.indexOf("= [", marker) + 2;
  const arrEnd = datasetText.indexOf("\n];\n\nexport const JOURNAL_SETS", arrStart);
  assert.ok(marker >= 0 && arrStart >= 2 && arrEnd > arrStart, "dataset carries JOURNAL_NOTES + JOURNAL_SETS");
  return JSON.parse(datasetText.slice(arrStart, arrEnd + 2));
}

// ---------------------------------------------------------------- §4 rubric

test("confidenceForHref: .gov and .edu hosts are verified", () => {
  assert.equal(confidenceForHref("https://capitol.nebraska.gov/").tier, "verified");
  assert.equal(confidenceForHref("https://ashfall.unl.edu/").tier, "verified");
  assert.equal(confidenceForHref("https://ashfall.unl.edu/").basis, "Government or university source");
});

test("confidenceForHref: suffix must be the host's ending, not a substring", () => {
  assert.equal(confidenceForHref("https://fake.edu.evil.com/").tier, "cited");
  assert.equal(confidenceForHref("https://notgov.com/").tier, "cited");
  assert.equal(confidenceForHref("https://en.wikipedia.org/wiki/X").tier, "cited");
  assert.equal(confidenceForHref("https://en.wikipedia.org/wiki/X").basis, "Named source recorded in the catalog");
});

test("confidenceForHref: unparseable href falls back to cited, never throws", () => {
  assert.equal(confidenceForHref("not a url").tier, "cited");
});

// ---------------------------------------------------------------- §1 parser

test("parseCatalog: a genuinely missing story parses as null, not a throw", () => {
  const places = parseCatalog(catalogOf(entry({ id: "a", story: null })));
  assert.equal(places.length, 1);
  assert.equal(places[0].story, null);
  assert.deepEqual(places[0].source, { label: "Source", href: "https://example.org/" });
});

test("parseCatalog: a genuinely missing source parses as null, not a throw", () => {
  const places = parseCatalog(catalogOf(entry({ id: "a", source: null })));
  assert.equal(places[0].source, null);
  assert.equal(places[0].story, "A true story.");
});

test("parseCatalog: structural mismatch (id tally vs blocks) throws", () => {
  // A stray line-start `id:` with no entry block around it inflates the
  // tally past the block count — the parser must refuse, never go partial.
  const broken = catalogOf(entry({ id: "a" })) + '\n  id: "ghost",\n';
  assert.throws(() => parseCatalog(broken), /catalog parse mismatch/);
});

// ------------------------------------------------------- §1 src() wraps (#200)
//
// A formatter pass (Prettier, printWidth 100) can rewrap a long
// one-line `source: src("label", "href")` call across lines. The old
// one-line-only regex then failed to match, the place parsed with
// source: null, and it was silently dropped from the dataset. The
// parser must tolerate a break at every point where whitespace may
// appear inside the call — and fail loudly when a present src( call
// is malformed instead of dropping the place.

const EXPECTED_SOURCE = { label: "Source", href: "https://example.org/" };

test("parseCatalog: src() wrapped after src( still parses (#200)", () => {
  const places = parseCatalog(
    catalogOf(entry({ id: "wrapped-open", source: 'src(\n      "Source", "https://example.org/")' })),
  );
  assert.deepEqual(places[0].source, EXPECTED_SOURCE);
});

test("parseCatalog: src() wrapped before ) still parses (#200)", () => {
  const places = parseCatalog(
    catalogOf(entry({ id: "wrapped-close", source: 'src("Source", "https://example.org/"\n    )' })),
  );
  assert.deepEqual(places[0].source, EXPECTED_SOURCE);
});

test("parseCatalog: src() wrapped before the comma still parses (#200)", () => {
  const places = parseCatalog(
    catalogOf(entry({ id: "wrapped-before-comma", source: 'src("Source"\n      , "https://example.org/")' })),
  );
  assert.deepEqual(places[0].source, EXPECTED_SOURCE);
});

test("parseCatalog: src() wrapped after the comma still parses (#200 regression pin)", () => {
  // This shape already parsed before #200 (the old regex had `,\s*`) —
  // pinned so the tolerance is never lost in a future regex edit.
  const places = parseCatalog(
    catalogOf(entry({ id: "wrapped-after-comma", source: 'src("Source",\n      "https://example.org/")' })),
  );
  assert.deepEqual(places[0].source, EXPECTED_SOURCE);
});

test("parseCatalog: fully wrapped src() (the real Prettier shape) still parses (#200)", () => {
  const places = parseCatalog(
    catalogOf(
      entry({
        id: "wrapped-full",
        source: 'src(\n      "Source",\n      "https://example.org/"\n    )',
      }),
    ),
  );
  assert.deepEqual(places[0].source, EXPECTED_SOURCE);
});

test("parseCatalog: a present-but-unparseable src() throws, naming the place (#200)", () => {
  // Single-quoted arguments are malformed for this parser: the place
  // must NOT degrade to source: null (the silent-drop path).
  assert.throws(
    () =>
      parseCatalog(
        catalogOf(entry({ id: "badquotes", source: "src('Source', 'https://example.org/')" })),
      ),
    /"badquotes".*could not parse/,
  );
});

// ---------------------------------------------------------------- §3 sets

test("formSets: pure triples per ring, leftovers chunk 3/3/1 as Field Notes", () => {
  const mk = (id, ring) => ({ id, ring });
  const notes = [
    ...["a", "b", "c", "d", "e"].map((id) => mk(id, "lincoln")), // 1 pure + 2 leftovers
    ...["f", "g"].map((id) => mk(id, "region")), // 2 leftovers
    ...["h", "i", "j"].map((id) => mk(id, "nebraska")), // 1 pure
    mk("k", "usa"), // 1 leftover
    ...["l", "m"].map((id) => mk(id, "world")), // 2 leftovers
  ];
  const sets = formSets(notes);
  assert.deepEqual(
    sets.map((s) => s.noteIds),
    [
      ["a", "b", "c"],
      ["h", "i", "j"],
      ["d", "e", "f"],
      ["g", "k", "l"],
      ["m"],
    ],
  );
  assert.equal(sets[0].mixed, false);
  assert.equal(sets[0].geography, "Lincoln, Nebraska");
  assert.ok(sets.slice(2).every((s) => s.mixed && s.geography === "Field Notes"));
});

// ------------------------------------------------------- §1 + protocol (e2e)

test("generator: missing story is excluded with its reason in the report", () => {
  const r = runGenerator(catalogOf(entry({ id: "keep" }), entry({ id: "nostory", story: null })));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /notes included: 1/);
  assert.match(r.stdout, /notes excluded: 1 \(nostory \(missing story field\)\)/);
  assert.ok(r.out !== null && !r.out.includes('"nostory"'));
});

test("generator: missing source is excluded with its reason in the report", () => {
  const r = runGenerator(catalogOf(entry({ id: "keep" }), entry({ id: "nosource", source: null })));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /notes excluded: 1 \(nosource \(missing source field\)\)/);
});

test("generator: empty citation label is excluded with its reason", () => {
  const r = runGenerator(
    catalogOf(entry({ id: "keep" }), entry({ id: "nolabel", source: 'src("", "https://example.org/")' })),
  );
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /notes excluded: 1 \(nolabel \(empty citation label\)\)/);
});

test("generator: empty story is excluded with its reason", () => {
  const r = runGenerator(catalogOf(entry({ id: "keep" }), entry({ id: "blank", story: "" })));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /notes excluded: 1 \(blank \(empty story\)\)/);
});

test("generator: a javascript: citation href refuses generation (protocol guard)", () => {
  const r = runGenerator(catalogOf(entry({ id: "evil", source: 'src("X", "javascript:alert(1)")' })));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /protocol "javascript:" is not http:\/https: — refusing to generate/);
  assert.equal(r.out, null);
});

test("generator: an unknown ring refuses generation", () => {
  const r = runGenerator(catalogOf(entry({ id: "lost", ring: "atlantis" })));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /unknown ring "atlantis"/);
});

test("generator: byte-stable — two runs on the same catalog are identical", () => {
  const cat = catalogOf(entry({ id: "one" }), entry({ id: "two" }), entry({ id: "three" }), entry({ id: "four" }));
  const a = runGenerator(cat);
  const b = runGenerator(cat);
  assert.equal(a.status, 0, a.stderr);
  assert.equal(b.status, 0, b.stderr);
  assert.equal(a.out, b.out);
});

test("generator: the real catalog regenerates the committed dataset byte-for-byte", () => {
  const regenerated = runRealGenerator();
  const committed = readFileSync(path.join(REPO_ROOT, "src/components/home-journal.data.ts"), "utf8");
  assert.equal(regenerated, committed);
});

// ------------------------------------------------------- art manifest (Q5)

test("generator: manifest art survives regeneration byte-identical (losslessness)", () => {
  const regenerated = runRealGenerator();
  const manifest = JSON.parse(readFileSync(path.join(REPO_ROOT, "scripts/journal-art-manifest.json"), "utf8"));
  const notes = notesFromDataset(regenerated);
  const withArt = notes.filter((n) => n.image !== undefined);
  // Exactly the manifest's notes carry art, in catalog order.
  assert.deepEqual(
    withArt.map((n) => n.id),
    Object.keys(manifest),
  );
  // All 6 values (3 notes x image + imageAlt) survive byte-identical: the
  // parsed values equal the manifest's, the raw emitted JSON spells them
  // exactly, and they sit after `confidence` in the merged key order.
  for (const note of withArt) {
    assert.equal(note.image, manifest[note.id].image);
    assert.equal(note.imageAlt, manifest[note.id].imageAlt);
    assert.ok(regenerated.includes(`"image": ${JSON.stringify(manifest[note.id].image)}`));
    assert.ok(regenerated.includes(`"imageAlt": ${JSON.stringify(manifest[note.id].imageAlt)}`));
    assert.deepEqual(Object.keys(note).slice(-2), ["image", "imageAlt"]);
  }
});

test("generator: a manifest naming an unknown note id refuses generation", () => {
  const r = runGenerator(
    catalogOf(entry({ id: "keep" })),
    JSON.stringify({ ghost: { image: "images/journal/x.webp", imageAlt: "A drawing." } }),
  );
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /journal art manifest names unknown note id "ghost" — generation aborted/);
  assert.equal(r.out, null);
});

test("generator: a manifest entry with image but no imageAlt refuses generation", () => {
  const r = runGenerator(catalogOf(entry({ id: "keep" })), JSON.stringify({ keep: { image: "images/journal/x.webp" } }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /journal art manifest entry "keep" has an image but no imageAlt — generation aborted/);
  assert.equal(r.out, null);
});

test("generator: a manifest with a duplicate id refuses generation", () => {
  const dup =
    '{\n  "keep": { "image": "images/journal/a.webp", "imageAlt": "A." },\n' +
    '  "keep": { "image": "images/journal/b.webp", "imageAlt": "B." }\n}\n';
  const r = runGenerator(catalogOf(entry({ id: "keep" })), dup);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /journal art manifest has a duplicate id "keep" — generation aborted/);
  assert.equal(r.out, null);
});

test("generator: a missing manifest file refuses generation", () => {
  const r = runGenerator(catalogOf(entry({ id: "keep" })), null);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /journal art manifest is missing/);
  assert.equal(r.out, null);
});

test("generator: a malformed manifest file refuses generation", () => {
  const r = runGenerator(catalogOf(entry({ id: "keep" })), "{ not json");
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /journal art manifest is malformed \(invalid JSON/);
  assert.equal(r.out, null);
});
