// Validates public/videos/journal-manifest.json against the in-repo ground
// truth (public/images/journal/*.webp). Standalone gate script for Meridian
// PR #369 — see ~/workspace/journal-manifest-validation-spec.md (v20).
//
// Exit codes: 0 pass · 2 invalid · 3 cannot validate (mixed class: 3 wins).
// Every error is printed as ONE stderr line prefixed with
// `validate-journal-manifest:`; the resolved paths are printed as exactly
// ONE stdout line (`manifest: <path> | images: <dir>`) on every run that
// reaches validate(). validate() itself is pure — it never writes output.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const BASE_URL =
  "https://veeresh-bikkaneti.github.io/meridian-media/journal/";

// The 8 known voice values. Note: `vdc_5723` and `avocado_v2:vdc_5723` are
// genuinely distinct values — both are in the allowlist on purpose.
const KNOWN_VOICES = new Set([
  "miles",
  "avocado_v2:magnus",
  "avocado_v2:casper",
  "vdc_NOID19",
  "vdc_2561",
  "vdc_5723",
  "avocado_v2:briggs",
  "avocado_v2:vdc_5723",
]);

// Journal places whose movie is withheld on purpose: the picture stays
// and the player shows "This story's movie isn't ready yet." Their
// narration named religious buildings or sacred status, which the owner
// ruled out (2026-11-10). Each needs a new voice track before its entry
// comes back. An image basename listed here may have no movies entry.
export const WITHHELD_IDS = new Set(["angkor", "potala", "timbuktu", "uluru"]);

const TOP_KEYS = ["baseUrl", "movies", "version"];
const ENTRY_KEYS = ["file", "duration", "voice", "note", "verified"];

// Pinned expected-value wording per error code (spec's per-code table).
const EXPECTED = {
  "unreadable-manifest": "manifest file exists and is readable",
  "invalid-json":
    "parseable JSON object with keys baseUrl, movies, version",
  "top-level-not-object": "top-level JSON object",
  "missing-top-key":
    "all top-level keys present: baseUrl, movies, version",
  "extra-top-key": "exactly the top-level keys baseUrl, movies, version",
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

// Codes in the 3-class (CANNOT VALIDATE); all other codes are 2-class.
const EXIT_3 = new Set([
  "unreadable-manifest",
  "invalid-json",
  "top-level-not-object",
  "non-object-movies",
  "ground-truth-missing",
]);

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
    this.exitCode = 2;
  }
}

const USAGE_LINE =
  "Usage: node scripts/validate-journal-manifest.mjs --manifest <path> --images-dir <dir> [--help]";

const USAGE_TEXT = `${USAGE_LINE}

Validates the journal manifest (public/videos/journal-manifest.json) against
the journal images (public/images/journal/*.webp).

  --manifest <path>    Path to the journal manifest JSON file.
  --images-dir <dir>   Directory holding the journal .webp images.
  --help               Print this usage and exit.
`;

// `actual` for a fault value: the scalar itself, or typeof for non-scalars.
function actualOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return value;
}

// `actual` for a top-level non-object: always the value's type.
function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function makeError(code, field, path, actual) {
  return { code, field, path, expected: EXPECTED[code], actual };
}

function finish(errors, manifestPath, imagesDir) {
  const has3 = errors.some((e) => EXIT_3.has(e.code));
  const exitCode = errors.length === 0 ? 0 : has3 ? 3 : 2;
  return { ok: errors.length === 0, errors, manifestPath, imagesDir, exitCode };
}

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

// `YYYY-MM-DD` AND a real calendar date, via round-trip component equality
// with setUTCFullYear. Date.UTC is NOT used: it maps years 0–99 to
// 1900–1999 and would misclassify the real date 0099-01-01. Date.parse is
// NOT used: it accepts 2026-02-30 (rolls to Mar 2).
function isRealDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(0);
  dt.setUTCFullYear(y, m - 1, d);
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

// ---------------------------------------------------------------------------
// Duplicate scan (check 5): a string-aware tokenizer over the raw text with
// an explicit container stack. The file is minified single-line, so line or
// indent matching is forbidden. Strings are consumed whole with escape
// handling; each consumed key string is JSON-DECODED before comparison, so
// "voi\u0063e" and "voice" compare equal. A string followed by optional JSON
// whitespace then ':' is a key; a string followed by ','/'}'/']' is a value
// and is never counted. Optional JSON whitespace is skipped after ':' before
// '{'/'['. The root object frame {key: null} sits at depth 0 and is NEVER
// popped; the opening '{' of the root object does NOT push a second frame.
// Array counters increment ONLY when ',' is encountered while the innermost
// open container is that array; a ',' increments the counter BEFORE the
// following '{' or '[' takes its index. Path construction is segment-based:
// a key appends '.<key>', an array element appends '[<index>]', with the
// bare-segment exception when the parent path is empty.
// ---------------------------------------------------------------------------

function scanDuplicates(raw) {
  const errors = [];
  const isWs = (ch) => ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
  // Object frame: { isArray: false, key, index, path }.
  // Array record: { isArray: true, key, counter, index, path }.
  // Duplicates are detected by PATH: any key path occurring twice is a
  // duplicate (so duplicating a whole entry block repeats the movie key
  // AND all 5 inner keys — case 4 yields 6 errors, not 1).
  const seenPaths = new Set();
  const root = { isArray: false, key: null, index: null, path: "" };
  const stack = [root];
  let i = 0;
  const n = raw.length;
  let seenRootBrace = false;

  function skipWs() {
    while (i < n && isWs(raw[i])) i++;
  }

  // Consumes a string token starting at raw[i] === '"' and returns the
  // JSON-DECODED string; advances i past the closing quote.
  function readString() {
    const start = i;
    i++; // opening quote
    while (i < n) {
      const ch = raw[i];
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === '"') {
        i++;
        break;
      }
      i++;
    }
    return JSON.parse(raw.slice(start, i));
  }

  while (i < n) {
    const ch = raw[i];
    if (isWs(ch)) {
      i++;
      continue;
    }
    if (ch === '"') {
      const decoded = readString();
      let j = i;
      while (j < n && isWs(raw[j])) j++;
      if (j < n && raw[j] === ":") {
        // Key: check for a duplicate by full path.
        const frame = stack[stack.length - 1];
        const keyPath = frame.path === "" ? decoded : `${frame.path}.${decoded}`;
        if (seenPaths.has(keyPath)) {
          errors.push(makeError("duplicate-key", decoded, keyPath, decoded));
        } else {
          seenPaths.add(keyPath);
        }
        i = j + 1; // consume ':'
        skipWs();
        if (i < n && raw[i] === "{") {
          const framePath = frame.path === "" ? decoded : `${frame.path}.${decoded}`;
          stack.push({ isArray: false, key: decoded, index: null, path: framePath });
          i++;
        } else if (i < n && raw[i] === "[") {
          const recPath = frame.path === "" ? decoded : `${frame.path}.${decoded}`;
          stack.push({ isArray: true, key: decoded, counter: 0, index: null, path: recPath });
          i++;
        }
        // Else a scalar value: nothing to push.
      }
      // Else a string value: never counted.
      continue;
    }
    if (ch === "{") {
      if (!seenRootBrace) {
        seenRootBrace = true; // the root object's '{' pushes no frame
        i++;
        continue;
      }
      const enclosing = stack[stack.length - 1];
      const index = enclosing && enclosing.isArray ? enclosing.counter : 0;
      const parentPath = enclosing ? enclosing.path : "";
      stack.push({
        isArray: false,
        key: null,
        index,
        path: `${parentPath}[${index}]`,
      });
      i++;
      continue;
    }
    if (ch === "[") {
      // An array element (keyed arrays are consumed at the key step).
      const enclosing = stack[stack.length - 1];
      const index = enclosing && enclosing.isArray ? enclosing.counter : null;
      const parentPath = enclosing ? enclosing.path : "";
      const recPath = index === null ? parentPath : `${parentPath}[${index}]`;
      stack.push({ isArray: true, key: null, counter: 0, index, path: recPath });
      i++;
      continue;
    }
    if (ch === "}") {
      if (stack.length > 1) stack.pop();
      i++;
      continue;
    }
    if (ch === "]") {
      if (stack.length > 1) stack.pop();
      i++;
      continue;
    }
    if (ch === ",") {
      const top = stack[stack.length - 1];
      if (top && top.isArray) top.counter++;
      i++;
      continue;
    }
    // Numbers, literals: skip one char (delimiters are handled above).
    i++;
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Ground-truth guard (check 8): counts entries where stat().isFile() is true
// (symlink-following) AND the basename ends in '.webp'. A stat() failure on
// an individual entry (e.g. a broken symlink) is skipped — the guard never
// throws for a ground-truth fault. Returns { set, error } where set is the
// basename set (without '.webp') or null when the dir itself is unusable.
// ---------------------------------------------------------------------------

function groundTruth(imagesDir) {
  const gtError = (actual) =>
    makeError("ground-truth-missing", "imagesDir", imagesDir, actual);
  let stat;
  try {
    stat = statSync(imagesDir);
  } catch (error) {
    if (error && error.code === "ENOENT") return { set: null, error: gtError("absent") };
    if (error && error.code === "ENOTDIR") return { set: null, error: gtError("not-a-directory") };
    return { set: null, error: gtError(error && error.code ? error.code : "unknown") };
  }
  if (!stat.isDirectory()) {
    return { set: null, error: gtError("not-a-directory") };
  }
  let names;
  try {
    names = readdirSync(imagesDir);
  } catch (error) {
    if (error && error.code === "ENOENT") return { set: null, error: gtError("absent") };
    if (error && error.code === "ENOTDIR") return { set: null, error: gtError("not-a-directory") };
    return { set: null, error: gtError(error && error.code ? error.code : "unknown") };
  }
  const set = new Set();
  for (const name of names) {
    if (!name.endsWith(".webp")) continue;
    let entryStat;
    try {
      entryStat = statSync(join(imagesDir, name));
    } catch {
      continue; // e.g. broken symlink — skipped, counts as not-a-file
    }
    if (entryStat.isFile()) set.add(name.slice(0, -".webp".length));
  }
  if (set.size === 0) {
    return { set, error: gtError(0) };
  }
  return { set, error: null };
}

function resolveInput(optionValue, envName, defaultPath) {
  if (typeof optionValue === "string" && optionValue.trim() !== "") {
    return resolve(optionValue);
  }
  const envValue = process.env[envName];
  if (typeof envValue === "string" && envValue.trim() !== "") {
    return resolve(envValue);
  }
  return defaultPath;
}

// validate() is SYNCHRONOUS and returns — never throws — for every
// manifest/content/ground-truth fault. It throws TypeError only for
// programming errors (non-object options, unknown option key, non-string
// option value). It is PURE: no stdout/stderr output. Returns
// { ok, errors, manifestPath, imagesDir, exitCode } with ok defined as
// errors.length === 0 and errors [] on pass.
export function validate(options = {}) {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("validate() expects an options object");
  }
  for (const key of Object.keys(options)) {
    if (key !== "manifestPath" && key !== "imagesDir") {
      throw new TypeError(`validate(): unknown option ${key}`);
    }
  }
  for (const key of ["manifestPath", "imagesDir"]) {
    const value = options[key];
    if (value !== undefined && typeof value !== "string") {
      throw new TypeError(`validate(): ${key} must be a string`);
    }
  }
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const defaultManifest = join(scriptDir, "..", "public", "videos", "journal-manifest.json");
  const defaultImages = join(scriptDir, "..", "public", "images", "journal");
  const manifestPath = resolveInput(options.manifestPath, "JOURNAL_MANIFEST_PATH", defaultManifest);
  const imagesDir = resolveInput(options.imagesDir, "JOURNAL_IMAGES_DIR", defaultImages);

  // Unreadable manifest: single error, nothing runs (suppression matrix).
  let raw;
  try {
    raw = readFileSync(manifestPath, "utf8");
  } catch (error) {
    const actual =
      error && error.code === "ENOENT"
        ? "absent"
        : error && error.code
          ? error.code
          : "unknown";
    return finish(
      [makeError("unreadable-manifest", "manifest", manifestPath, actual)],
      manifestPath,
      imagesDir,
    );
  }

  // Unparseable JSON: single error, fail-fast (suppression matrix).
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    const message = error && error.message ? error.message : "";
    const match = /at position (\d+)/.exec(message);
    let actual;
    if (match) {
      const pos = Number(match[1]);
      const start = Math.max(0, pos - 20);
      actual = raw.slice(start, start + 40);
    } else {
      actual = raw.slice(0, 40);
    }
    return finish(
      [makeError("invalid-json", "manifest", manifestPath, actual)],
      manifestPath,
      imagesDir,
    );
  }

  // Top-level non-object: single error, nothing runs (suppression matrix).
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return finish(
      [makeError("top-level-not-object", "manifest", manifestPath, typeOf(data))],
      manifestPath,
      imagesDir,
    );
  }

  const errors = [];

  // Check 5 (duplicate scan) runs whenever the top level is an object.
  errors.push(...scanDuplicates(raw));

  // Check 1: top-level keys — exactly { baseUrl, movies, version }.
  for (const key of TOP_KEYS) {
    if (!has(data, key)) {
      errors.push(makeError("missing-top-key", key, key, "absent"));
    }
  }
  for (const key of Object.keys(data)) {
    if (!TOP_KEYS.includes(key)) {
      errors.push(makeError("extra-top-key", key, key, key));
    }
  }

  // Check 2: baseUrl (only when present; missing is check 1 only).
  if (has(data, "baseUrl")) {
    const value = data.baseUrl;
    if (value === "") {
      errors.push(makeError("empty-field", "baseUrl", "baseUrl", ""));
    } else if (value !== BASE_URL) {
      errors.push(makeError("bad-base-url", "baseUrl", "baseUrl", actualOf(value)));
    }
  }

  // Check 7, top-level part: version (only when present).
  if (has(data, "version")) {
    const value = data.version;
    if (value === "") {
      errors.push(makeError("empty-field", "version", "version", ""));
    } else if (value !== 1) {
      errors.push(makeError("bad-version", "version", "version", actualOf(value)));
    }
  }

  // movies: non-object (exit 3) suppresses checks 3/4/6 and entry-shape 7;
  // missing movies suppresses the same, but the guard still runs.
  const hasMovies = has(data, "movies");
  let moviesOk = false;
  if (hasMovies) {
    const movies = data.movies;
    if (movies === null || typeof movies !== "object" || Array.isArray(movies)) {
      errors.push(makeError("non-object-movies", "movies", "movies", actualOf(movies)));
    } else {
      moviesOk = true;
    }
  }

  // Check 8 (ground-truth guard) runs regardless of the movies shape; its
  // error is emitted below, after the content checks.
  const gt = groundTruth(imagesDir);

  // Checks 3/4 run only with a usable movies object AND a passing guard.
  if (moviesOk && gt.error === null) {
    for (const basename of gt.set) {
      if (!has(data.movies, basename) && !WITHHELD_IDS.has(basename)) {
        errors.push(makeError("missing-id", basename, `movies.${basename}`, "absent"));
      }
    }
    for (const key of Object.keys(data.movies)) {
      if (!gt.set.has(key)) {
        errors.push(makeError("unknown-id", key, `movies.${key}`, key));
      }
    }
  }

  // Checks 6/7 per entry (only with a usable movies object).
  if (moviesOk) {
    for (const [id, entry] of Object.entries(data.movies)) {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
        errors.push(
          makeError("entry-not-object", id, `movies.${id}`, actualOf(entry)),
        );
        continue;
      }
      // Check 7, entry-shape part: exactly { file, duration, voice, note,
      // verified }. Missing → entry-shape only; extra → entry-shape only.
      for (const key of ENTRY_KEYS) {
        if (!has(entry, key)) {
          errors.push(makeError("entry-shape", key, `movies.${id}.${key}`, "absent"));
        }
      }
      for (const key of Object.keys(entry)) {
        if (!ENTRY_KEYS.includes(key)) {
          errors.push(makeError("entry-shape", key, `movies.${id}.${key}`, key));
        }
      }
      // Field-code rule with EXPLICIT PRECEDENCE (one error per faulty
      // field, among the value checks): missing → entry-shape (above);
      // EMPTY STRING → empty-field only; wrong type/value → the field's
      // dedicated code only. duplicate-key is ORTHOGONAL and may co-occur
      // (it is emitted by the scan above, not here).
      if (has(entry, "file")) {
        const value = entry.file;
        if (value === "") {
          errors.push(makeError("empty-field", "file", `movies.${id}.file`, ""));
        } else if (value !== `${id}.mp4`) {
          errors.push(makeError("bad-filename", "file", `movies.${id}.file`, actualOf(value)));
        }
      }
      if (has(entry, "duration")) {
        const value = entry.duration;
        if (value === "") {
          errors.push(makeError("empty-field", "duration", `movies.${id}.duration`, ""));
        } else if (typeof value !== "number" || !(value > 0)) {
          errors.push(makeError("bad-duration", "duration", `movies.${id}.duration`, actualOf(value)));
        }
      }
      if (has(entry, "voice")) {
        const value = entry.voice;
        if (value === "") {
          errors.push(makeError("empty-field", "voice", `movies.${id}.voice`, ""));
        } else if (typeof value !== "string" || !KNOWN_VOICES.has(value)) {
          errors.push(makeError("bad-voice", "voice", `movies.${id}.voice`, actualOf(value)));
        }
      }
      if (has(entry, "note")) {
        const value = entry.note;
        if (value === "") {
          errors.push(makeError("empty-field", "note", `movies.${id}.note`, ""));
        } else if (typeof value !== "string") {
          errors.push(makeError("bad-note", "note", `movies.${id}.note`, actualOf(value)));
        }
      }
      if (has(entry, "verified")) {
        const value = entry.verified;
        if (value === "") {
          errors.push(makeError("empty-field", "verified", `movies.${id}.verified`, ""));
        } else if (typeof value !== "string" || !isRealDate(value)) {
          errors.push(makeError("bad-verified", "verified", `movies.${id}.verified`, actualOf(value)));
        }
      }
    }
  }

  if (gt.error !== null) {
    errors.push(gt.error);
  }

  return finish(errors, manifestPath, imagesDir);
}

// ---------------------------------------------------------------------------
// Argument parsing (unit-testable). parseArgs(argv) takes the SLICED args
// (process.argv.slice(2)) and returns { manifestPath, imagesDir } (explicit
// values only; unset flags are absent). It accepts '--flag value' AND
// '--flag=value'. It throws UsageError (exitCode 2) on an unknown flag, a
// flag with a missing value, a repeated flag, or a bare positional. A value
// beginning with '--' counts as a MISSING value (space form only, so
// '--flag=--value' is a literal value). '--flag=' yields an empty-string
// value (treated as UNSET downstream, not a missing-value error). '--help'
// short-circuits at encounter (returns { help: true } without processing
// LATER tokens), but tokens BEFORE it are still validated.
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const result = {};
  const seen = new Set();
  const known = new Map([
    ["--manifest", "manifestPath"],
    ["--images-dir", "imagesDir"],
  ]);
  let i = 0;
  while (i < argv.length) {
    const token = argv[i];
    if (token === "--help") {
      return { help: true };
    }
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      let flag;
      let value;
      let hasValue;
      if (eq !== -1) {
        flag = token.slice(0, eq);
        value = token.slice(eq + 1);
        hasValue = true;
      } else {
        flag = token;
        hasValue = false;
      }
      if (!known.has(flag)) {
        throw new UsageError(`unknown flag ${flag}`);
      }
      if (seen.has(flag)) {
        throw new UsageError(`repeated flag ${flag}`);
      }
      seen.add(flag);
      if (!hasValue) {
        // Space form: the next token must exist and must not start with '--'.
        if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) {
          throw new UsageError(`missing value for ${flag}`);
        }
        value = argv[i + 1];
        i += 2;
      } else {
        i += 1;
      }
      result[known.get(flag)] = value;
      continue;
    }
    throw new UsageError(`unexpected argument ${token}`);
  }
  return result;
}

// ---------------------------------------------------------------------------
// CLI: one stdout line (`manifest: <path> | images: <dir>`, printed FROM the
// validate() result fields) on every run that reaches validate(); one
// prefixed stderr line per error; UsageError → exit 2 with exactly one
// prefixed usage line on stderr; --help → usage on stdout, exit 0.
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`validate-journal-manifest: ${USAGE_LINE}\n`);
      process.exitCode = error.exitCode;
      return;
    }
    throw error;
  }
  if (args.help) {
    process.stdout.write(USAGE_TEXT);
    process.exitCode = 0;
    return;
  }
  const result = validate({
    manifestPath: args.manifestPath,
    imagesDir: args.imagesDir,
  });
  process.stdout.write(`manifest: ${result.manifestPath} | images: ${result.imagesDir}\n`);
  for (const error of result.errors) {
    process.stderr.write(
      `validate-journal-manifest: ${error.code} field=${error.field} path=${error.path} actual=${error.actual} expected=${error.expected}\n`,
    );
  }
  process.exitCode = result.exitCode;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
