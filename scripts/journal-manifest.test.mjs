// Tests for scripts/validate-journal-manifest.mjs (Meridian PR #369,
// spec ~/workspace/journal-manifest-validation-spec.md v20).
// Every fixture-table row asserts an EXACT error list (multiset
// comparison, order-independent) including the pinned `expected` string
// for its code. The `expected` strings below are hardcoded literally from
// the spec's per-code table — they are NOT imported from the validator
// (that would be circular).

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  UsageError,
  parseArgs,
  validate,
} from "./validate-journal-manifest.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");
const REAL_MANIFEST = join(ROOT, "public", "videos", "journal-manifest.json");
const REAL_IMAGES = join(ROOT, "public", "images", "journal");
const REAL_RAW = readFileSync(REAL_MANIFEST, "utf8");
const DATA = JSON.parse(REAL_RAW);
const IDS = Object.keys(DATA.movies);
const ID = "27th-and-o";
const ID2 = "48th-and-o";
const BASE_URL =
  "https://veeresh-bikkaneti.github.io/meridian-media/journal/";
const CLI = fileURLToPath(new URL("./validate-journal-manifest.mjs", import.meta.url));
const VALIDATOR_STEP =
  "node scripts/validate-journal-manifest.mjs --manifest public/videos/journal-manifest.json --images-dir public/images/journal";

// Pinned expected-value wording per error code (spec's per-code table,
// hardcoded literally — do not import from the validator).
const EXPECTED = {
  "unreadable-manifest": "manifest file exists and is readable",
  "invalid-json":
    "parseable JSON object with keys baseUrl, movies, note, version",
  "top-level-not-object": "top-level JSON object",
  "missing-top-key":
    "all top-level keys present: baseUrl, movies, note, version",
  "extra-top-key":
    "exactly the top-level keys baseUrl, movies, note, version",
  "bad-base-url": `baseUrl exactly ${BASE_URL}`,
  "bad-version": "version === 1 (number)",
  "bad-note": "note is a non-empty string",
  "missing-id": "an entry in movies for every image basename",
  "unknown-id": "every key in movies is an image basename",
  "duplicate-key": "each key appears once at its path",
  "bad-filename": "file == <id>.mp4",
  "entry-not-object": "each entry is an object",
  "entry-shape": "exactly the keys file, duration, voice, note, verified",
  "bad-duration": "duration is a positive number",
  "bad-voice": "one of the 8 known voice values",
  "empty-field": "a non-empty string",
  "bad-verified": "YYYY-MM-DD, a real calendar date",
  "ground-truth-missing": "images dir exists and contains ≥1 `.webp`",
  "non-object-movies": "movies is a non-null object",
};

function err(code, field, path, actual) {
  return { code, field, path, expected: EXPECTED[code], actual };
}

function sortErrors(errors) {
  return [...errors].sort((a, b) => {
    const x = JSON.stringify(a);
    const y = JSON.stringify(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

// Exact error-list assertion: same code/field/path/expected/actual, same
// counts, independent of the validator's emission order.
function assertExact(result, expected, exitCode) {
  assert.equal(result.exitCode, exitCode);
  assert.equal(result.ok, expected.length === 0);
  assert.deepEqual(sortErrors(result.errors), sortErrors(expected));
}

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "journal-manifest-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function withTempManifest(text, fn) {
  return withTempDir((dir) => {
    const manifestPath = join(dir, "manifest.json");
    writeFileSync(manifestPath, text);
    return fn(manifestPath, dir);
  });
}

// Parse-mutate-reserialize fixture builder (never used for duplicate-key
// fixtures — JSON.parse last-wins would collapse the duplicate).
function mutated(fn) {
  const obj = JSON.parse(REAL_RAW);
  fn(obj);
  return JSON.stringify(obj);
}

// The invalid-json snippet, computed INDEPENDENTLY of the validator: parse
// the fixture ourselves and read the position from the platform
// SyntaxError message.
function snippetActual(text) {
  try {
    JSON.parse(text);
  } catch (error) {
    const match = /at position (\d+)/.exec(error.message);
    if (match) {
      const pos = Number(match[1]);
      const start = Math.max(0, pos - 20);
      return text.slice(start, start + 40);
    }
    return text.slice(0, 40);
  }
  throw new Error("snippetActual called on parseable text");
}

// --- Raw-text entry helpers (duplicate fixtures must be built by raw-text
// replacement, never by parse-mutate-reserialize). The manifest is
// minified, so the entry object is located by brace matching with
// string-aware scanning. ---

function entrySpan(raw, id) {
  const keyStart = raw.indexOf(`"${id}":`);
  assert.notEqual(keyStart, -1, `entry ${id} not found`);
  const start = raw.indexOf("{", keyStart);
  let depth = 0;
  let i = start;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '"') {
      i++;
      while (i < raw.length) {
        if (raw[i] === "\\") i += 2;
        else if (raw[i] === '"') {
          i++;
          break;
        } else i++;
      }
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return { keyStart, start, end: i + 1, text: raw.slice(start, i + 1) };
      }
    }
    i++;
  }
  throw new Error(`unbalanced entry ${id}`);
}

function replaceEntry(raw, id, replacement) {
  const span = entrySpan(raw, id);
  return raw.slice(0, span.start) + replacement + raw.slice(span.end);
}

function insertIntoEntry(raw, id, insertion) {
  const span = entrySpan(raw, id);
  return raw.slice(0, span.end - 1) + "," + insertion + raw.slice(span.end - 1);
}

function replaceInEntry(raw, id, token, replacement) {
  const span = entrySpan(raw, id);
  const idx = span.text.indexOf(token);
  assert.notEqual(idx, -1, `token ${token} not found in entry ${id}`);
  const newText =
    span.text.slice(0, idx) + replacement + span.text.slice(idx + token.length);
  return raw.slice(0, span.start) + newText + raw.slice(span.end);
}

function duplicateEntryBlock(raw, id) {
  const span = entrySpan(raw, id);
  const block = raw.slice(span.keyStart, span.end);
  return raw.slice(0, span.end) + "," + block + raw.slice(span.end);
}

function case15Text() {
  return mutated((obj) => {
    obj.movies[ID].voice = "morgan";
  });
}

function case1Text() {
  return REAL_RAW.slice(0, 11380);
}

function case2fText() {
  return mutated((obj) => {
    obj.movies[ID].voice = "morgan";
    obj.movies[ID2].file = "wrong.mp4";
  });
}

function emptyImagesDir(dir) {
  const imagesDir = join(dir, "images");
  mkdirSync(imagesDir);
  return imagesDir;
}

function spawnCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

function manifestLine(manifestPath, imagesDir) {
  return `manifest: ${manifestPath} | images: ${imagesDir}`;
}

function prefixedLines(stderr) {
  return stderr.split("\n").filter((line) => line.length > 0);
}

// Save/delete/restore the env vars around fn. An `undefined` assignment
// means delete the var.
function withEnv(assignments, fn) {
  const saved = {};
  for (const name of ["JOURNAL_MANIFEST_PATH", "JOURNAL_IMAGES_DIR"]) {
    saved[name] = process.env[name];
  }
  try {
    for (const [name, value] of Object.entries(assignments)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    return fn();
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

// ---------------------------------------------------------------------------
// Fixture-table tests (104)
// ---------------------------------------------------------------------------

test("case 1: invalid JSON fails fast", () => {
  withTempManifest(case1Text(), (manifestPath) => {
    const actual = snippetActual(case1Text());
    assert.equal(actual, "tly out of frame at ");
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [err("invalid-json", "manifest", manifestPath, "tly out of frame at ")],
      3,
    );
  });
});

test("ordering: unparseable file yields only the parse error", () => {
  const text = ('{"version": 1, "version": 1, ' + REAL_RAW.slice(1)).slice(0, 11380);
  withTempManifest(text, (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [err("invalid-json", "manifest", manifestPath, snippetActual(text))],
      3,
    );
  });
});

test("case 1b: invalid JSON plus empty images dir", () => {
  withTempDir((dir) => {
    const manifestPath = join(dir, "manifest.json");
    writeFileSync(manifestPath, case1Text());
    const imagesDir = emptyImagesDir(dir);
    const result = validate({ manifestPath, imagesDir });
    assertExact(
      result,
      [err("invalid-json", "manifest", manifestPath, snippetActual(case1Text()))],
      3,
    );
  });
});

test("case 1c: invalid JSON early position clamps snippet to file start", () => {
  const text = REAL_RAW.replace('{"baseUrl":', '{"baseUrl" ');
  withTempManifest(text, (manifestPath) => {
    assert.equal(snippetActual(text), '{"baseUrl" "https://veeresh-bikkaneti.gi');
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [
        err(
          "invalid-json",
          "manifest",
          manifestPath,
          '{"baseUrl" "https://veeresh-bikkaneti.gi',
        ),
      ],
      3,
    );
  });
});

test("aggregation: two faults are both reported", () => {
  withTempManifest(case2fText(), (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [
        err("bad-voice", "voice", `movies.${ID}.voice`, "morgan"),
        err("bad-filename", "file", `movies.${ID2}.file`, "wrong.mp4"),
      ],
      2,
    );
  });
});

test("case 2: missing ID", () => {
  withTempManifest(
    mutated((obj) => {
      delete obj.movies[ID];
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("missing-id", ID, `movies.${ID}`, "absent")],
        2,
      );
    },
  );
});

test("case 3: unknown ID", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies["invented-id"] = {
        file: "invented-id.mp4",
        duration: 10,
        voice: "miles",
        note: "test",
        verified: "2026-11-08",
      };
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("unknown-id", "invented-id", "movies.invented-id", "invented-id")],
        2,
      );
    },
  );
});

test("case 4: duplicate movie key", () => {
  withTempManifest(duplicateEntryBlock(REAL_RAW, ID), (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [
        err("duplicate-key", ID, `movies.${ID}`, ID),
        err("duplicate-key", "duration", `movies.${ID}.duration`, "duration"),
        err("duplicate-key", "file", `movies.${ID}.file`, "file"),
        err("duplicate-key", "note", `movies.${ID}.note`, "note"),
        err("duplicate-key", "verified", `movies.${ID}.verified`, "verified"),
        err("duplicate-key", "voice", `movies.${ID}.voice`, "voice"),
      ],
      2,
    );
  });
});

test("case 4b: key appearing three times", () => {
  const span = entrySpan(REAL_RAW, ID);
  const block = REAL_RAW.slice(span.keyStart, span.end);
  const text =
    REAL_RAW.slice(0, span.keyStart) +
    `"${ID}":{},` +
    `"${ID}":{},` +
    block +
    REAL_RAW.slice(span.end);
  withTempManifest(text, (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [
        err("duplicate-key", ID, `movies.${ID}`, ID),
        err("duplicate-key", ID, `movies.${ID}`, ID),
      ],
      2,
    );
  });
});

test("case 5: wrong filename", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].file = "other.mp4";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("bad-filename", "file", `movies.${ID}.file`, "other.mp4")],
        2,
      );
    },
  );
});

test("case 5b: filename of another entry", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].file = `${ID2}.mp4`;
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("bad-filename", "file", `movies.${ID}.file`, `${ID2}.mp4`)],
        2,
      );
    },
  );
});

test("case 5c-ext: wrong filename extension", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].file = `${ID}.mp3`;
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("bad-filename", "file", `movies.${ID}.file`, `${ID}.mp3`)],
        2,
      );
    },
  );
});

test("case 5c-case: wrong filename case", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].file = `${ID}.MP4`;
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("bad-filename", "file", `movies.${ID}.file`, `${ID}.MP4`)],
        2,
      );
    },
  );
});

test("case 6a: baseUrl wrong host", () => {
  withTempManifest(
    mutated((obj) => {
      obj.baseUrl = "https://example.invalid/journal/";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [
          err(
            "bad-base-url",
            "baseUrl",
            "baseUrl",
            "https://example.invalid/journal/",
          ),
        ],
        2,
      );
    },
  );
});

test("case 6b: baseUrl missing slash", () => {
  withTempManifest(
    mutated((obj) => {
      obj.baseUrl = BASE_URL.slice(0, -1);
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("bad-base-url", "baseUrl", "baseUrl", BASE_URL.slice(0, -1))],
        2,
      );
    },
  );
});

test("case 6c: baseUrl wrong type", () => {
  withTempManifest(
    mutated((obj) => {
      obj.baseUrl = 123;
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("bad-base-url", "baseUrl", "baseUrl", 123)],
        2,
      );
    },
  );
});

test("case 6d: baseUrl empty", () => {
  withTempManifest(
    mutated((obj) => {
      obj.baseUrl = "";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("empty-field", "baseUrl", "baseUrl", "")],
        2,
      );
    },
  );
});

test("case 7: deleted duration", () => {
  withTempManifest(
    mutated((obj) => {
      delete obj.movies[ID].duration;
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("entry-shape", "duration", `movies.${ID}.duration`, "absent")],
        2,
      );
    },
  );
});

for (const field of ["file", "voice", "note", "verified"]) {
  test(`case 7b: deleted entry field ${field}`, () => {
    withTempManifest(
      mutated((obj) => {
        delete obj.movies[ID][field];
      }),
      (manifestPath) => {
        const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
        assertExact(
          result,
          [err("entry-shape", field, `movies.${ID}.${field}`, "absent")],
          2,
        );
      },
    );
  });
}

test("case 8: duration wrong type", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].duration = "10.0";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("bad-duration", "duration", `movies.${ID}.duration`, "10.0")],
        2,
      );
    },
  );
});

for (const [field, code] of [
  ["file", "bad-filename"],
  ["voice", "bad-voice"],
  ["note", "bad-note"],
]) {
  test(`case 8b: entry field wrong type ${field}`, () => {
    withTempManifest(
      mutated((obj) => {
        obj.movies[ID][field] = 123;
      }),
      (manifestPath) => {
        const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
        assertExact(
          result,
          [err(code, field, `movies.${ID}.${field}`, 123)],
          2,
        );
      },
    );
  });
}

test("case 8c: duration empty", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].duration = "";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("empty-field", "duration", `movies.${ID}.duration`, "")],
        2,
      );
    },
  );
});

test("case 8d: voice null", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].voice = null;
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("bad-voice", "voice", `movies.${ID}.voice`, "null")],
        2,
      );
    },
  );
});

test("case 9: extra top-level key", () => {
  withTempManifest(
    mutated((obj) => {
      obj.extra = true;
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("extra-top-key", "extra", "extra", "extra")],
        2,
      );
    },
  );
});

test("case 21: deleted top-level note", () => {
  withTempManifest(
    mutated((obj) => {
      delete obj.note;
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("missing-top-key", "note", "note", "absent")],
        2,
      );
    },
  );
});

test("case 21b: top-level note empty", () => {
  withTempManifest(
    mutated((obj) => {
      obj.note = "";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("empty-field", "note", "note", "")],
        2,
      );
    },
  );
});

test("case 21c: top-level note wrong type", () => {
  withTempManifest(
    mutated((obj) => {
      obj.note = 42;
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("bad-note", "note", "note", 42)],
        2,
      );
    },
  );
});

for (const key of ["movies", "baseUrl", "version"]) {
  test(`case 21d: deleted top-level key ${key}`, () => {
    withTempManifest(
      mutated((obj) => {
        delete obj[key];
      }),
      (manifestPath) => {
        const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
        assertExact(
          result,
          [err("missing-top-key", key, key, "absent")],
          2,
        );
      },
    );
  });
}

test("case 21e: missing movies plus empty images dir", () => {
  withTempDir((dir) => {
    const manifestPath = join(dir, "manifest.json");
    writeFileSync(
      manifestPath,
      mutated((obj) => {
        delete obj.movies;
      }),
    );
    const imagesDir = emptyImagesDir(dir);
    const result = validate({ manifestPath, imagesDir });
    assertExact(
      result,
      [
        err("missing-top-key", "movies", "movies", "absent"),
        err("ground-truth-missing", "imagesDir", imagesDir, 0),
      ],
      3,
    );
  });
});

test("case 21f: missing baseUrl plus bad voice", () => {
  withTempManifest(
    mutated((obj) => {
      delete obj.baseUrl;
      obj.movies[ID].voice = "morgan";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [
          err("missing-top-key", "baseUrl", "baseUrl", "absent"),
          err("bad-voice", "voice", `movies.${ID}.voice`, "morgan"),
        ],
        2,
      );
    },
  );
});

test("case 10a: version 2", () => {
  withTempManifest(
    mutated((obj) => {
      obj.version = 2;
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("bad-version", "version", "version", 2)],
        2,
      );
    },
  );
});

test("case 10b: version string", () => {
  withTempManifest(
    mutated((obj) => {
      obj.version = "1";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("bad-version", "version", "version", "1")],
        2,
      );
    },
  );
});

test("case 10c: version empty", () => {
  withTempManifest(
    mutated((obj) => {
      obj.version = "";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("empty-field", "version", "version", "")],
        2,
      );
    },
  );
});

test("case 11: extra entry key", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].extra = "x";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("entry-shape", "extra", `movies.${ID}.extra`, "extra")],
        2,
      );
    },
  );
});

test("case 12: duplicate in-entry key", () => {
  const text = replaceInEntry(
    REAL_RAW,
    ID,
    '"voice":"miles"',
    '"voice":"miles","voice":"miles"',
  );
  withTempManifest(text, (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [err("duplicate-key", "voice", `movies.${ID}.voice`, "voice")],
      2,
    );
  });
});

test("case 12b: duplicate in-entry note key", () => {
  const span = entrySpan(REAL_RAW, ID);
  const noteToken = span.text.match(/"note":"(?:\\.|[^"\\])*"/)[0];
  const text = replaceInEntry(
    REAL_RAW,
    ID,
    noteToken,
    `${noteToken},${noteToken}`,
  );
  withTempManifest(text, (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [err("duplicate-key", "note", `movies.${ID}.note`, "note")],
      2,
    );
  });
});

test("case 12c: duplicate key with space around colon", () => {
  const text = replaceInEntry(
    REAL_RAW,
    ID,
    '"voice":"miles"',
    '"voice" :"miles","voice": "miles"',
  );
  withTempManifest(text, (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [err("duplicate-key", "voice", `movies.${ID}.voice`, "voice")],
      2,
    );
  });
});

test("case 12d: duplicate key at depth 4", () => {
  const text = insertIntoEntry(REAL_RAW, ID, '"meta" : {"a": 1, "a": 2}');
  withTempManifest(text, (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [
        err("duplicate-key", "a", `movies.${ID}.meta.a`, "a"),
        err("entry-shape", "meta", `movies.${ID}.meta`, "meta"),
      ],
      2,
    );
  });
});

test("case 12e: escaped quote in note is not a key", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].note =
        'He said "hi" — {"voice": "morgan"} as text';
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(result, [], 0);
    },
  );
});

test("case 12f: duplicate key inside array element", () => {
  const text = insertIntoEntry(REAL_RAW, ID, '"tags":[{"a": 1, "a": 2}]');
  withTempManifest(text, (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [
        err("duplicate-key", "a", `movies.${ID}.tags[0].a`, "a"),
        err("entry-shape", "tags", `movies.${ID}.tags`, "tags"),
      ],
      2,
    );
  });
});

test("case 12g: escaped duplicate key", () => {
  const text = replaceInEntry(
    REAL_RAW,
    ID,
    '"voice":"miles"',
    '"voice":"miles","voi\\u0063e":"miles"',
  );
  withTempManifest(text, (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [err("duplicate-key", "voice", `movies.${ID}.voice`, "voice")],
      2,
    );
  });
});

test("case 12h: duplicate key inside nested array element", () => {
  const text = insertIntoEntry(
    REAL_RAW,
    ID,
    '"tags":[[{"a": 1}], [{"a": 1, "a": 2}]]',
  );
  withTempManifest(text, (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [
        err("duplicate-key", "a", `movies.${ID}.tags[1][0].a`, "a"),
        err("entry-shape", "tags", `movies.${ID}.tags`, "tags"),
      ],
      2,
    );
  });
});

test("case 12i: differing duplicate voice values", () => {
  const text = replaceInEntry(
    REAL_RAW,
    ID,
    '"voice":"miles"',
    '"voice":"miles","voice":"morgan"',
  );
  withTempManifest(text, (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [
        err("duplicate-key", "voice", `movies.${ID}.voice`, "voice"),
        err("bad-voice", "voice", `movies.${ID}.voice`, "morgan"),
      ],
      2,
    );
  });
});

test("case 12j: duplicate inside wrong-typed value", () => {
  const text = replaceInEntry(
    REAL_RAW,
    ID,
    '"voice":"miles"',
    '"voice": {"a": 1, "a": 2}',
  );
  withTempManifest(text, (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [
        err("duplicate-key", "a", `movies.${ID}.voice.a`, "a"),
        err("bad-voice", "voice", `movies.${ID}.voice`, "object"),
      ],
      2,
    );
  });
});

test("case 13a: empty voice", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].voice = "";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("empty-field", "voice", `movies.${ID}.voice`, "")],
        2,
      );
    },
  );
});

test("case 13b: empty note", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].note = "";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("empty-field", "note", `movies.${ID}.note`, "")],
        2,
      );
    },
  );
});

test("case 13c: empty file", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].file = "";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("empty-field", "file", `movies.${ID}.file`, "")],
        2,
      );
    },
  );
});

test("case 14: empty images dir", () => {
  withTempDir((dir) => {
    const imagesDir = emptyImagesDir(dir);
    const result = validate({ manifestPath: REAL_MANIFEST, imagesDir });
    assertExact(
      result,
      [err("ground-truth-missing", "imagesDir", imagesDir, 0)],
      3,
    );
  });
});

test("case 14b: missing images dir", () => {
  withTempDir((dir) => {
    const imagesDir = join(dir, "missing-dir");
    const result = validate({ manifestPath: REAL_MANIFEST, imagesDir });
    assertExact(
      result,
      [err("ground-truth-missing", "imagesDir", imagesDir, "absent")],
      3,
    );
  });
});

test("case 14c: images dir without webp", () => {
  withTempDir((dir) => {
    const imagesDir = emptyImagesDir(dir);
    mkdirSync(join(imagesDir, "foo.webp"));
    writeFileSync(join(imagesDir, "readme.txt"), "not an image");
    const result = validate({ manifestPath: REAL_MANIFEST, imagesDir });
    assertExact(
      result,
      [err("ground-truth-missing", "imagesDir", imagesDir, 0)],
      3,
    );
  });
});

test("case 14d: images path is a file", () => {
  withTempDir((dir) => {
    const imagesDir = join(dir, "not-a-dir");
    writeFileSync(imagesDir, "regular file");
    const result = validate({ manifestPath: REAL_MANIFEST, imagesDir });
    assertExact(
      result,
      [err("ground-truth-missing", "imagesDir", imagesDir, "not-a-directory")],
      3,
    );
  });
});

test("case 14e: empty images dir plus bad baseUrl", () => {
  withTempDir((dir) => {
    const manifestPath = join(dir, "manifest.json");
    writeFileSync(
      manifestPath,
      mutated((obj) => {
        obj.baseUrl = "https://example.invalid/journal/";
      }),
    );
    const imagesDir = emptyImagesDir(dir);
    const result = validate({ manifestPath, imagesDir });
    assertExact(
      result,
      [
        err("bad-base-url", "baseUrl", "baseUrl", "https://example.invalid/journal/"),
        err("ground-truth-missing", "imagesDir", imagesDir, 0),
      ],
      3,
    );
  });
});

test("case 14f: broken symlink in images dir is skipped", () => {
  withTempDir((dir) => {
    const imagesDir = emptyImagesDir(dir);
    symlinkSync(join(imagesDir, "missing-target.webp"), join(imagesDir, "x.webp"));
    const result = validate({ manifestPath: REAL_MANIFEST, imagesDir });
    assertExact(
      result,
      [err("ground-truth-missing", "imagesDir", imagesDir, 0)],
      3,
    );
  });
});

test("case 14g: duplicate key plus empty images dir", () => {
  withTempDir((dir) => {
    const manifestPath = join(dir, "manifest.json");
    writeFileSync(
      manifestPath,
      replaceInEntry(
        REAL_RAW,
        ID,
        '"voice":"miles"',
        '"voice":"miles","voice":"miles"',
      ),
    );
    const imagesDir = emptyImagesDir(dir);
    const result = validate({ manifestPath, imagesDir });
    assertExact(
      result,
      [
        err("duplicate-key", "voice", `movies.${ID}.voice`, "voice"),
        err("ground-truth-missing", "imagesDir", imagesDir, 0),
      ],
      3,
    );
  });
});

test("case 14h: bad filename plus empty images dir", () => {
  withTempDir((dir) => {
    const manifestPath = join(dir, "manifest.json");
    writeFileSync(
      manifestPath,
      mutated((obj) => {
        obj.movies[ID].file = "other.mp4";
      }),
    );
    const imagesDir = emptyImagesDir(dir);
    const result = validate({ manifestPath, imagesDir });
    assertExact(
      result,
      [
        err("bad-filename", "file", `movies.${ID}.file`, "other.mp4"),
        err("ground-truth-missing", "imagesDir", imagesDir, 0),
      ],
      3,
    );
  });
});

test("case 15: voice not in allowlist", () => {
  withTempManifest(case15Text(), (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [err("bad-voice", "voice", `movies.${ID}.voice`, "morgan")],
      2,
    );
  });
});

test("case 16a: movies null", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies = null;
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("non-object-movies", "movies", "movies", "null")],
        3,
      );
    },
  );
});

test("case 16b: movies array", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies = [];
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("non-object-movies", "movies", "movies", "array")],
        3,
      );
    },
  );
});

test("case 16c: movies string", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies = "x";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("non-object-movies", "movies", "movies", "x")],
        3,
      );
    },
  );
});

test("case 16d: non-object entry", () => {
  withTempManifest(replaceEntry(REAL_RAW, ID, '"x"'), (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [err("entry-not-object", ID, `movies.${ID}`, "x")],
      2,
    );
  });
});

test("case 16e: null entry", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID] = null;
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("entry-not-object", ID, `movies.${ID}`, "null")],
        2,
      );
    },
  );
});

test("case 16f: array entry", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID] = ["x"];
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("entry-not-object", ID, `movies.${ID}`, "array")],
        2,
      );
    },
  );
});

test("case 16g: empty movies object", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies = {};
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        IDS.map((id) => err("missing-id", id, `movies.${id}`, "absent")),
        2,
      );
      assert.equal(result.errors.length, 106);
    },
  );
});

test("case 16h: movies empty string", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies = "";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("non-object-movies", "movies", "movies", "")],
        3,
      );
    },
  );
});

test("case 16i: empty-string entry", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID] = "";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("entry-not-object", ID, `movies.${ID}`, "")],
        2,
      );
    },
  );
});

test("case 16j: non-object movies plus empty images dir", () => {
  withTempDir((dir) => {
    const manifestPath = join(dir, "manifest.json");
    writeFileSync(
      manifestPath,
      mutated((obj) => {
        obj.movies = null;
      }),
    );
    const imagesDir = emptyImagesDir(dir);
    const result = validate({ manifestPath, imagesDir });
    assertExact(
      result,
      [
        err("non-object-movies", "movies", "movies", "null"),
        err("ground-truth-missing", "imagesDir", imagesDir, 0),
      ],
      3,
    );
  });
});

test("case 16k: non-object entry plus bad voice elsewhere", () => {
  const voice2 = DATA.movies[ID2].voice;
  const text = replaceInEntry(
    replaceEntry(REAL_RAW, ID, '"x"'),
    ID2,
    `"voice":${JSON.stringify(voice2)}`,
    '"voice":"morgan"',
  );
  withTempManifest(text, (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [
        err("entry-not-object", ID, `movies.${ID}`, "x"),
        err("bad-voice", "voice", `movies.${ID2}.voice`, "morgan"),
      ],
      2,
    );
  });
});

test("case 16l: non-object movies plus bad baseUrl", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies = "x";
      obj.baseUrl = "https://example.invalid/journal/";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [
          err("bad-base-url", "baseUrl", "baseUrl", "https://example.invalid/journal/"),
          err("non-object-movies", "movies", "movies", "x"),
        ],
        3,
      );
    },
  );
});

test("case 16m: duplicate key plus non-object movies", () => {
  const obj = JSON.parse(REAL_RAW);
  obj.movies = "x";
  delete obj.version;
  const text = '{"version": 1, "version": 1, ' + JSON.stringify(obj).slice(1);
  withTempManifest(text, (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [
        err("duplicate-key", "version", "version", "version"),
        err("non-object-movies", "movies", "movies", "x"),
      ],
      3,
    );
  });
});

test("case 17fmt-1: verified slash format", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].verified = "2026/11/08";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("bad-verified", "verified", `movies.${ID}.verified`, "2026/11/08")],
        2,
      );
    },
  );
});

test("case 17fmt-2: verified text format", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].verified = "Nov 8 2026";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("bad-verified", "verified", `movies.${ID}.verified`, "Nov 8 2026")],
        2,
      );
    },
  );
});

test("case 17fmt-3: verified number", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].verified = 20261108;
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("bad-verified", "verified", `movies.${ID}.verified`, 20261108)],
        2,
      );
    },
  );
});

test("case 17emp: verified empty", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].verified = "";
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("empty-field", "verified", `movies.${ID}.verified`, "")],
        2,
      );
    },
  );
});

for (const value of [
  "2026-13-45",
  "2026-02-30",
  "2026-02-29",
  "2026-04-31",
  "2026-00-10",
  "2026-01-00",
]) {
  test(`case 17cal: verified ${value} is not a real date`, () => {
    withTempManifest(
      mutated((obj) => {
        obj.movies[ID].verified = value;
      }),
      (manifestPath) => {
        const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
        assertExact(
          result,
          [err("bad-verified", "verified", `movies.${ID}.verified`, value)],
          2,
        );
      },
    );
  });
}

test("case 17pos: valid verified dates pass", () => {
  for (const value of ["2024-02-29", "2028-02-29", "0099-01-01"]) {
    withTempManifest(
      mutated((obj) => {
        obj.movies[ID].verified = value;
      }),
      (manifestPath) => {
        const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
        assertExact(result, [], 0);
      },
    );
  }
});

test("case 18: duplicate top-level key", () => {
  const text = REAL_RAW.replace('"version":1', '"version":1,"version":1');
  withTempManifest(text, (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [err("duplicate-key", "version", "version", "version")],
      2,
    );
  });
});

test("case 19: image file missing from disk", () => {
  withTempDir((dir) => {
    const imagesDir = join(dir, "images");
    mkdirSync(imagesDir);
    for (const name of readdirSync(REAL_IMAGES)) {
      symlinkSync(join(REAL_IMAGES, name), join(imagesDir, name));
    }
    unlinkSync(join(imagesDir, `${ID}.webp`));
    const result = validate({ manifestPath: REAL_MANIFEST, imagesDir });
    assertExact(
      result,
      [err("unknown-id", ID, `movies.${ID}`, ID)],
      2,
    );
  });
});

test("case 20a: duration zero", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].duration = 0;
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("bad-duration", "duration", `movies.${ID}.duration`, 0)],
        2,
      );
    },
  );
});

test("case 20b: duration negative", () => {
  withTempManifest(
    mutated((obj) => {
      obj.movies[ID].duration = -1;
    }),
    (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("bad-duration", "duration", `movies.${ID}.duration`, -1)],
        2,
      );
    },
  );
});

test("case 22: manifest file missing", () => {
  withTempDir((dir) => {
    const manifestPath = join(dir, "missing.json");
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [err("unreadable-manifest", "manifest", manifestPath, "absent")],
      3,
    );
  });
});

test("case 22b: manifest path is a directory", () => {
  withTempDir((dir) => {
    const result = validate({ manifestPath: dir, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [err("unreadable-manifest", "manifest", dir, "EISDIR")],
      3,
    );
  });
});

test("case 22c: manifest file missing plus empty images dir", () => {
  withTempDir((dir) => {
    const manifestPath = join(dir, "missing.json");
    const imagesDir = emptyImagesDir(dir);
    const result = validate({ manifestPath, imagesDir });
    assertExact(
      result,
      [err("unreadable-manifest", "manifest", manifestPath, "absent")],
      3,
    );
  });
});

for (const [name, text, actual] of [
  ["case 23a: top-level array", "[]", "array"],
  ["case 23b: top-level string", '"x"', "string"],
  ["case 23c: top-level null", "null", "null"],
  ["case 23d: top-level number", "42", "number"],
  ["case 23f: top-level boolean", "true", "boolean"],
]) {
  test(name, () => {
    withTempManifest(text, (manifestPath) => {
      const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
      assertExact(
        result,
        [err("top-level-not-object", "manifest", manifestPath, actual)],
        3,
      );
    });
  });
}

test("case 23e: empty manifest file", () => {
  withTempManifest("", (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [err("invalid-json", "manifest", manifestPath, "")],
      3,
    );
  });
});

test("case 23g: top-level non-object with nested duplicate", () => {
  withTempManifest('[{"a": 1, "a": 2}]', (manifestPath) => {
    const result = validate({ manifestPath, imagesDir: REAL_IMAGES });
    assertExact(
      result,
      [err("top-level-not-object", "manifest", manifestPath, "array")],
      3,
    );
  });
});

test("case 23h: top-level non-object plus empty images dir", () => {
  withTempDir((dir) => {
    const manifestPath = join(dir, "manifest.json");
    writeFileSync(manifestPath, "[]");
    const imagesDir = emptyImagesDir(dir);
    const result = validate({ manifestPath, imagesDir });
    assertExact(
      result,
      [err("top-level-not-object", "manifest", manifestPath, "array")],
      3,
    );
  });
});

test("mixed: 2-class and 3-class errors", () => {
  withTempDir((dir) => {
    const manifestPath = join(dir, "manifest.json");
    writeFileSync(manifestPath, case15Text());
    const imagesDir = emptyImagesDir(dir);
    const result = validate({ manifestPath, imagesDir });
    assertExact(
      result,
      [
        err("bad-voice", "voice", `movies.${ID}.voice`, "morgan"),
        err("ground-truth-missing", "imagesDir", imagesDir, 0),
      ],
      3,
    );
  });
});

test("should-not-trigger: good manifest passes", () => {
  const result = validate({ manifestPath: REAL_MANIFEST, imagesDir: REAL_IMAGES });
  assertExact(result, [], 0);
});

// ---------------------------------------------------------------------------
// Non-fixture tests (29)
// ---------------------------------------------------------------------------

test("default paths resolve to the repo manifest and images dir", () => {
  withEnv(
    { JOURNAL_MANIFEST_PATH: undefined, JOURNAL_IMAGES_DIR: undefined },
    () => {
      const result = validate();
      assert.equal(result.manifestPath, REAL_MANIFEST);
      assert.equal(result.imagesDir, REAL_IMAGES);
    },
  );
});

test("current manifest passes structural validation", () => {
  const result = validate();
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.exitCode, 0);
});

test("parseArgs: unknown flag throws UsageError", () => {
  assert.throws(() => parseArgs(["--bogus"]), UsageError);
  assert.throws(() => parseArgs(["--bogus"]), (error) => error.exitCode === 2);
  assert.throws(() => parseArgs(["--help=x"]), UsageError);
});

test("parseArgs: missing flag value throws UsageError", () => {
  assert.throws(() => parseArgs(["--manifest"]), UsageError);
  assert.throws(() => parseArgs(["--manifest", "--images-dir", "x"]), UsageError);
  assert.throws(() => parseArgs(["--images-dir"]), UsageError);
});

test("parseArgs: repeated flag throws UsageError", () => {
  assert.throws(
    () => parseArgs(["--manifest", "a", "--manifest=b"]),
    UsageError,
  );
});

test("parseArgs: bare positional throws UsageError", () => {
  assert.throws(() => parseArgs(["positional"]), UsageError);
  assert.throws(() => parseArgs(["--manifest", "a", "extra"]), UsageError);
});

test("parseArgs: --flag=value form accepted", () => {
  assert.deepEqual(parseArgs(["--manifest=a", "--images-dir=b"]), {
    manifestPath: "a",
    imagesDir: "b",
  });
  assert.deepEqual(parseArgs(["--manifest="]), { manifestPath: "" });
  assert.deepEqual(parseArgs(["--manifest=--value"]), {
    manifestPath: "--value",
  });
});

test("parseArgs: --help returns help", () => {
  assert.deepEqual(parseArgs(["--help"]), { help: true });
  assert.throws(() => parseArgs(["--bogus", "--help"]), UsageError);
  assert.deepEqual(parseArgs(["--help", "--bogus"]), { help: true });
  assert.deepEqual(parseArgs(["--help", "--help"]), { help: true });
});

test("cli: corrupt manifest exits 2", () => {
  withTempManifest(case15Text(), (manifestPath) => {
    const run = spawnCli([
      "--manifest",
      manifestPath,
      "--images-dir",
      REAL_IMAGES,
    ]);
    assert.equal(run.status, 2);
    assert.equal(run.stdout, `${manifestLine(manifestPath, REAL_IMAGES)}\n`);
  });
});

function assertUsageErrorSpawn(run) {
  assert.equal(run.status, 2);
  assert.equal(run.stdout, "");
  assert.ok(!run.stdout.includes("manifest: "));
  const lines = prefixedLines(run.stderr);
  assert.equal(lines.length, 1);
  assert.ok(lines[0].startsWith("validate-journal-manifest: "));
  assert.ok(lines[0].includes("--manifest"));
  assert.ok(lines[0].includes("--images-dir"));
  assert.ok(lines[0].includes("--help"));
}

test("cli: unknown flag exits 2 with prefixed usage line", () => {
  assertUsageErrorSpawn(spawnCli(["--bogus"]));
});

test("cli: missing flag value exits 2 with prefixed usage line", () => {
  assertUsageErrorSpawn(spawnCli(["--manifest"]));
});

test("cli: case 15 prints exactly one prefixed error line", () => {
  withTempManifest(case15Text(), (manifestPath) => {
    const run = spawnCli([
      "--manifest",
      manifestPath,
      "--images-dir",
      REAL_IMAGES,
    ]);
    assert.equal(run.status, 2);
    assert.equal(run.stdout, `${manifestLine(manifestPath, REAL_IMAGES)}\n`);
    const lines = prefixedLines(run.stderr);
    assert.equal(lines.length, 1);
    assert.ok(lines[0].startsWith("validate-journal-manifest: "));
    assert.ok(lines[0].includes("bad-voice"));
    assert.ok(lines[0].includes("field=voice"));
    assert.ok(lines[0].includes(`path=movies.${ID}.voice`));
    assert.ok(lines[0].includes("actual=morgan"));
    assert.ok(lines[0].includes("expected=one of the 8 known voice values"));
  });
});

test("cli: case 2f prints exactly two prefixed error lines", () => {
  withTempManifest(case2fText(), (manifestPath) => {
    const run = spawnCli([
      "--manifest",
      manifestPath,
      "--images-dir",
      REAL_IMAGES,
    ]);
    assert.equal(run.status, 2);
    assert.equal(run.stdout, `${manifestLine(manifestPath, REAL_IMAGES)}\n`);
    const lines = prefixedLines(run.stderr);
    assert.equal(lines.length, 2);
    const voiceLine = lines.find((line) => line.includes("bad-voice"));
    const fileLine = lines.find((line) => line.includes("bad-filename"));
    assert.ok(voiceLine);
    assert.ok(fileLine);
    assert.ok(voiceLine.includes("field=voice"));
    assert.ok(voiceLine.includes(`path=movies.${ID}.voice`));
    assert.ok(voiceLine.includes("actual=morgan"));
    assert.ok(voiceLine.includes("expected=one of the 8 known voice values"));
    assert.ok(fileLine.includes("field=file"));
    assert.ok(fileLine.includes(`path=movies.${ID2}.file`));
    assert.ok(fileLine.includes("actual=wrong.mp4"));
    assert.ok(fileLine.includes("expected=file == <id>.mp4"));
  });
});

test("cli: --help prints usage and exits 0", () => {
  const run = spawnCli(["--help"]);
  assert.equal(run.status, 0);
  assert.ok(run.stdout.includes("--manifest"));
  assert.ok(run.stdout.includes("--images-dir"));
  assert.ok(run.stdout.includes("--help"));
  assert.ok(!run.stdout.includes("manifest: "));
  assert.equal(run.stderr, "");

  const helpBogus = spawnCli(["--help", "--bogus"]);
  assert.equal(helpBogus.status, 0);
  assert.ok(helpBogus.stdout.includes("--manifest"));
  assert.ok(!helpBogus.stdout.includes("manifest: "));
  assert.equal(helpBogus.stderr, "");

  const bogusHelp = spawnCli(["--bogus", "--help"]);
  assert.equal(bogusHelp.status, 2);
  assert.equal(bogusHelp.stdout, "");
  const lines = prefixedLines(bogusHelp.stderr);
  assert.equal(lines.length, 1);
  assert.ok(lines[0].startsWith("validate-journal-manifest: "));
  assert.ok(lines[0].includes("--manifest"));
  assert.ok(lines[0].includes("--images-dir"));
  assert.ok(lines[0].includes("--help"));
});

test("cli: invalid JSON exits 3", () => {
  withTempManifest(case1Text(), (manifestPath) => {
    const run = spawnCli([
      "--manifest",
      manifestPath,
      "--images-dir",
      REAL_IMAGES,
    ]);
    assert.equal(run.status, 3);
    assert.equal(run.stdout, `${manifestLine(manifestPath, REAL_IMAGES)}\n`);
    assert.equal(prefixedLines(run.stderr).length, 1);
  });
});

test("validate(null) throws TypeError", () => {
  assert.throws(() => validate(null), TypeError);
});

test('validate("x") throws TypeError', () => {
  assert.throws(() => validate("x"), TypeError);
});

test("validate() with unknown option key throws TypeError", () => {
  assert.throws(() => validate({ bogus: "x" }), TypeError);
});

test("validate() with non-string option value throws TypeError", () => {
  assert.throws(() => validate({ manifestPath: 123 }), TypeError);
});

test("explicit option beats env var", () => {
  withTempDir((envDir) => {
    withTempDir((explicitDir) => {
      const envManifest = join(envDir, "env-manifest.json");
      const envImages = join(envDir, "env-images");
      const explicitManifest = join(explicitDir, "explicit-manifest.json");
      const explicitImages = join(explicitDir, "explicit-images");
      withEnv(
        {
          JOURNAL_MANIFEST_PATH: envManifest,
          JOURNAL_IMAGES_DIR: envImages,
        },
        () => {
          const result = validate({
            manifestPath: explicitManifest,
            imagesDir: explicitImages,
          });
          assert.equal(result.manifestPath, resolve(explicitManifest));
          assert.equal(result.imagesDir, resolve(explicitImages));
        },
      );
    });
  });
});

test("empty-string env var is treated as unset", () => {
  withEnv(
    { JOURNAL_MANIFEST_PATH: "", JOURNAL_IMAGES_DIR: "" },
    () => {
      const result = validate();
      assert.equal(result.manifestPath, REAL_MANIFEST);
      assert.equal(result.imagesDir, REAL_IMAGES);
    },
  );
});

test("env var beats default", () => {
  withTempDir((dir) => {
    const envManifest = join(dir, "env-manifest.json");
    const envImages = join(dir, "env-images");
    withEnv(
      {
        JOURNAL_MANIFEST_PATH: envManifest,
        JOURNAL_IMAGES_DIR: envImages,
      },
      () => {
        const result = validate();
        assert.equal(result.manifestPath, resolve(envManifest));
        assert.equal(result.imagesDir, resolve(envImages));
      },
    );
  });
});

test("whitespace-only env var is treated as unset", () => {
  withEnv(
    { JOURNAL_MANIFEST_PATH: "   ", JOURNAL_IMAGES_DIR: "   " },
    () => {
      const result = validate();
      assert.equal(result.manifestPath, REAL_MANIFEST);
      assert.equal(result.imagesDir, REAL_IMAGES);
    },
  );
});

test("undefined option is treated as unset", () => {
  withTempDir((dir) => {
    const envManifest = join(dir, "env-manifest.json");
    const envImages = join(dir, "env-images");
    withEnv(
      {
        JOURNAL_MANIFEST_PATH: envManifest,
        JOURNAL_IMAGES_DIR: envImages,
      },
      () => {
        const result = validate({
          manifestPath: undefined,
          imagesDir: undefined,
        });
        assert.equal(result.manifestPath, resolve(envManifest));
        assert.equal(result.imagesDir, resolve(envImages));
      },
    );
  });
});

test("empty-string explicit option is treated as unset", () => {
  withTempDir((dir) => {
    const envManifest = join(dir, "env-manifest.json");
    const envImages = join(dir, "env-images");
    withEnv(
      {
        JOURNAL_MANIFEST_PATH: envManifest,
        JOURNAL_IMAGES_DIR: envImages,
      },
      () => {
        const result = validate({ manifestPath: "", imagesDir: "" });
        assert.equal(result.manifestPath, resolve(envManifest));
        assert.equal(result.imagesDir, resolve(envImages));
      },
    );
  });
});

test("whitespace-only explicit option is treated as unset", () => {
  withTempDir((dir) => {
    const envManifest = join(dir, "env-manifest.json");
    const envImages = join(dir, "env-images");
    withEnv(
      {
        JOURNAL_MANIFEST_PATH: envManifest,
        JOURNAL_IMAGES_DIR: envImages,
      },
      () => {
        const result = validate({ manifestPath: "   ", imagesDir: "   " });
        assert.equal(result.manifestPath, resolve(envManifest));
        assert.equal(result.imagesDir, resolve(envImages));
      },
    );
  });
});

test("cli: pass prints exactly one stdout line", () => {
  withTempManifest(REAL_RAW, (manifestPath) => {
    const run = spawnCli([
      "--manifest",
      manifestPath,
      "--images-dir",
      REAL_IMAGES,
    ]);
    assert.equal(run.status, 0);
    assert.equal(run.stdout, `${manifestLine(manifestPath, REAL_IMAGES)}\n`);
    assert.equal(run.stderr, "");
  });
});

test("validate() prints nothing", () => {
  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  let stdoutCapture = "";
  let stderrCapture = "";
  process.stdout.write = (chunk, ...args) => {
    stdoutCapture += String(chunk);
    return true;
  };
  process.stderr.write = (chunk, ...args) => {
    stderrCapture += String(chunk);
    return true;
  };
  try {
    validate({ manifestPath: REAL_MANIFEST, imagesDir: REAL_IMAGES });
    assert.equal(stdoutCapture, "");
    assert.equal(stderrCapture, "");
    withTempManifest(case15Text(), (manifestPath) => {
      validate({ manifestPath, imagesDir: REAL_IMAGES });
    });
    assert.equal(stdoutCapture, "");
    assert.equal(stderrCapture, "");
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
});

test("wiring: prebuild and prebuild:pages invoke the validator", () => {
  const pkg = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  );
  assert.ok(pkg.scripts.prebuild.includes(VALIDATOR_STEP));
  assert.ok(pkg.scripts["prebuild:pages"].includes(VALIDATOR_STEP));
});
