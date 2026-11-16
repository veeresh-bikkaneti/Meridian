/**
 * clue-giveaway.mjs — audit the PUBLISHED GeoDetective clue files
 * (public/loop/clues/*.json) for clues that give the answer away before
 * the giveaway slot (item 31, live-walk finding B35).
 *
 * Two rules, checked on every case:
 *
 * - NAME_LEAK (slots 1-5): a clue contains the answer's name or an alias.
 *   This is the generation prompt's locked §4 ban, re-checked here on the
 *   shipped files (the production validator in validate-clues.mjs checks
 *   records before assembly; nothing re-checked the published artifact).
 *   Terms come from that validator's buildLeakTerms/findLeaks.
 *
 * - CAPITAL_GIVEAWAY (slots 1-4): a clue states, in the present tense,
 *   that the answer IS the capital or chief city of a NAMED region (its
 *   subdivision or its country) — "It is the chief city of
 *   Bashkortostan", "the capital and largest city of Queensland". That
 *   names the answer to anyone who knows the region's capital, so it
 *   belongs in slot 5 (the giveaway), not in an early slot. The bright
 *   line is the named region: "capital of a state in India" (region
 *   unnamed) is the corpus's standard narrowing style and is NOT this
 *   rule; past-tense capital history ("became the capital in 1868"),
 *   capital facts about a different named place ("Nuuk, the capital of
 *   Greenland", in a clue about Sisimiut), and metaphorical capitals
 *   ("the health capital of India") are not this rule either. Those
 *   borderline classes are listed for the educator seat in the item 31
 *   PR, not enforced here.
 *
 * Known violations on main are pinned in clue-giveaway-baseline.json,
 * the same pattern as lint-subject-leads-baseline.json: they print as
 * KNOWN, a NEW violation fails, and a baselined case that stops
 * violating fails as STALE (remove its entry — the baseline only
 * shrinks). A baselined case is cured by moving the offending clue to
 * slot 5 AND re-rendering the two affected audio lines: the detective
 * audio manifest records each line's text and speed per position
 * (CLUE_SPEEDS differ per slot), so a text-only reorder would make
 * Watson read the wrong words and fail check:detective-audio. The
 * reorder + re-render cure is educator-gated content work; this audit
 * is the gate that keeps the list exact and stops new cases joining it.
 *
 * Run: node scripts/clues/clue-giveaway.mjs [--baseline <path>]
 * Tests: node --test scripts/clues/clue-giveaway.test.mjs (in npm test).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { foldText } from "./schema.mjs";
import { buildLeakTerms, findLeaks } from "./validate-clues.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_BASELINE = join(HERE, "clue-giveaway-baseline.json");

/** Production record files carrying accepted clue sets, in load order
 * (later files win: records-union-step1.jsonl is the merged set). */
const RECORD_FILES = [
  "records.jsonl",
  "records-scope.jsonl",
  "records-tier2-wave1.jsonl",
  "records-tier2-wave2.jsonl",
  "records-tier2.jsonl",
  "records-full.jsonl",
  "records-union-step1.jsonl",
];

/** Folded country spellings a clue may use for a record's country. */
const COUNTRY_VARIANTS = new Map([["turkiye", ["turkey"]]]);

/** Trailing admin words a clue may drop from a region's full name. */
const ADMIN_SUFFIXES = [
  " republic",
  " oblast",
  " krai",
  " province",
  " state",
  " region",
  " territory",
  " district",
  " prefecture",
  " department",
  " county",
  " emirate",
  " governorate",
];

function regionTermSet(rawNames) {
  const terms = new Set();
  for (const raw of rawNames) {
    if (!raw) continue;
    const folded = foldText(raw);
    if (!folded) continue;
    terms.add(folded);
    for (const variant of COUNTRY_VARIANTS.get(folded) ?? []) terms.add(variant);
    let stripped = folded;
    let changed = true;
    while (changed) {
      changed = false;
      for (const suffix of ADMIN_SUFFIXES) {
        if (stripped.endsWith(suffix) && stripped.length > suffix.length + 2) {
          stripped = stripped.slice(0, -suffix.length).trim();
          terms.add(stripped);
          changed = true;
        }
      }
    }
  }
  return [...terms].filter((t) => t.length >= 3);
}

/**
 * Answer identity per published case: name, aliases, subdivision,
 * country. Production records cover the core deck; the names catalog
 * covers the rest (the Capitals pack, whose country is given to the
 * player — for pack cases the country is excluded from the capital
 * rule's regions, because "capital of <given country>" is the pack's
 * premise, not a leak).
 */
export function loadIdentities(root) {
  const identities = new Map();
  const prodDir = join(root, "scripts", "clues", "production");
  for (const file of RECORD_FILES) {
    const path = join(prodDir, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (!line.trim()) continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      if (record?.status !== "accepted" || !record.answer || !record.place_id) continue;
      const geonamesId = record.place_id.replace(/^gn-/, "geonames:");
      identities.set(geonamesId, {
        name: record.answer.name ?? null,
        aliases: Array.isArray(record.answer.aliases) ? record.answer.aliases : [],
        subdivision: record.answer.subdivision ?? null,
        country: record.answer.country ?? null,
        pack: false,
      });
    }
  }

  const namesPath = join(root, "public", "loop", "names.v2.json");
  const names = JSON.parse(readFileSync(namesPath, "utf8"));
  const packMetaPath = join(root, "public", "packs", "capitals", "loop-meta.json");
  const packMeta = existsSync(packMetaPath) ? JSON.parse(readFileSync(packMetaPath, "utf8")) : {};
  const packPlaceIds = new Set();
  // Pack membership by case index is resolved in scanPublishedCases;
  // here the catalog only fills identities the records did not cover.
  for (let i = 0; i < names.id.length; i++) {
    const geonamesId = `geonames:${names.id[i]}`;
    if (identities.has(geonamesId)) continue;
    identities.set(geonamesId, {
      name: names.n[i],
      aliases: [],
      subdivision: null,
      country: names.regions[names.r[i]] ?? null,
      pack: false,
    });
  }
  return { identities, packMeta, packPlaceIds };
}

const PAST_MARKERS =
  /\b(was|were|became|become|served|founded|made|moved|took|held|stayed|began|once|former|past|until|till)\b/;
const METAPHOR_CAPITAL =
  /\b(health|oil|trade|cultural|culture|food|fashion|music|sports?|tech|film|wine|coffee|opal)\s+capital\b/;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Does one clue identify its answer as the capital/chief city of a
 * named region? `identity` is { name, subdivision, country, pack }.
 * Returns { pattern, sentence } or null. Pure; unit-tested with
 * fictional places.
 */
export function capitalGiveaway(clueText, identity) {
  if (!identity) return null;
  const subdivisionTerms = regionTermSet([identity.subdivision]);
  const countryTerms = identity.pack ? [] : regionTermSet([identity.country]);
  const allTerms = [...subdivisionTerms, ...countryTerms];
  if (allTerms.length === 0) return null;
  const answerFolded = identity.name ? foldText(identity.name) : null;

  const sentences = String(clueText).split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const folded = foldText(sentence);
    if (!folded) continue;
    if (PAST_MARKERS.test(folded) || /\bin \d{4}\b/.test(folded) || /\bfrom \d{4}\b/.test(folded)) {
      continue; // capital history, not a present-tense identification
    }
    if (METAPHOR_CAPITAL.test(folded)) continue;
    // "<Other place>, the capital of …" names that place, not the answer.
    const other = /([A-Z][\p{L}'’.-]+(?: [A-Z][\p{L}'’.-]+)*), the (?:capital|chief city)/u.exec(sentence);
    if (other && answerFolded && foldText(other[1]) !== answerFolded) continue;

    for (const term of allTerms) {
      const t = escapeRegExp(term);
      // "the capital / chief city [and largest city] of <region>" — the
      // region must be the direct object: words between the capital
      // phrase and "of" may not be a location phrase ("a capital city in
      // the northwest of Argentina" locates the answer; it does not name
      // what it is the capital of).
      const direct = new RegExp(
        `(?:capital|chief city|capital city)((?: [a-z]+){0,4}) of (?:the )?${t}\\b`,
      ).exec(folded);
      if (
        direct &&
        !/\b(north|south|east|west|northwest|northeast|southwest|southeast|centre|center|middle|heart|coast|interior|edge|part)\b/.test(
          direct[1],
        )
      ) {
        return { pattern: "capital-of-region", sentence };
      }
      // "<region> … as its capital"
      if (new RegExp(`${t}(?: [a-z]+){0,4} as its capital\\b`).test(folded)) {
        return { pattern: "region-as-its-capital", sentence };
      }
    }
    // "This capital city …" with the subdivision named in the sentence.
    if (
      (folded.startsWith("this capital city") || folded.startsWith("this chief city")) &&
      subdivisionTerms.some((term) => folded.includes(term))
    ) {
      return { pattern: "this-capital-city-in-subdivision", sentence };
    }
  }
  return null;
}

/**
 * Scan every published case. Returns violations:
 * [{ case, slot, rule, answer, detail }] with slot 1-based.
 */
export function scanPublishedCases(root) {
  const { identities, packMeta } = loadIdentities(root);
  const packIndexes = new Set(Object.keys(packMeta).map(Number));
  const cluesDir = join(root, "public", "loop", "clues");
  const files = readdirSync(cluesDir)
    .filter((f) => /^\d+\.json$/.test(f))
    .sort((a, b) => parseInt(a) - parseInt(b));
  const violations = [];
  for (const file of files) {
    const caseIndex = parseInt(file);
    const clueFile = JSON.parse(readFileSync(join(cluesDir, file), "utf8"));
    const identity = identities.get(clueFile.placeId);
    if (!identity) {
      violations.push({
        case: caseIndex,
        slot: 0,
        rule: "NO_IDENTITY",
        answer: clueFile.placeId,
        detail: "case placeId has no identity in records or the names catalog",
      });
      continue;
    }
    const effective = packIndexes.has(caseIndex) ? { ...identity, pack: true } : identity;
    const terms = buildLeakTerms({ name: identity.name, aliases: identity.aliases });
    clueFile.clues.forEach((clue, i) => {
      for (const hit of findLeaks(clue, terms)) {
        violations.push({
          case: caseIndex,
          slot: i + 1,
          rule: "NAME_LEAK",
          answer: identity.name,
          detail: `clue contains banned term "${hit.term}" (${hit.source})`,
        });
      }
      if (i < 4) {
        const giveaway = capitalGiveaway(clue, effective);
        if (giveaway) {
          violations.push({
            case: caseIndex,
            slot: i + 1,
            rule: "CAPITAL_GIVEAWAY",
            answer: identity.name,
            detail: `${giveaway.pattern}: "${giveaway.sentence}"`,
          });
        }
      }
    });
  }
  return { violations, caseCount: files.length };
}

export const baselineKey = (v) => `${v.case}:${v.slot}:${v.rule}`;

/** Compare a scan with the baseline. Returns { known, fresh, stale }. */
export function compareBaseline(violations, baselineEntries) {
  const baseline = new Map(baselineEntries.map((e) => [baselineKey(e), e]));
  const seen = new Set();
  const known = [];
  const fresh = [];
  for (const v of violations) {
    const key = baselineKey(v);
    if (baseline.has(key)) {
      known.push(v);
      seen.add(key);
    } else {
      fresh.push(v);
    }
  }
  const stale = baselineEntries.filter((e) => !seen.has(baselineKey(e)));
  return { known, fresh, stale };
}

export function runAudit({ root, baselinePath = DEFAULT_BASELINE, log = console.log } = {}) {
  const repoRoot = root ?? join(HERE, "..", "..");
  const { violations, caseCount } = scanPublishedCases(repoRoot);
  const baselineEntries = existsSync(baselinePath)
    ? (JSON.parse(readFileSync(baselinePath, "utf8")).entries ?? [])
    : [];
  const { known, fresh, stale } = compareBaseline(violations, baselineEntries);
  for (const v of known) {
    log(`KNOWN case ${v.case} slot ${v.slot} ${v.rule} (${v.answer}) — ${v.detail}`);
  }
  for (const v of fresh) {
    log(`FAIL case ${v.case} slot ${v.slot} ${v.rule} (${v.answer}) — ${v.detail}`);
  }
  for (const e of stale) {
    log(
      `STALE BASELINE case ${e.case} slot ${e.slot} ${e.rule} -> fixed; remove it from scripts/clues/clue-giveaway-baseline.json`,
    );
  }
  log(
    `clue-giveaway: ${caseCount} cases scanned, ${known.length} known, ${fresh.length} new, ${stale.length} stale`,
  );
  return fresh.length === 0 && stale.length === 0;
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const i = process.argv.indexOf("--baseline");
  const ok = runAudit(i !== -1 ? { baselinePath: process.argv[i + 1] } : {});
  process.exit(ok ? 0 : 1);
}
