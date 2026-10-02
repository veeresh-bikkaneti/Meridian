/**
 * On-device AI story fallback (Chrome Gemini Nano).
 *
 * Architecture decision (Veeresh, 2026-10-02): Wikidata + Wikipedia are the
 * PRIMARY fact source (deterministic, build-time); the on-device model is
 * the RUNTIME fallback for places where the build-time ladder found
 * nothing. The build-time ladder owns `src/game/generated-places.ts` and its
 * `fact` field — this module never touches that file.
 *
 * Flow per place:
 *   1. The card renders the generic blurb IMMEDIATELY. Nothing here ever
 *      blocks or delays it.
 *   2. Only when the place is a generated (GeoNames) place with no build-time
 *      enrichment — no `fact` (ladder) and no `history` (PR #30 hook) — AND
 *      the browser exposes an already-downloaded on-device model
 *      (browserAiAvailable(), same guard as sports-ai.ts) do we ask Nano
 *      for one story sentence. Curated starters carry hand-authored stories;
 *      Nano never fires for them.
 *   3. The prompt enforces Veeresh's four card principles: (1) history
 *      first, modern identity second; (2) plain-spoken geography, no
 *      coords/elevation; (3) one memorable person/event/quote/movie/record —
 *      if a kid can't retell it, the card failed; (4) short, story-like,
 *      numbers only when they teach.
 *   4. Nano's reply is validated before it ever reaches the DOM, using the
 *      pure checks ported from the build-time validator
 *      (origin/feat/facts-validator, scripts/facts-validate.mjs): length,
 *      banned patterns (coords/elevation/population/measurements), content-
 *      word grounding against the source extract, smuggled scope words,
 *      hedging preservation, and date-predicate binding. ANY failure → null,
 *      and the generic blurb stands. The named-after inversion check is
 *      ported too, but the runtime has no `person` token set, so it is
 *      exported for pipeline/tests rather than run here.
 *   5. Valid stories are cached per device (localStorage, 180-day TTL).
 *      Empty outcomes are cached too, so we never re-prompt a place.
 *
 * E2E: Playwright runs the E2E suite in Chromium 152
 * (/opt/meta-chromium/chrome), which exposes no Prompt API namespace, so
 * browserAiAvailable() is false there and this hook never fires — the same
 * guard sports-ai.ts relies on. Verified 2026-10-02 by evaluating
 * `typeof window.LanguageModel` in the exact E2E browser binary.
 *
 * We never trigger a silent multi-gigabyte model download: only
 * availability() === "available" is used.
 */
import { useEffect, useState } from "react";
import {
  browserAiAvailable,
  cityLabelForPlace,
  geonameIdOf,
  type PromptSession,
} from "./sports-ai.ts";

/** Re-exported so tests/consumers get the session type from this module. */
export type { PromptSession };

// ---------------------------------------------------------------------------
// Validator port — pure functions from the build-time no-fabrication gate
// (scripts/facts-validate.mjs on origin/feat/facts-validator, which reuses
// contentWords / BANNED_PATTERNS from scripts/enrich-wikipedia.mjs).
// Browser-safe: strings and regexes only, no node APIs, no script imports.
// ---------------------------------------------------------------------------

/** Content words: lowercase alphanumerics longer than 3 chars. */
export function contentWords(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return words.filter((w) => w.length > 3);
}

export const BANNED_PATTERNS: RegExp[] = [
  /°/, // coordinates never belong in a kid's card
  /\b\d[\d,]*\s*(m|ft|feet|metres|meters)\b.*\b(above|elevation|a\.s\.l\.)/i,
  /\belevation\b/i,
  /\bpopulation\b/i, // "population of" and bare "population 5,000" alike
  /\b\d[\d,]*\s*(people|residents|inhabitants|households)\b/i, // bare stats teach nothing
  /\bcensus\b/i,
];

/** General measurements ("10 km", "3 miles", "5 ft") — BANNED_PATTERNS only
 *  covers m/ft in an elevation context. */
export const MEASUREMENT_RE =
  /\b\d[\d,]*\s*-?\s*(kilometers?|kilometres?|km|miles?|mi|feet|ft|meters?|metres?|m)\b/i;

/** Lowercase alphanumeric tokens, punctuation stripped. */
export function wordTokens(text: string): string[] {
  return String(text ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function tokenCounts(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  return counts;
}

export const REWRITE_MIN_LEN = 20;
export const REWRITE_MAX_LEN = 240;

/** (f) length + terminal punctuation. */
export function checkLength(sentence: string): string[] {
  const violations: string[] = [];
  if (typeof sentence !== "string") return ["invalid-rewrite"];
  if (sentence.length < REWRITE_MIN_LEN) violations.push("too-short");
  if (sentence.length > REWRITE_MAX_LEN) violations.push("too-long");
  if (!/[.!?]$/.test(sentence.trim())) violations.push("no-terminal-punctuation");
  return violations;
}

/** (e) banned patterns — coords, elevation, population/census, measurements. */
export function checkBanned(sentence: string): string[] {
  for (const re of [...BANNED_PATTERNS, MEASUREMENT_RE]) {
    // Same violation shape as the build-time gate so tooling can treat
    // both uniformly.
    if (re.test(sentence)) return [`banned-pattern ${re.source.slice(0, 40)}`];
  }
  return [];
}

/** (a) content-word presence — the story may only reuse source words. */
export function checkContentWords(rewritten: string, source: string): string[] {
  const sourceWords = new Set(contentWords(source ?? ""));
  const missing = contentWords(rewritten).filter((w) => !sourceWords.has(w));
  return missing.length > 0 ? [`fabricated words: ${missing.slice(0, 6).join(", ")}`] : [];
}

/**
 * (+) smuggled scope words — short function words that flip meaning.
 * "not" is only 3 chars, so the content-word filter (length > 3) never sees
 * it: "was named after Lewis" -> "was not named after Lewis" must fail.
 * Flag a flip-word whose count GREW vs the source (dropping one is harmless).
 */
export const SCOPE_FLIP_WORDS = new Set([
  "not", "no", "never", "none", "nobody", "nothing", "neither", "nor",
  "without", "hardly", "barely", "scarcely", "only", "merely", "until",
  "unless", "except",
]);

export function checkScopeWords(rewritten: string, source: string): string[] {
  const violations: string[] = [];
  const rwCounts = tokenCounts(wordTokens(rewritten));
  const srcCounts = tokenCounts(wordTokens(source));
  for (const w of SCOPE_FLIP_WORDS) {
    if ((rwCounts.get(w) ?? 0) > (srcCounts.get(w) ?? 0)) {
      violations.push(`smuggled-scope-word: ${w}`);
    }
  }
  return violations;
}

/**
 * (b) named_after relational check.
 * The person must appear as the OBJECT of a naming predicate, never as its
 * subject/agent. Rejects inversions like:
 *   source "The town was named after explorer Lewis"
 *   -> "Explorer Lewis named the town after himself"
 * Heuristic per naming verb: if the token right before it is a passive
 * auxiliary ("was named", "it was named for"), the person cannot be the
 * subject — appositives like "Lewis, the explorer it was named for" pass.
 * Otherwise, a person token within 4 tokens before the verb (stopping at
 * clause boundaries) is read as the subject -> violation.
 */
export const NAMING_VERBS = new Set([
  "name", "names", "named", "naming",
  "call", "calls", "called", "calling",
  "christen", "christens", "christened", "christening",
  "dub", "dubs", "dubbed", "dubbing",
  "rename", "renames", "renamed", "renaming",
  "title", "titles", "titled", "titling",
]);

const PASSIVE_AUX = new Set(["was", "were", "is", "are", "am", "be", "been", "being"]);

// Words that end the subject-search clause when walking back from the verb.
const CLAUSE_STOPS = new Set([
  "who", "whom", "whose", "which", "that", "and", "but", "or",
  "because", "when", "while", "where", "although", "though", "if", "as",
]);

const SUBJECT_WINDOW = 4;

export function checkNamedAfterInversion(rewritten: string, person: string): string[] {
  const personTokens = new Set(wordTokens(person));
  if (personTokens.size === 0) return [];
  const tokens = wordTokens(rewritten);
  for (let v = 0; v < tokens.length; v++) {
    if (!NAMING_VERBS.has(tokens[v])) continue;
    // Passive ("was named", "it was named for") — the person cannot be the
    // subject of this verb; appositive/relative constructions pass here.
    if (v > 0 && PASSIVE_AUX.has(tokens[v - 1])) continue;
    // Active voice: a person token just before the verb is its subject.
    for (let i = v - 1; i >= Math.max(0, v - SUBJECT_WINDOW); i--) {
      if (CLAUSE_STOPS.has(tokens[i])) break;
      if (personTokens.has(tokens[i])) return ["named-after-inversion"];
    }
  }
  return [];
}

/**
 * (c) hedging preservation — dropping a hedge is fabrication by deletion.
 * If the source hedges ("probably founded in 1640"), the story must hedge
 * too (any hedge from the set counts).
 */
const HEDGES = [
  "probably", "likely", "possibly", "maybe", "reportedly",
  "believed to be", "thought to", "may have been", "might have been",
  "tradition holds", "legend holds", "according to legend",
];
const HEDGE_RES = HEDGES.map(
  (h) => new RegExp(`\\b${h.replace(/ /g, "\\s+")}\\b`, "i"),
);

const hasHedge = (text: string): boolean => HEDGE_RES.some((re) => re.test(text ?? ""));

export function checkHedging(source: string, rewritten: string): string[] {
  if (hasHedge(source) && !hasHedge(rewritten)) return ["dropped-hedge"];
  return [];
}

/**
 * (d) date-predicate binding — the year stays attached to its predicate class.
 * "first mentioned in 1234" must never become "founded in 1234".
 * Class A (foundation) verbs are mutually substitutable ONLY when the source
 * used one of them; class B (attestation) must never upgrade to class A.
 * The predicate is the nearest class verb to the year token in each sentence.
 */
const FOUNDATION_PREFIXES = [
  "founded", "founding", // bare "found" excluded: "gold was found" is discovery
  "establish", "incorporat", "settl",
  "built", "build", "open",
  "began", "begun", "start", "launch",
];
const ATTESTATION_PREFIXES = [
  "mention", "attest", "record", "document", "dat", "known",
];

function predicateClass(token: string): "foundation" | "attestation" | null {
  if (token !== "found" && FOUNDATION_PREFIXES.some((p) => token.startsWith(p))) {
    return "foundation";
  }
  if (ATTESTATION_PREFIXES.some((p) => token.startsWith(p))) return "attestation";
  return null;
}

/** Nearest predicate class to the year token: up to 6 tokens before, then
 *  up to 4 after. Null when the year carries no class predicate. */
function classNearYear(tokens: string[], yearIdx: number): "foundation" | "attestation" | null {
  for (let d = 1; d <= 6; d++) {
    const i = yearIdx - d;
    if (i < 0) break;
    const c = predicateClass(tokens[i]);
    if (c) return c;
  }
  for (let d = 1; d <= 4; d++) {
    const i = yearIdx + d;
    if (i >= tokens.length) break;
    const c = predicateClass(tokens[i]);
    if (c) return c;
  }
  return null;
}

export function checkDateBinding(
  source: string,
  rewritten: string,
  year: number | string | null | undefined,
): string[] {
  if (year === undefined || year === null || year === "") return [];
  const y = String(year).toLowerCase();
  const srcTokens = wordTokens(source);
  const srcIdx = srcTokens.indexOf(y);
  if (srcIdx === -1) return []; // year not in the source: nothing to bind
  const srcClass = classNearYear(srcTokens, srcIdx);
  if (!srcClass) return []; // source year has no predicate: no constraint
  const rwTokens = wordTokens(rewritten);
  const rwIdx = rwTokens.indexOf(y);
  if (rwIdx === -1) return ["dropped-year"];
  const rwClass = classNearYear(rwTokens, rwIdx);
  if (!rwClass) return ["dropped-date-predicate"];
  if (rwClass !== srcClass) return ["date-predicate-drift"];
  return [];
}

/** Four-digit years (1000–2029) in a story, for date-binding checks. */
export function findYears(text: string): string[] {
  const years = new Set<string>();
  for (const m of String(text ?? "").matchAll(/\b(1[0-9]{3}|20[0-2][0-9])\b/g)) {
    years.add(m[1]);
  }
  return [...years];
}

/**
 * Runtime entry point: validate a Nano story sentence against the source
 * extract. Returns violation codes; empty = valid.
 *
 * With an extract: length, banned patterns, content-word grounding, scope
 * words, hedging preservation, and date-predicate binding for every year
 * the story mentions. (The named-after inversion check needs the
 * pipeline's `person` token set, which the runtime does not have — it is
 * exported for pipeline/test use.)
 *
 * Without an extract: only the checks that need no source — length, banned
 * patterns, and scope words, where ANY scope-flipping word is ungrounded
 * and fails closed.
 */
export function validateStory(story: string, extract?: string | null): string[] {
  const violations: string[] = [...checkLength(story), ...checkBanned(story)];
  if (typeof extract === "string" && extract.length > 0) {
    violations.push(...checkContentWords(story, extract));
    violations.push(...checkScopeWords(story, extract));
    violations.push(...checkHedging(extract, story));
    for (const year of findYears(story)) {
      violations.push(...checkDateBinding(extract, story, year));
    }
  } else {
    violations.push(...checkScopeWords(story, ""));
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Prompt construction.
// The extract is accepted as an optional input: the build-time ladder owns
// the crawl (scripts/enrich-wikipedia.mjs, MediaWiki
// action=query&prop=extracts&exintro=1). Phase 3 may pass the chunk's
// extract here, or fetch it at runtime from
// https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1
// &explaintext=1&format=json&titles=<wiki-slug>&origin=* — the same
// endpoint, with origin=* for CORS.
// ---------------------------------------------------------------------------

/** The extract embedded in the prompt is capped so Nano sees a bounded input. */
export const PROMPT_EXTRACT_CAP = 2000;

export interface StoryPromptInput {
  /** "Houston, Texas" — cityLabelForPlace(place) already builds this. */
  label: string;
  /** Wikipedia intro extract when the place has a `wiki` slug; null otherwise. */
  extract?: string | null;
}

/**
 * Build the Nano prompt for one story sentence. Two paths:
 * - with extract: Nano is grounded ONLY in the provided extract;
 * - without: Nano answers only from well-established facts and must reply
 *   EMPTY rather than guess (an empty reply is invalid → generic blurb).
 * Both paths carry the four card principles and two few-shot examples (one
 * named-after, one founding) demonstrating the tone.
 */
export function buildStoryPrompt({ label, extract }: StoryPromptInput): string {
  const sourceBlock =
    typeof extract === "string" && extract.trim().length > 0
      ? `Use ONLY facts from this Wikipedia extract. Do not write anything that is not in it:\n---\n${extract.slice(0, PROMPT_EXTRACT_CAP)}\n---`
      : `No source text is available. Answer only from well-established facts you are sure about. ` +
        `If you are not sure of any true, specific fact about this place, reply with an EMPTY ` +
        `response — nothing at all, not even punctuation. Guessing is worse than silence.`;
  return (
    `You are writing one story sentence for a kids' geography quiz card.\n` +
    `\n` +
    `Place: ${label}\n` +
    `\n` +
    `Rules — every reply must follow all of these:\n` +
    `1. Reply with EXACTLY ONE sentence, 20 to 240 characters, ending with a period. No quotes, no preamble, no second sentence.\n` +
    `2. History first, modern identity second: lead with how the place began or who/what it is named after.\n` +
    `3. Plain words a 10-year-old knows. Never write coordinates, elevation, population numbers, or measurements.\n` +
    `4. Include ONE memorable hook — a person, event, quote, movie, or record. If a kid could not retell it, the sentence fails.\n` +
    `5. Use a number only when it teaches something (a first, a biggest, a record year).\n` +
    `6. Never invent people, dates, or events. If the extract hedges ("probably", "legend says"), keep the hedge — never state a hedged claim as certain, and never add hedging the extract does not have.\n` +
    `\n` +
    `${sourceBlock}\n` +
    `\n` +
    `Two examples of the tone:\n` +
    `Place: Washington, District of Columbia\n` +
    `It was named after George Washington, the country's first president, whose face is on the one-dollar bill.\n` +
    `\n` +
    `Place: Rome, Italy\n` +
    `Legend says twin brothers Romulus and Remus, raised by a wolf, founded Rome after Romulus won their argument over which hill to build on.\n` +
    `\n` +
    `Now write the one sentence for ${label}:`
  );
}

/** Strip fences/quotes around a model reply; "" means "nothing to say". */
export function normalizeAiReply(text: string): string {
  return String(text ?? "")
    .replace(/^```(?:json|text)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Nano session (local namespace access; the shared browserAiAvailable()
// imported from sports-ai.ts is the only availability gate).
// ---------------------------------------------------------------------------

interface PromptApiNamespace {
  availability(options?: unknown): Promise<string>;
  create(options?: Record<string, unknown>): Promise<PromptSession>;
  capabilities?(): Promise<{ available?: string }>;
}

declare global {
  interface Window {
    LanguageModel?: PromptApiNamespace;
    ai?: { languageModel?: PromptApiNamespace };
  }
}

function storyNamespace(): PromptApiNamespace | null {
  try {
    if (typeof window === "undefined") return null;
    if (window.LanguageModel) return window.LanguageModel;
    if (window.ai?.languageModel) return window.ai.languageModel;
    return null;
  } catch {
    return null;
  }
}

const QUERY_TIMEOUT_MS = 30_000;

export interface QueryAiStoryOptions {
  openSession?: () => Promise<PromptSession>;
  /** AbortSignal from the hook's place-change cleanup; also injectable for tests. */
  signal?: AbortSignal;
}

/**
 * Ask the on-device model for one story sentence about a place.
 * The reply is normalized and run through validateStory() against the
 * extract; ANY failure → null and the generic blurb stands. Returns the
 * validated sentence, or null when the model is unusable, says nothing
 * usable, or the request is aborted/times out. Never throws.
 */
export async function queryAiStory(
  label: string,
  extract: string | null,
  opts?: QueryAiStoryOptions,
): Promise<string | null> {
  const open = opts?.openSession ?? (async () => {
    const ns = storyNamespace();
    if (!ns) throw new Error("no prompt API");
    try {
      return await ns.create({ temperature: 0 });
    } catch {
      return await ns.create();
    }
  });
  const signal = opts?.signal;
  if (signal?.aborted) return null;

  let session: PromptSession | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | null = null;
  try {
    session = await open();
    if (signal?.aborted) return null;
    const abortPromise = signal
      ? new Promise<never>((_, reject) => {
          abortListener = () => reject(new Error("ai query aborted"));
          signal.addEventListener("abort", abortListener, { once: true });
        })
      : null;
    const tasks: Array<Promise<string>> = [session.prompt(buildStoryPrompt({ label, extract }))];
    if (abortPromise) tasks.push(abortPromise);
    const reply = await Promise.race([
      ...tasks,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("ai query timeout")), QUERY_TIMEOUT_MS);
      }),
    ]);
    const story = normalizeAiReply(reply);
    if (story.length === 0) return null; // empty = "nothing to say", never proof of nothing
    return validateStory(story, extract).length === 0 ? story : null;
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (abortListener) {
      try {
        signal?.removeEventListener("abort", abortListener);
      } catch {
        // ignore
      }
    }
    try {
      session?.destroy();
    } catch {
      // ignore
    }
  }
}

// ---------------------------------------------------------------------------
// Per-device cache (localStorage, 180-day TTL). Stores the validated story;
// an empty string means "Nano checked, nothing usable — don't re-prompt".
// ---------------------------------------------------------------------------

const CACHE_PREFIX = "meridian.ai-story.v1.";
const CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000;

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** Cache key for a place: the GeoNames id when present, else the raw place id. */
export function storyCacheKey(placeId: string): string {
  return CACHE_PREFIX + (geonameIdOf(placeId) ?? placeId);
}

/**
 * Read the cached Nano outcome: the story string, "" when Nano already
 * checked this place and had nothing usable, null on a cache miss (or when
 * storage is unavailable/corrupt/expired).
 */
export function readCachedStory(placeId: string): string | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(storyCacheKey(placeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { story?: unknown; at?: unknown };
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > CACHE_TTL_MS) {
      s.removeItem(storyCacheKey(placeId));
      return null;
    }
    return typeof parsed.story === "string" ? parsed.story : null;
  } catch {
    return null;
  }
}

/** Cache a Nano outcome, including "" for "checked, nothing usable". Best-effort. */
export function writeCachedStory(placeId: string, story: string): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(storyCacheKey(placeId), JSON.stringify({ story, at: Date.now() }));
  } catch {
    // Quota or private mode — the cache is best-effort; the generic blurb
    // still renders.
  }
}

// ---------------------------------------------------------------------------
// Hook.
// ---------------------------------------------------------------------------

/** Structural place view the hook needs. `fact` is the build-time ladder's
 *  optional field (owned by the ladder worker in generated-places.ts);
 *  `history` is the Wikipedia hook sentence already merged on main (PR #30).
 *  Either one present means the card already teaches — Nano stays asleep. */
export interface StoryPlace {
  id: string;
  name: string;
  regionId: string;
  originRegionId?: string;
  fact?: string | null;
  history?: string | null;
  wiki?: string | null;
  /** True for hand-authored curated starters — Nano never fires for these. */
  curated?: boolean;
}

/**
 * Pure firing decision, unit-tested: Nano may fire only for a real GENERATED
 * place (GeoNames `gn-<digits>` id, same gate useAiSportsTeams uses) with NO
 * build-time enrichment and NO curated flag. Missing, null, and empty-string
 * facts/history all count as "no enrichment" — an empty string teaches
 * nothing. The curated flag is the explicit discriminator; the id-format
 * check is defense-in-depth for places from other datasets.
 */
export function shouldFireAiStory(place: StoryPlace | null): boolean {
  if (!place || typeof place.id !== "string" || place.id.length === 0) return false;
  if (place.curated === true) return false;
  if (geonameIdOf(place.id) === null) return false;
  if (typeof place.fact === "string" && place.fact.length > 0) return false;
  if (typeof place.history === "string" && place.history.length > 0) return false;
  return true;
}

/**
 * React hook: the on-device AI story fallback for one place.
 * Returns the validated Nano story sentence (render with withStoryLine), or
 * null when the generic blurb should stand — build-time enrichment present,
 * no on-device AI, the cache says "nothing usable", or the model had
 * nothing valid to add.
 *
 * The hook never fires when place.fact or place.history is a non-empty
 * string, never fires for curated (non-`gn-`) places, never fires during
 * E2E (browserAiAvailable() is false in the test Chromium), and is
 * cancelled on place change via AbortController + the cancelled flag.
 */
export function useAiStory(place: StoryPlace | null, extract?: string | null): string | null {
  const [story, setStory] = useState<string | null>(null);
  const placeId = place?.id ?? null;
  const extractText = extract ?? null;

  useEffect(() => {
    setStory(null);
    if (!shouldFireAiStory(place)) return;
    // Explicit E2E guard: the test Chromium has no Prompt API namespace
    // (verified), but webdriver-flagged browsers never get AI content either,
    // keeping E2E deterministic even if a future test browser ships a model.
    if (typeof navigator !== "undefined" && navigator.webdriver === true) return;
    const pid = place!.id;
    let cancelled = false;
    const controller = new AbortController();

    const cached = readCachedStory(pid);
    if (cached !== null) {
      if (cached.length > 0) setStory(cached);
      return;
    }

    (async () => {
      if (!(await browserAiAvailable())) return;
      if (cancelled) return;
      const result = await queryAiStory(cityLabelForPlace(place!), extractText, {
        signal: controller.signal,
      });
      if (cancelled) return;
      // Cache the outcome either way ("" = "checked, nothing usable") so we
      // don't wake the model on every view of the same place.
      writeCachedStory(pid, result ?? "");
      if (result) setStory(result);
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId, extractText]);

  return story;
}

// ---------------------------------------------------------------------------
// Card composition.
// ---------------------------------------------------------------------------

/**
 * Merge a validated Nano story into the card's base story, mirroring
 * withSportsLine: the generic blurb renders first and the AI sentence
 * upgrades it when it arrives. Null AI stories leave the base untouched.
 */
export function withStoryLine(baseStory: string, aiStory: string | null): string {
  if (!aiStory) return baseStory;
  return baseStory.length > 0 ? `${baseStory} ${aiStory}` : aiStory;
}

/**
 * UX honesty: the tiny "AI" indicator rendered next to the AI story at
 * card time (Phase 3 wiring). Subtle, kids first, disclosure second.
 */
export const AI_STORY_BADGE = {
  label: "AI",
  title: "Written with on-device AI",
} as const;
