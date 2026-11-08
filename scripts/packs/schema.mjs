/**
 * Story pack authoring schema (meridian.pack.case.v1) — design:
 * docs/story-packs.md §1.1.
 *
 * A pack record is a superset of the clue-authoring record
 * (meridian.loop.clues.v1, scripts/clues/schema.mjs): the same 5-clue
 * ladder with a verbatim source quote per clue, plus the pack fields the
 * published clue file cannot carry — which country or state the capital
 * belongs to (the subject), the direction the case is played in, the pack
 * tier, and the reveal blurb. The composer (compose-packs.mjs) validates
 * a record, then writes it as an ordinary clue file plus one sidecar
 * entry; the extra fields never reach the clue file.
 *
 * Validation reuses the clue pipeline instead of copying it: the record
 * is projected onto a loop record (toLoopRecord) and run through
 * validateRecord with the authoring input (place, curated aliases,
 * extracts), so every mechanical rule of the shipped pipeline — word
 * counts, reading level, quote tracing, the name-leak ban on the target —
 * applies to pack cases unchanged. This module adds only the pack rules:
 * shape, the feature-code gate (design §5: PPLC for a country capital,
 * PPLA for a state capital, matched to the subject kind), the direction
 * invariants for what the briefing may state, and the subject leak ban.
 *
 * Two fields the loop authoring schema carries stay off the pack record,
 * per design §1.1: the record has no status (every record under cases/
 * is the pack's content; the projection below supplies the loop
 * schema's "accepted"), and it has no difficulty of its own (the design
 * keeps the dataset difficulty untouched, so the projection takes the
 * place's dataset difficulty from the authoring input's chunk mirror,
 * the same value the pack validator pins against the shipped chunk).
 *
 * The subject leak ban is direction-aware (design §2.1):
 * - Direction A (find the capital of a named subject): clues may use the
 *   subject freely; only the target's name is banned, by validateRecord.
 * - Direction B1 (the briefing names the capital; a locate drill): the
 *   subject is the pairing the reveal teaches, so its name and aliases
 *   are banned from every clue.
 * - Direction B2 (neither name given): the subject is a second secret.
 *   Its name and aliases are banned from every clue except rung 4 (clue
 *   index 3, the hook rung), where the country is confirmed by design
 *   (design §2.1). The target stays banned from all five clues, and the
 *   giveaway (index 4) bans the subject again.
 */

import { SCHEMA_ID as LOOP_SCHEMA_ID } from "../clues/schema.mjs";
import { buildLeakTerms, findLeaks, validateRecord } from "../clues/validate-clues.mjs";

export const PACK_SCHEMA_ID = "meridian.pack.case.v1";

export const PACK_DIRECTIONS = ["A", "B1", "B2"];

/** Clue index where Direction B2 confirms the subject (ladder rung 4). */
export const B2_CONFIRM_CLUE_INDEX = 3;

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Project a pack record onto the loop record the shipped pipeline
 * validates and assembles. Country and subdivision come from the
 * authoring input's place (the dataset row the case was authored
 * against), so validateRecord's input cross-check pins the record to
 * that row: a record about a different place than its input fails.
 */
export function toLoopRecord(record, input) {
  return {
    schema: LOOP_SCHEMA_ID,
    status: "accepted",
    place_id: record.target.placeId,
    answer: {
      name: record.target.name,
      aliases: record.target.aliases ?? [],
      country: input.place.country,
      subdivision: input.place.subdivision,
      lat: record.target.lat,
      lon: record.target.lon,
      difficulty: input.chunk?.difficulty ?? record.difficulty,
    },
    clues: record.clues,
  };
}

/**
 * USPS postal codes by state name — the build-time half of the flagKey
 * derivation (Capitals & Flags design §2, Flagstaff gate): a state
 * subject's flagKey is its ISO 3166-2 code, which needs the postal code
 * the case records do not carry (they store the state NAME). Inverting
 * this table for an unmapped subdivision throws at build time, so a
 * record naming a non-state fails closed instead of shipping a wrong
 * or missing flag.
 */
export const US_STATE_POSTAL = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR",
  California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID",
  Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS",
  Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
  "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA",
  "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
  Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY",
};

/**
 * The flag identity of a case's subject land, derived at build time —
 * never authored on the record (design §2). A country subject's key is
 * its lowercase ISO 3166-1 alpha-2 (which is exactly its flag's ISO
 * 3166-1 alpha-2, cross-checked against Wikidata P297→P41 by the
 * Flagstaff gate); a state subject's key is "us-" + its postal code.
 * Returns null only for a subject shape the validator already rejects.
 */
export function flagKeyForSubject(subject) {
  if (!subject || typeof subject !== "object") return null;
  if (subject.kind === "country") {
    return typeof subject.iso2 === "string" && /^[A-Z]{2}$/.test(subject.iso2)
      ? subject.iso2.toLowerCase()
      : null;
  }
  if (subject.kind === "state") {
    const postal = US_STATE_POSTAL[subject.subdivision];
    if (!postal) {
      throw new Error(
        `flagKeyForSubject: no USPS postal code for subdivision ${JSON.stringify(subject.subdivision)} — refusing to derive a flag identity`,
      );
    }
    return `us-${postal.toLowerCase()}`;
  }
  return null;
}

/**
 * The sidecar entry for one pack case (design §1.2). Capitals & Flags:
 * when the caller passes the licence-verified flag registry's key set
 * and the subject's derived flagKey is in it, the entry carries the
 * flagKey — the one field screens learn (design §2). A land with no
 * verified flag simply has no flagKey: flagless is a data state.
 */
export function loopMetaEntry(record, verifiedFlagKeys) {
  const entry = {
    subject: { kind: record.subject.kind, name: record.subject.name },
    direction: record.direction,
    prompt: { givenName: record.prompt.givenName, givenKind: record.prompt.givenKind },
    blurb: record.reveal.blurb,
  };
  if (verifiedFlagKeys) {
    const flagKey = flagKeyForSubject(record.subject);
    if (flagKey && verifiedFlagKeys.has(flagKey)) entry.flagKey = flagKey;
  }
  return entry;
}

/**
 * Leak terms for the subject (the second answer concept, design §1.1):
 * the subject's name decomposed like a place name, plus its aliases
 * whole. Same construction the clue validator uses for a target.
 */
export function subjectLeakTerms(record) {
  return buildLeakTerms({
    name: record.subjectAnswer.name,
    aliases: record.subjectAnswer.aliases ?? [],
  });
}

/**
 * Validate one pack record against its authoring input.
 *
 * @param {*} record  Parsed meridian.pack.case.v1 record (any value;
 *   malformed input yields reasons, never a throw).
 * @param {{input?: {place: object, curated_aliases?: string[],
 *   extracts?: Array}}} [ctx]  The §9-style authoring input. Without it
 *   the record cannot be quote-traced and validation fails closed.
 * @returns {{ok: boolean, reasons: Array<{code: string, tier?: number,
 *   detail: string}>}}
 */
export function validatePackRecord(record, ctx = {}) {
  const reasons = [];
  const push = (code, detail, tier) => {
    const reason = { code };
    if (tier !== undefined) reason.tier = tier;
    reason.detail = detail;
    reasons.push(reason);
  };
  const input = ctx && typeof ctx === "object" ? ctx.input : undefined;

  if (!record || typeof record !== "object" || Array.isArray(record)) {
    push("PACK_SCHEMA", "record must be an object");
    return { ok: false, reasons };
  }
  if (record.schema !== PACK_SCHEMA_ID) {
    push("PACK_SCHEMA", `schema must be "${PACK_SCHEMA_ID}", got ${JSON.stringify(record.schema)}`);
  }
  if (!isNonEmptyString(record.packId)) push("PACK_FIELD", "packId must be a non-empty string");
  if (!isNonEmptyString(record.category)) push("PACK_FIELD", "category must be a non-empty string");
  if (!isNonEmptyString(record.caseId) || !/^[a-z0-9][a-z0-9-]*$/.test(record.caseId)) {
    push("PACK_FIELD", `caseId must be a slug, got ${JSON.stringify(record.caseId)}`);
  }

  // -- target: the capital's GeoNames row, copied, never hand-typed ------
  const target = record.target;
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    push("PACK_TARGET", "target must be an object");
    return { ok: false, reasons };
  }
  if (typeof target.placeId !== "string" || !/^gn-\d+$/.test(target.placeId)) {
    push("PACK_TARGET", `target.placeId must look like "gn-<id>", got ${JSON.stringify(target.placeId)}`);
  }
  if (!isNonEmptyString(target.name)) push("PACK_TARGET", "target.name must be a non-empty string");
  if (typeof target.lat !== "number" || !Number.isFinite(target.lat) || target.lat < -90 || target.lat > 90) {
    push("PACK_TARGET", `target.lat must be a finite number in [-90, 90], got ${JSON.stringify(target.lat)}`);
  }
  if (typeof target.lon !== "number" || !Number.isFinite(target.lon) || target.lon < -180 || target.lon > 180) {
    push("PACK_TARGET", `target.lon must be a finite number in [-180, 180], got ${JSON.stringify(target.lon)}`);
  }
  if (target.featureCode !== "PPLC" && target.featureCode !== "PPLA") {
    push("PACK_TARGET", `target.featureCode must be "PPLC" or "PPLA", got ${JSON.stringify(target.featureCode)}`);
  }
  if (target.aliases !== undefined && !isStringArray(target.aliases)) {
    push("PACK_TARGET", "target.aliases must be an array of strings when present");
  }

  // -- subject: what the capital belongs to -------------------------------
  const subject = record.subject;
  if (!subject || typeof subject !== "object" || Array.isArray(subject)) {
    push("PACK_SUBJECT", "subject must be an object");
    return { ok: false, reasons };
  }
  if (subject.kind !== "country" && subject.kind !== "state") {
    push("PACK_SUBJECT", `subject.kind must be "country" or "state", got ${JSON.stringify(subject.kind)}`);
  }
  if (!isNonEmptyString(subject.name)) push("PACK_SUBJECT", "subject.name must be a non-empty string");
  if (typeof subject.iso2 !== "string" || !/^[A-Z]{2}$/.test(subject.iso2)) {
    push("PACK_SUBJECT", `subject.iso2 must be a 2-letter code, got ${JSON.stringify(subject.iso2)}`);
  }
  if (subject.subdivision !== undefined && subject.subdivision !== null && typeof subject.subdivision !== "string") {
    push("PACK_SUBJECT", "subject.subdivision must be a string or null when present");
  }
  // The Hyderabad gate's feature-code half (design §5 step 2): a country
  // capital is a PPLC row, a state capital a PPLA row. A mismatch means
  // the record points at the wrong row of the dataset.
  if (subject.kind === "country" && target.featureCode !== "PPLC") {
    push("PACK_GATE", `a country capital must be a PPLC row, got ${JSON.stringify(target.featureCode)}`);
  }
  if (subject.kind === "state" && target.featureCode !== "PPLA") {
    push("PACK_GATE", `a state capital must be a PPLA row, got ${JSON.stringify(target.featureCode)}`);
  }

  // -- the second answer concept -------------------------------------------
  const subjectAnswer = record.subjectAnswer;
  if (!subjectAnswer || typeof subjectAnswer !== "object" || Array.isArray(subjectAnswer)) {
    push("PACK_SUBJECT", "subjectAnswer must be an object {name, aliases}");
    return { ok: false, reasons };
  }
  if (!isNonEmptyString(subjectAnswer.name)) {
    push("PACK_SUBJECT", "subjectAnswer.name must be a non-empty string");
  }
  if (subjectAnswer.aliases !== undefined && !isStringArray(subjectAnswer.aliases)) {
    push("PACK_SUBJECT", "subjectAnswer.aliases must be an array of strings when present");
  }
  if (isNonEmptyString(subject.name) && subjectAnswer.name !== subject.name) {
    push(
      "PACK_SUBJECT",
      `subjectAnswer.name ${JSON.stringify(subjectAnswer.name)} != subject.name ${JSON.stringify(subject.name)}`,
    );
  }

  // -- direction + prompt: what the briefing may state ----------------------
  if (!PACK_DIRECTIONS.includes(record.direction)) {
    push("PACK_DIRECTION", `direction must be one of ${PACK_DIRECTIONS.join("/")}, got ${JSON.stringify(record.direction)}`);
  }
  const prompt = record.prompt;
  if (!prompt || typeof prompt !== "object" || Array.isArray(prompt)) {
    push("PACK_DIRECTION", "prompt must be an object {givenName, givenKind}");
    return { ok: false, reasons };
  }
  if (typeof prompt.givenName !== "string") push("PACK_DIRECTION", "prompt.givenName must be a string");
  if (prompt.givenKind !== "country" && prompt.givenKind !== "state" && prompt.givenKind !== "capital") {
    push("PACK_DIRECTION", `prompt.givenKind must be "country", "state", or "capital", got ${JSON.stringify(prompt.givenKind)}`);
  }
  if (record.direction === "A") {
    if (prompt.givenName !== subject.name || prompt.givenKind !== subject.kind) {
      push("PACK_DIRECTION", "Direction A: the briefing names the subject, so prompt must give the subject's name and kind");
    }
  } else if (record.direction === "B1") {
    if (prompt.givenName !== target.name || prompt.givenKind !== "capital") {
      push("PACK_DIRECTION", "Direction B1: the briefing names the capital, so prompt must give the target's name as a capital");
    }
  } else if (record.direction === "B2") {
    if (prompt.givenName !== "") {
      push("PACK_DIRECTION", "Direction B2: the briefing names nothing, so prompt.givenName must be empty");
    }
  }

  // -- pack tier, difficulty, point policy, reveal, source ------------------
  if (!Number.isInteger(record.packTier) || record.packTier < 1 || record.packTier > 3) {
    push("PACK_TIER", `packTier must be an integer 1-3, got ${JSON.stringify(record.packTier)}`);
  }
  const effectiveDifficulty = input?.chunk?.difficulty ?? record.difficulty;
  if (!Number.isInteger(effectiveDifficulty) || effectiveDifficulty < 1 || effectiveDifficulty > 5) {
    push(
      "PACK_FIELD",
      `the dataset difficulty (authoring input's chunk mirror) must be an integer 1-5, got ${JSON.stringify(effectiveDifficulty)}`,
    );
  }
  if (record.pointPolicy !== "geonames-point") {
    push("PACK_FIELD", `pointPolicy must be "geonames-point" for capitals, got ${JSON.stringify(record.pointPolicy)}`);
  }
  const reveal = record.reveal;
  if (!reveal || typeof reveal !== "object" || !isNonEmptyString(reveal.blurb)) {
    push("PACK_FIELD", "reveal.blurb must be a non-empty string");
  }
  const source = record.source;
  if (
    !source ||
    typeof source !== "object" ||
    !isNonEmptyString(source.label) ||
    typeof source.href !== "string" ||
    !/^https:\/\//.test(source.href)
  ) {
    push("PACK_FIELD", "source must be {label, href} with an https href");
  }
  if (!Array.isArray(record.clues) || record.clues.length !== 5) {
    push("PACK_FIELD", "clues must be an array of exactly 5 entries");
    return { ok: reasons.length === 0, reasons };
  }

  // -- the input must describe the same place the record claims ------------
  if (!input || typeof input !== "object" || !input.place) {
    push("PACK_INPUT", "an authoring input {place, extracts} is required; without it no quote can be traced");
    return { ok: false, reasons };
  }
  if (input.place.place_id !== target.placeId) {
    push("PACK_INPUT", `input place_id ${JSON.stringify(input.place.place_id)} != target.placeId ${JSON.stringify(target.placeId)}`);
  }
  if (input.place.name !== target.name) {
    push("PACK_INPUT", `input place name ${JSON.stringify(input.place.name)} != target.name ${JSON.stringify(target.name)}`);
  }
  if (
    typeof input.place.lat === "number" &&
    typeof target.lat === "number" &&
    Math.abs(input.place.lat - target.lat) > 1e-6
  ) {
    push("PACK_INPUT", `input lat ${input.place.lat} != target lat ${target.lat}`);
  }
  if (
    typeof input.place.lon === "number" &&
    typeof target.lon === "number" &&
    Math.abs(input.place.lon - target.lon) > 1e-6
  ) {
    push("PACK_INPUT", `input lon ${input.place.lon} != target lon ${target.lon}`);
  }

  // -- delegate the ladder mechanics to the shipped clue validator ----------
  const loopResult = validateRecord(toLoopRecord(record, input), { input });
  for (const reason of loopResult.reasons) reasons.push(reason);

  // -- subject leak ban (directions B1 and B2) -------------------------------
  if (record.direction === "B1" || record.direction === "B2") {
    const terms = subjectLeakTerms(record);
    record.clues.forEach((clue, idx) => {
      if (record.direction === "B2" && idx === B2_CONFIRM_CLUE_INDEX) return;
      if (!clue || typeof clue.text !== "string") return;
      for (const hit of findLeaks(clue.text, terms)) {
        push(
          "SUBJECT_LEAK",
          `clues[${idx}] leaks the subject via ${JSON.stringify(hit.term)} (${hit.source})`,
          idx + 1,
        );
      }
    });
  }

  return { ok: reasons.length === 0, reasons };
}
