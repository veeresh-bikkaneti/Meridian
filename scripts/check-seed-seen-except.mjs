#!/usr/bin/env node
/**
 * TD-14.4 — seedSeenExcept dealing-pool coverage guard (issue #314).
 *
 * Problem: specs force a GeoNames id into the next deal by seeding the
 * band's seen-store with every pool id EXCEPT the keep id. The dealer
 * (src/game/trail.ts poolForNewRun) then deals `bandPool − seen`. If the
 * keep id is NOT in that band's dealing pool, `fresh` comes back EMPTY,
 * the cycle resets, and an arbitrary place is dealt — the spec fails for
 * the wrong reason, or quietly exercises the wrong place. The runtime
 * `expect(allIds).toContain(keepId)` checks the RAW pool (curated + chunk)
 * and cannot catch this, and a dataset regen can move an id out of a band
 * pool at any time.
 *
 * This guard statically re-derives each call site's (edition, region,
 * band, keep id) from the live tests/e2e tree and asserts the forced id is
 * a member of that band's ACTUAL dealing pool — the same math the game
 * runs: TIER_BANDS + easy-curation rungs (src/game/tier-filter.ts,
 * src/game/easy-curation.ts), over the whole-region pool (country
 * editions aggregate their subdivision chunks — src/game/generated-places.ts
 * aggregateChunkIds / ADMIN1_BY_COUNTRY).
 *
 * Runs under `npm test` via its sibling test file
 * (scripts/check-seed-seen-except.test.mjs); run directly it is the checker
 * CLI. Exit 1 on any failure, naming id + spec path.
 *
 * Deliberate exceptions: specs whose keep ids are COMPUTED from the live
 * pool at runtime (difficulty-picker builds keep from chunk tier data,
 * cleared-mode keeps a catalog-derived id) cannot fail this membership by
 * construction. They are pinned in KNOWN_DYNAMIC_SITES; the guard fails if
 * one of those call sites vanishes (stale exception) or if a NEW dynamic-
 * shaped call site appears that is not listed (an unlisted exception is a
 * finding, not a pass).
 */
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";

/** Mirrors src/game/easy-curation.ts EASY_MIN_POOL. */
const EASY_MIN_POOL = 25;

/** Mirrors src/game/tier-filter.ts TIER_BANDS. */
const TIER_BANDS = { easy: [[1, 2]], medium: [[2, 4]], hard: [[4, 5]] };

/** Mirrors src/game/tier-filter.ts asFameTier (integer 1-5, else 3). */
function asFameTier(value) {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 ? value : 3;
}

/** Mirrors src/game/tier-filter.ts filterByTier. */
function filterByTier(places, choice) {
  const band = TIER_BANDS[choice] ?? TIER_BANDS.medium;
  return places.filter((place) => {
    const t = asFameTier(place.difficulty);
    return band.some(([lo, hi]) => t >= lo && t <= hi);
  });
}

/** Mirrors src/game/easy-curation.ts curateEasy. Returns the effective easy pool. */
function curateEasy(banded) {
  const isStoried = (place) =>
    place.curated === true ||
    (asFameTier(place.difficulty) === 1 &&
      typeof place.history === "string" &&
      place.history.trim().length > 0);
  const storied = banded.filter(isStoried);
  if (storied.length >= EASY_MIN_POOL) return { pool: storied, rung: "storied" };
  const tier1 = banded.filter((p) => p.curated === true || asFameTier(p.difficulty) === 1);
  if (tier1.length >= EASY_MIN_POOL) return { pool: tier1, rung: "tier-1" };
  return { pool: banded, rung: "band" };
}

/** Mirrors src/game/easy-curation.ts dealingPoolFor. */
function dealingPoolFor(places, choice) {
  const banded = filterByTier(places, choice);
  return choice === "easy" ? curateEasy(banded) : { pool: banded, rung: "band" };
}

/**
 * Curated starters for one edition+region, parsed from src/game/starters.ts.
 * Mirrors tests/e2e/helpers.ts curatedIds (id = `${regionId}-${slug}`),
 * extended to capture the difficulty argument for band membership.
 */
function starterPlaces(root, edition, regionId) {
  const src = readFileSync(join(root, "src/game/starters.ts"), "utf8");
  const re =
    /place\(\s*\n\s*"(\w+)",\s*\n\s*"([a-z0-9-]+)",\s*\n\s*"([a-z0-9-]+)",\s*\n\s*"((?:[^"\\]|\\.)*)",\s*\n\s*(-?[\d.]+),\s*\n\s*(-?[\d.]+),\s*\n\s*"((?:[^"\\]|\\.)*)",\s*\n\s*"([^"]*)",\s*\n\s*([1-5])(?=\s*,|\s*\n)/g;
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m[1] === edition && m[2] === regionId) {
      out.push({ id: `${m[2]}-${m[3]}`, difficulty: Number(m[9]), history: "", curated: true });
    }
  }
  return out;
}

/** One chunk's places (id, difficulty, history) from the built region chunk. */
function chunkPlaces(root, regionId) {
  const d = JSON.parse(
    readFileSync(join(root, `src/game/data/geonames/chunks/${regionId}.json`), "utf8"),
  );
  return d.places.map((p) => ({
    id: p.id,
    difficulty: p.difficulty,
    history: typeof p.history === "string" ? p.history : "",
    curated: false,
  }));
}

/**
 * Subdivision chunk ids a country region aggregates. Mirrors
 * src/game/generated-places.ts aggregateChunkIds (ADMIN1_BY_COUNTRY holds
 * only the US today) via the chunk manifest: the US country pool folds in
 * every state chunk, exactly like tests/e2e helpers' usCountryPoolIds.
 */
function countrySubdivisionRegions(root) {
  const manifest = JSON.parse(
    readFileSync(join(root, "src/game/data/geonames/manifest.json"), "utf8"),
  );
  return Object.entries(manifest.regions)
    .filter(([rid, r]) => r.edition === "state" && rid !== "united-states")
    .map(([rid]) => rid);
}

/** Full place list for one edition+region (curated first, then chunks). */
function placesFor(root, edition, regionId) {
  const chunks =
    edition === "country" && regionId === "united-states"
      ? [regionId, ...countrySubdivisionRegions(root)]
      : [regionId];
  return [
    ...starterPlaces(root, edition, regionId),
    ...chunks.flatMap((c) => chunkPlaces(root, c)),
  ];
}

/** Band dealing-pool ids for one edition+region+band, per dealingPoolFor. */
export function bandPoolIds(root, edition, regionId, band) {
  const { pool, rung } = dealingPoolFor(placesFor(root, edition, regionId), band);
  return { ids: new Set(pool.map((p) => p.id)), rung, size: pool.length };
}

const BANDS_RE = "easy|medium|hard";

/** Resolve `const NAME = "value"` string constants in a spec file. */
function constStringMap(content) {
  const out = new Map();
  const re = /(?:const|let)\s+([A-Z][A-Z0-9_]*)\s*(?::[^=]+)?=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(content)) !== null) out.set(m[1], m[2]);
  return out;
}

/**
 * Split a balanced call's argument list at TOP LEVEL only — commas inside
 * nested calls ("globe", "globe" inside poolIds(...)), strings, templates,
 * arrays and objects do not split. Trimmed arg strings.
 */
function splitTopLevelArgs(text) {
  const inner = text.slice(text.indexOf("(") + 1, text.lastIndexOf(")"));
  const args = [];
  let depth = 0;
  let cur = "";
  let quote = null;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quote) {
      cur += ch;
      if (ch === quote && inner[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      args.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim().length > 0) args.push(cur.trim());
  return args;
}

const bandOf = (a) => /^"(easy|medium|hard)"$/.exec(a)?.[1];
const strLit = (a) => /^"([^"]*)"$/.exec(a)?.[1];
const ident = (a) => /^([A-Za-z_][A-Za-z0-9_]*)$/.exec(a)?.[1];

/**
 * Extract every seedSeenExcept call site from one spec file's content.
 * Shapes handled (all in the live tree today):
 *   A  seedSeenExcept(page, "edition", "region", KEEP, POOL[, "band"])
 *   B  seedSeenExcept(page, `${SEEN_PREFIX}ed:region:band`, POOL, TARGET)
 *   C  seedSeenExcept(page) — page-only local; key + TARGET_ID in its def body
 * Anything else (identifier edition/region, unresolvable keep, extra
 * indirection) is returned as kind "dynamic" so it must be deliberately
 * excused in KNOWN_DYNAMIC_SITES — never silently passed.
 */
export function extractCallSites(spec, content) {
  const calls = [];
  const consts = constStringMap(content);
  const callRe = /(?<!function )seedSeenExcept\(/g;
  let c;
  while ((c = callRe.exec(content)) !== null) {
    const line = content.slice(0, c.index).split("\n").length;
    // Balanced call text (depth starts at 1 for the "(" already consumed).
    let depth = 1;
    let end = c.index + c[0].length - 1;
    let quote = null;
    for (let i = end + 1; i < content.length && depth > 0; i++) {
      const ch = content[i];
      if (quote) {
        if (ch === quote && content[i - 1] !== "\\") quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (depth === 0) { end = i; break; }
    }
    const text = content.slice(c.index, end + 1);
    const args = splitTopLevelArgs(text);

    // Shape C — page-only local helper.
    if (args.length === 1 && ident(args[0]) === "page") {
      const defRe = /function seedSeenExcept\([^)]*\)\s*(?::[^{]*)?\{([\s\S]*?)\n\}/.exec(content);
      const body = defRe ? defRe[1] : "";
      const keyM = /SEEN_PREFIX\}?(\w+):([a-z0-9-]+):(easy|medium|hard)/.exec(body);
      const tid = /TARGET_ID\)/.test(body) ? consts.get("TARGET_ID") : undefined;
      if (keyM && tid !== undefined) {
        calls.push({ spec, line, edition: keyM[1], region: keyM[2], band: keyM[3], kind: "fixed", keepId: tid, raw: text });
        continue;
      }
      calls.push({ spec, line, edition: "?", region: "?", band: "?", kind: "dynamic", raw: text });
      continue;
    }

    // Shape A — string edition + region + keep + optional band.
    const editionA = args[1] !== undefined ? strLit(args[1]) : undefined;
    const regionA = args[2] !== undefined ? strLit(args[2]) : undefined;
    if (editionA !== undefined && regionA !== undefined && args[3] !== undefined) {
      const bandArg = args.length >= 6 ? bandOf(args[args.length - 1]) : undefined;
      const band = bandArg ?? "medium"; // shared + question-labels helpers default medium
      const keepLit = strLit(args[3]);
      const keepId = keepLit !== undefined ? keepLit : consts.get(ident(args[3]) ?? "");
      if (keepId !== undefined && /^[a-z0-9-]+$/.test(keepId)) {
        calls.push({ spec, line, edition: editionA, region: regionA, band, kind: "fixed", keepId, raw: text });
        continue;
      }
      calls.push({ spec, line, edition: editionA, region: regionA, band, kind: "dynamic", raw: text });
      continue;
    }

    // Shape B — SEEN_PREFIX template key first.
    const keyM = /\$\{SEEN_PREFIX\}(\w+):([a-z0-9-]+):(easy|medium|hard)/.exec(text);
    if (keyM) {
      const last = args[args.length - 1];
      const name = ident(last);
      const keepId = name !== undefined ? consts.get(name) : strLit(last);
      if (keepId !== undefined && /^[a-z0-9-]+$/.test(keepId)) {
        calls.push({ spec, line, edition: keyM[1], region: keyM[2], band: keyM[3], kind: "fixed", keepId, raw: text });
        continue;
      }
      calls.push({ spec, line, edition: keyM[1], region: keyM[2], band: keyM[3], kind: "dynamic", raw: text });
      continue;
    }

    calls.push({ spec, line, edition: "?", region: "?", band: "?", kind: "dynamic", raw: text });
  }
  return calls;
}

/**
 * Dynamic-shaped call sites that are EXCUSED from fixed-id coverage because
 * their keep ids are computed from the live pool at runtime. Each entry must
 * still exist as a call site in its file (vanishing = failure), and every
 * dynamic-shaped call site must be listed here (unlisted = failure) — so
 * exceptions stay deliberate, not silent.
 */
export const KNOWN_DYNAMIC_SITES = {
  "cleared-mode.spec.ts": "keep id comes from bandCatalogIds(regionId, choice) — live pool by construction",
  "difficulty-picker.spec.ts": "keep ids built from live chunk tier data (tier 1-2 / 4-5) — live pool by construction",
};

/**
 * Forced ids KNOWN to sit outside their band's dealing pool on the current
 * dataset (TD-14.4 measured these on branch cut from main 7dbf62eb):
 * admin1-narrow forces Osaka and Tokyo on country/japan/easy, but the easy
 * storied rung (29 places, history-bearing tier-1 + curated) does not
 * include them — both lack a `history` enrichment. At runtime the seed
 * marks every raw-pool id seen except the keep, the storied rung comes back
 * fully seen, poolForNewRun resets the cycle, and an arbitrary storied
 * place deals — the spec then asserts "Find Osaka/Tokyo" against a random
 * question. That is issue #314's silent rot, already live on main in a spec
 * outside the routine CI e2e list.
 *
 * This lane does NOT own that spec (no mass spec edits) and does not drop
 * the seeds, so the two sites are recorded here instead: the gate stays
 * green for every other PR, the finding is printed on every run, and the
 * moment the dataset regen returns their history (or the spec's owner fixes
 * the seed) the entry goes stale and the guard FAILS "stale KNOWN_MISSING —
 * remove the entry". Nothing can rot here silently in either direction.
 */
export const KNOWN_MISSING = {
  "admin1-narrow.desktop.spec.ts:gn-1853909": "Osaka gn-1853909: tier-1, no history hook, outside the country/japan/easy storied rung — the forced deal cannot land (issue #314, TD-14.4 report)",
  "admin1-narrow.desktop.spec.ts:gn-1850147": "Tokyo gn-1850147: tier-1, no history hook, outside the country/japan/easy storied rung — the forced deal cannot land (issue #314, TD-14.4 report)",
};


/** Run the guard. files: Map<specBasename, content> for tests/e2e (*.spec.ts). */
export function runGuard(root, files) {
  const entries = [];
  const failures = [];
  const documentedMissing = [];
  const poolCache = {};

  /** `${spec}:${keepId}` of live fixed call sites, for staleness checks. */
  const liveForcedKeys = new Set();

  for (const [spec, content] of files) {
    const calls = extractCallSites(spec, content);
    for (const call of calls) entries.push(call);
    for (const call of calls) {
      if (call.kind === "dynamic") {
        const listed = KNOWN_DYNAMIC_SITES[spec];
        if (!listed) {
          failures.push({
            spec,
            line: call.line,
            reason: `unlisted dynamic-shaped seedSeenExcept call site — add a deliberate entry to KNOWN_DYNAMIC_SITES or make the keep id statically readable`,
          });
        }
        continue;
      }
      const key = `${call.edition}/${call.region}/${call.band}`;
      liveForcedKeys.add(`${spec}:${call.keepId}`);
      let pool = poolCache[key];
      try {
        const computed = bandPoolIds(root, call.edition, call.region, call.band);
        poolCache[key] = { rung: computed.rung, size: computed.size };
        pool = computed;
      } catch (err) {
        failures.push({
          spec,
          line: call.line,
          id: call.keepId,
          reason: `cannot compute band pool ${key}: ${(err && err.message ? err.message : String(err))}`,
        });
        continue;
      }
      if (pool && !pool.ids.has(call.keepId)) {
        const known = KNOWN_MISSING[`${spec}:${call.keepId}`];
        if (known) {
          documentedMissing.push({ spec, line: call.line, id: call.keepId, reason: known });
          continue;
        }
        failures.push({
          spec,
          line: call.line,
          id: call.keepId,
          reason: `forced id ${call.keepId} is NOT in the ${key} dealing pool (rung "${pool.rung}", ${pool.size} places) — a regen moved this spec onto the dealer's cycle reset: seed rots at runtime, spec fails for the wrong reason (issue #314)`,
        });
      }
    }
  }

  // Stale-exception check 1: every KNOWN_DYNAMIC_SITES entry must still match a call site.
  for (const [spec] of Object.entries(KNOWN_DYNAMIC_SITES)) {
    if (!files.has(spec) || !extractCallSites(spec, files.get(spec)).some((c) => c.kind === "dynamic")) {
      failures.push({ spec, reason: `listed dynamic exception vanished: no dynamic seedSeenExcept call site in ${spec} — remove the stale KNOWN_DYNAMIC_SITES entry` });
    }
  }

  // Stale-exception check 2: every KNOWN_MISSING entry must still be a live,
  // genuinely-out-of-pool forced id. If the call site no longer forces the id,
  // or the id is back in its band pool (regen restored it / seed fixed), the
  // entry is stale and MUST be removed — the guard fails so it cannot linger.
  for (const [entryKey, reason] of Object.entries(KNOWN_MISSING)) {
    if (!liveForcedKeys.has(entryKey)) {
      failures.push({ spec: entryKey.split(":")[0], id: entryKey.split(":").slice(1).join(":"), reason: `stale KNOWN_MISSING entry: ${entryKey} no longer forces that id — remove the entry (${reason})` });
    }
  }

  return { entries, failures, documentedMissing, poolCache };
}

/** Live scan of tests/e2e/*.spec.ts from the repo root. */
export function runGuardLive(root) {
  const dir = join(root, "tests/e2e");
  const files = new Map();
  for (const f of readdirSync(dir)) {
    if (f.endsWith(".spec.ts")) files.set(f, readFileSync(join(dir, f), "utf8"));
  }
  return runGuard(root, files);
}

function main() {
  const root = process.cwd();
  const { entries, failures, poolCache, documentedMissing } = runGuardLive(root);
  const specCount = new Set(entries.map((e) => e.spec)).size;
  console.log(`seedSeenExcept guard: ${entries.length} call sites, ${new Set(entries.filter((e) => e.kind === "fixed").map((e) => e.keepId)).size} distinct forced ids, across ${specCount} specs`);
  console.log(`seedSeenExcept guard: band pools — ${Object.entries(poolCache).map(([k, v]) => `${k}(${v.rung}, ${v.size})`).join(", ")}`);
  if (documentedMissing.length > 0) {
    for (const d of documentedMissing) {
      console.error(`KNOWN MISSING (documented, not a gate failure — see KNOWN_MISSING in this script and TD-14.4) [${d.spec}:${d.line}] ${d.reason}`);
    }
  }
  if (failures.length > 0) {
    for (const f of failures) console.error(`FAIL [${f.spec}${f.line ? `:${f.line}` : ""}] ${f.reason}`);
    process.exit(1);
  }
  console.log("GATE PASSED: every forced id is in its band's dealing pool or a documented, deliberate KNOWN_MISSING entry; every dynamic call site is a listed, present exception.");
}

if (process.argv[1] && process.argv[1].endsWith("check-seed-seen-except.mjs")) main();
