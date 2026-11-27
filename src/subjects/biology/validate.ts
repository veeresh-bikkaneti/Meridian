/**
 * Biology records validator — build-time check, matching the shared
 * validate.ts contract used by math, physics, chemistry, GK, and
 * social-studies.
 *
 * Imports the records + schema from ./items.ts (down, Content) only.
 * Checks per record: (a) schema parse, (b) answer present,
 * (c) giveaway — the lead (why) must not contain the answer, including
 * any follow-up answer, (d) every media id exists, (e) no stored
 * current year in child-read text, (f) no two records share an id.
 *
 * The giveaway and year checks mirror scripts/lint-subject-leads.mjs
 * (findGiveaway / findLiteralYear) exactly — same tokens, same stop list,
 * same date-stamp and pinned-year exclusions — so the validator and
 * lint:subjects cannot disagree about a lead.
 *
 * No known giveaway cases: every live biology lead is clean, so
 * KNOWN_GIVEAWAY_CASES is empty and any leak throws.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BIOLOGY_RECORDS, SubjectItemSchema } from "./items.ts";
import type { SubjectItem } from "./items.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");

// --- Mirrors of scripts/lint-subject-leads.mjs (kept identical on purpose) ---

/** Pinned play-time year in the lint script; a literal of it is not stored. */
const PIN_YEAR = 2091;

/** First literal 2020s-or-later year in a text that is not a date stamp
 *  and not the pinned play-time year, or null. */
function findLiteralYear(text: string): string | null {
  const undated = String(text ?? "").replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ");
  for (const m of undated.matchAll(/(?<![\d.,])20[2-9]\d(?![\d,])/g)) {
    if (Number(m[0]) !== PIN_YEAR) return m[0];
  }
  return null;
}

const STOP = new Set([
  "the", "a", "an", "of", "and", "or", "in", "on", "at", "to", "it", "is",
  "they", "them", "this", "that", "with", "for", "from", "by", "one", "same",
  "does", "not", "now",
]);

const tokens = (text: string): string[] =>
  String(text ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/(\d),(\d)/g, "$1$2")
    .match(/[a-z]+|\d+(?:\.\d+)?/g) ?? [];

/** The answer word or number a lead leaks, or null. A token counts when it
 *  is in the correct choice but in no other choice and not in the question
 *  (so shared words or a number the question already gives do not count),
 *  and is a number or a word of 4+ letters. */
function findGiveaway(lead: string, answer: SubjectItem["answer"]): string | null {
  if (!answer || typeof answer.correct !== "string") return null;
  const others = new Set(
    (answer.choices ?? []).filter((c) => c !== answer.correct).flatMap(tokens),
  );
  const asked = new Set(tokens(answer.prompt));
  const leadTokens = new Set(tokens(lead));
  const mine = new Set(tokens(answer.correct));
  // A lead that also names a wrong choice's own word is posing the options,
  // not answering them.
  const posesOptions = (answer.choices ?? [])
    .filter((c) => c !== answer.correct)
    .flatMap(tokens)
    .some((t) => !STOP.has(t) && !mine.has(t) && !asked.has(t) && t.length >= 4 && leadTokens.has(t));
  if (posesOptions) return null;
  for (const t of tokens(answer.correct)) {
    if (STOP.has(t) || others.has(t) || asked.has(t)) continue;
    if (!/^\d/.test(t) && t.length < 4) continue;
    if (leadTokens.has(t)) return t;
  }
  return null;
}

// --- Media registries (loaded lazily, only when a record carries media) ---

let clipIds: Set<string> | null = null;
let stillIds: Set<string> | null = null;

function loadClipIds(): Set<string> {
  if (!clipIds) {
    const manifest = JSON.parse(
      readFileSync(join(REPO, "public", "videos", "journal-manifest.json"), "utf8"),
    ) as { movies?: Record<string, unknown> };
    clipIds = new Set(Object.keys(manifest.movies ?? {}));
  }
  return clipIds;
}

function loadStillIds(): Set<string> {
  if (!stillIds) {
    stillIds = new Set(
      readdirSync(join(REPO, "public", "images", "journal"))
        .filter((name) => name.endsWith(".webp"))
        .map((name) => name.slice(0, -".webp".length)),
    );
  }
  return stillIds;
}

/** Child-read strings of a record: the why lead plus the answer strings. */
function childStrings(record: SubjectItem): string[] {
  const out: string[] = [record.why];
  const walk = (answer: SubjectItem["answer"]): void => {
    out.push(answer.prompt, answer.correct, answer.derivation, ...answer.choices);
    if (answer.followUp) walk(answer.followUp);
  };
  walk(record.answer);
  return out;
}

/** The answer word or number a lead leaks from an answer or any of its
 *  follow-ups, or null. The lead is shown before the whole case, so a
 *  follow-up's answer counts the same as the main one. */
function findGiveawayIn(lead: string, answer: SubjectItem["answer"]): string | null {
  return findGiveaway(lead, answer) ?? (answer.followUp ? findGiveawayIn(lead, answer.followUp) : null);
}

const KNOWN_GIVEAWAY_CASES: readonly { id: string; token: string }[] = [];

/**
 * Validate biology records, throwing an Error naming the record id and
 * the rule on the first failure.
 */
export function validateBiologyRecords(records: readonly unknown[]): void {
  const seenIds = new Set<string>();
  for (const record of records) {
    const id =
      record !== null && typeof record === "object" && "id" in record &&
      typeof (record as { id: unknown }).id === "string"
        ? (record as { id: string }).id
        : "(missing id)";
    if (id !== "(missing id)") {
      if (seenIds.has(id)) {
        throw new Error(`${id}: duplicate id`);
      }
      seenIds.add(id);
    }
    if (
      record === null ||
      typeof record !== "object" ||
      Array.isArray(record) ||
      !("answer" in record) ||
      (record as { answer: unknown }).answer === null ||
      (record as { answer: unknown }).answer === undefined
    ) {
      throw new Error(`${id}: missing answer`);
    }
    let parsed: SubjectItem;
    try {
      parsed = SubjectItemSchema.parse(record);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`${id}: invalid record — ${detail}`);
    }
    const leaked = findGiveawayIn(parsed.why, parsed.answer);
    if (leaked) {
      const known = KNOWN_GIVEAWAY_CASES.find((c) => c.id === parsed.id && c.token === leaked);
      if (!known) {
        throw new Error(
          `${id}: lead contains the answer (token "${leaked}"): the lead is shown before the question`,
        );
      }
    }
    for (const medium of parsed.media) {
      const known =
        medium.kind === "clip" ? loadClipIds().has(medium.id) : loadStillIds().has(medium.id);
      if (!known) {
        throw new Error(`${id}: unknown ${medium.kind} media id "${medium.id}"`);
      }
    }
    for (const text of childStrings(parsed)) {
      const year = findLiteralYear(text);
      if (year) {
        throw new Error(`${id}: stored year ${year}: never store the current year`);
      }
    }
  }
}

const isMain =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    validateBiologyRecords(BIOLOGY_RECORDS);
    console.log(`biology records: ${BIOLOGY_RECORDS.length} valid`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
