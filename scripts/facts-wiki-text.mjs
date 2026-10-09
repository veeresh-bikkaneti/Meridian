/**
 * Structured fact extraction from Wikipedia article extracts.
 *
 * Companion to scripts/enrich-wikipedia.mjs: that pipeline picks hook
 * *sentences* for cards; this one pulls machine-usable *triples* —
 * who a place was named after, and when/by whom it was founded — each
 * carrying its verbatim source sentence. A later pipeline stage can
 * compose these into kid-friendly card history (rule 1: history first).
 *
 * Fact types:
 *   named_after — "named after X" / "named for X" / "named in honor of X"
 *   founded     — "founded/established/incorporated/settled in YEAR (by X)"
 *
 * Adversarial guards (the known failure modes this must not repeat):
 *   - A year is only a founding year when it is attached to a founding
 *     predicate (founded/established/incorporated/settled). "First
 *     mentioned in 1234" is never upgraded to "founded in 1234" — the
 *     P571-style semantic drift.
 *   - Self-references ("named after the county", "named after itself",
 *     the place's own name) are rejected.
 *   - Bureaucracy is rejected: "named by the Queensland Place Names
 *     Board" names paperwork, not a story; "incorporated in 1914 by the
 *     County Commission" likewise.
 *   - Record-creation dates ("the GNIS entry was created in 1980") are
 *     not founding dates.
 *   - Sentences carrying population/census/elevation/coordinates are
 *     never fact sources.
 *   - A founded triple needs a story carrier: a named founder (a person
 *     or an enterprise like a railroad — not a commission), or a story
 *     keyword (railroad, gold, fort, …). A bare "incorporated in 1914"
 *     is a date anchor, not a fact any child could retell.
 *
 * Content-safety filtering (e.g. Confederate honorees) is Worker D's
 * job; this script keeps the fact verbatim and moves on.
 *
 * Usage:
 *   node scripts/facts-wiki-text.mjs extract   # read crawl cache → write JSONL (resumable)
 *   node scripts/facts-wiki-text.mjs report    # facts per type + top person names
 *
 * node stdlib only — no dependencies.
 */
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { splitSentences } from "./enrich-wikipedia.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = dirname(HERE);
const CACHE_PATH = join(REPO, ".scratch", "wikipedia-enrichment", "crawl-cache.jsonl");
const FACTS_DIR = join(REPO, ".scratch", "facts");
const FACTS_PATH = join(FACTS_DIR, "wiki-text-facts.jsonl");

// ---------------------------------------------------------------------------
// Pure functions (importable for unit tests)
// ---------------------------------------------------------------------------

/** Wikipedia article slug: the article title with spaces as underscores. */
export function sourceSlug(title) {
  return String(title).replace(/ /g, "_");
}

/** Base place name from a crawl-cache record: "Beebe, Arkansas" -> "Beebe". */
export function placeBaseName(title) {
  return String(title).split(",")[0].replace(/\s*\([^)]*\)\s*/g, "").trim();
}

// A founding year is only plausible between 1000 and the current year.
export const MIN_YEAR = 1000;
export const MAX_YEAR = 2026;

// Sentences carrying these can never be fact sources — stats and
// coordinates teach nothing, and the year in them belongs to the census,
// not to the town's story.
const FACT_BANNED_SENTENCE = [
  /°/, // coordinates
  /\belevation\b/i,
  /\bpopulation\b/i,
  /\bcensus\b/i,
  /\b\d[\d,]*\s*(people|residents|inhabitants|households)\b/i,
];

export function isFactSentence(sentence) {
  return !FACT_BANNED_SENTENCE.some((re) => re.test(sentence));
}

// Admin/paperwork nouns: naming or founding "by" one of these is
// bureaucracy, not a story a child could retell.
const ADMIN_NOUNS =
  /\b(county|counties|commission|council|board|committee|district|department|government|municipality|authorit(y|ies)|legislature|bureau|township|precinct|ward|state|nation|country|territory|city|town|village|hamlet|parish)\b/i;

// Demonyms and group nouns are not honorees: "named after Australian
// artists" or "named after Spanish explorers" names a people, not a person.
// Checked against the last token of a captured name (and the whole name).
const NOT_A_PERSON = new Set([
  "spanish", "french", "british", "english", "irish", "scottish", "welsh",
  "dutch", "german", "italian", "portuguese", "russian", "polish",
  "swedish", "norwegian", "danish", "finnish", "greek", "turkish",
  "chinese", "japanese", "korean", "indian", "indians", "australian",
  "canadian", "mexican", "american", "african", "european", "asian",
  "pomeranian", "vikings", "aztecs", "mayans", "incas",
  "artist", "artists", "explorer", "explorers", "settler", "settlers",
  "pioneer", "pioneers", "people", "peoples", "men", "women", "children",
  "natives", "mennonite", "mennonites", "amish", "quaker", "quakers",
  "mormon", "mormons", "aboriginal", "aborigines",
]);

// Story carriers: the vocabulary of a tellable founding — a person, an
// enterprise, a rush, a war, a trail. A founded triple without one is
// just a date anchor.
const STORY_KEYWORDS =
  /\b(railroad|railway|gold|silver|oil|cotton|battle|war|trail|fort|mission|mill|mine|mining|canal|port|depot|expedition|revolution|protest|march|boycott|strike|flood|fire|tornado|space|rocket|music|jazz|blues|baseball|football|settlers?|pioneers?|frontier|homestead|ranch|timber|lumber)\b/i;

// Lowercase words allowed *inside* a captured name ("San Jose", "de la Cruz").
// A connector only counts when the next token is also name-like, so
// "John Smith and the town grew" stops at "and".
const NAME_CONNECTORS = new Set([
  "de", "du", "del", "della", "di", "da", "la", "le", "les",
  "van", "von", "der", "den", "ten", "ter", "al", "el",
  "ibn", "bin", "st", "ste", "san", "santa", "y", "and", "of",
]);

const isCapitalized = (tok) => /^[\p{Lu}]/u.test(tok);
const isConnector = (tok) => NAME_CONNECTORS.has(tok.toLowerCase());

/**
 * Capture a person/entity name from the start of `text`: up to 6
 * capitalized tokens, allowing lowercase connectors between capitalized
 * tokens ("Rio de Janeiro" style). Stops at clause boundaries, commas,
 * numbers and lowercase words. Returns "" when nothing name-like leads.
 */
export function captureName(text) {
  let s = String(text).replace(/^[\s"“”'([{,;:–—-]+/, "");
  const raw = s.split(/\s+/).filter(Boolean);
  const tokens = [];
  for (let i = 0; i < raw.length && tokens.length < 6; i++) {
    // Trailing punctuation is stripped, including the sentence-final
    // period — but never the interior dots of "E."-style initials.
    let tok = raw[i].replace(/^["“”'([{]+/, "");
    const commaStop = /[,;:]$/.test(raw[i]);
    const isInitial = /^[A-Za-z]\.$/.test(tok);
    tok = tok.replace(/[,;:!?)"”'\]}]+$/, "").replace(/['’]s$/i, "");
    if (!isInitial) tok = tok.replace(/\.$/, "");
    if (!tok) break;
    if (isCapitalized(tok)) {
      tokens.push(tok);
      // An appositive follows the comma — "Howard Florey, Baron Florey"
      // names one person, and the title is not part of the name.
      if (commaStop) break;
      continue;
    }
    const nextRaw = raw[i + 1];
    const next = nextRaw ? nextRaw.replace(/[,;:!?)"”'\]}]+$/, "") : "";
    if (isConnector(tok) && tokens.length > 0 && next && isCapitalized(next)) {
      tokens.push(tok);
      continue;
    }
    break;
  }
  // A trailing connector means the name ran into a clause boundary
  // ("Dick Wick Hall, Ernest Hall and ...") — drop it.
  while (tokens.length > 0 && isConnector(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ");
}

/** A name is only a fact carrier when it is long enough to be a name. */
function isValidName(name) {
  return typeof name === "string" && name.replace(/[^A-Za-z]/g, "").length >= 2;
}

/**
 * Self-reference guard: "Washington" named after "Washington", or a town
 * "named after itself", is not a naming story. A honoree who shares only
 * part of the place name ("Beebe" named after "Roswell Beebe") is kept —
 * the first token must match for a rejection.
 */
export function isSelfName(name, placeBase) {
  const norm = (x) => x.toLowerCase().replace(/[^a-z]/g, "");
  const n = norm(name);
  const p = norm(placeBase);
  if (!n || !p || n.length < 2) return true;
  if (n === p) return true;
  const first = (x) => x.toLowerCase().split(/[\s.]+/)[0];
  const nf = first(name);
  const pf = first(placeBase);
  return nf.length >= 3 && nf === pf;
}

const NAMING_PREDICATE = /\bnamed\s+(in\s+honou?r\s+of|after|for)\s+/i;
// "named by the Queensland Place Names Board" is paperwork: the board
// chose the name; it is not who the place was named *for*.
const NAMED_BY = /\bnamed\s+by\b/i;
// "named after its founder, X" / "named for his wife, Mary" — the honoree
// hides behind a role noun.
const ROLE_NOUN = /^(?:its|the|their|his|her)\s+(founder|wife|husband|son|daughter|father|mother|brother|sister|namesake)[,\s]+/i;
// "named after Pratt's wife, Grace Salome Pratt" — the possessive names the
// relation, the actual honoree follows the role noun. One lowercase
// adjective may intervene ("Brazil's last Emperor").
const POSSESSIVE_ROLE = /^([A-Z][\w.'’-]*['’]s)\s+(?:[a-z]+\s+)?(wife|husband|son|daughter|father|mother|brother|sister|emperor|empress|king|queen|czar|chief)\b[,\s]*/i;
// "named after Tarn native, Jean-Louis Étienne" — a demonym/adjective plus
// "native"/"resident" introduces the real name after the comma.
const DEMONYM_NATIVE = /^([A-Z][\w.'’-]*)\s+(native|resident)\b[,\s]+/i;

/**
 * Extract a named_after fact from one sentence. Returns `{ person }`
 * or null. `placeBase` is the place's own base name for self-rejection.
 */
export function extractNamedAfter(sentence, placeBase = "") {
  if (!isFactSentence(sentence)) return null;
  if (NAMED_BY.test(sentence)) return null; // bureaucracy, not a honoree
  const m = sentence.match(NAMING_PREDICATE);
  if (!m) return null;
  let rest = sentence.slice(m.index + m[0].length);
  // Admin paper: "named after the county", "named for a commission".
  if (/^(?:the|a|an|its|this|that|these|those)\s+/i.test(rest) && ADMIN_NOUNS.test(rest.split(/[.,;]/)[0])) {
    return null;
  }
  if (/\b(itself|themselves)\b/i.test(rest.split(/[.,;]/)[0])) return null;
  let name = "";
  const relM = rest.match(POSSESSIVE_ROLE) || rest.match(DEMONYM_NATIVE);
  if (relM) {
    // The honoree follows the role noun. When nothing name-like follows
    // ("named after Brazil's last Emperor."), reject outright — never fall
    // back to the possessive word ("Brazil").
    name = captureName(rest.slice(relM[0].length));
    if (!isValidName(name)) return null;
  } else {
    name = captureName(rest);
    if (!name) {
      // "named for its founder, Thomas Hart Benton" / "named after his wife Mary"
      const fm = rest.match(ROLE_NOUN);
      if (fm) name = captureName(rest.slice(fm[0].length));
    }
  }
  if (!isValidName(name)) return null;
  if (isSelfName(name, placeBase)) return null;
  if (ADMIN_NOUNS.test(name)) return null;
  // "named for Osmond Gilles) and Blythetown, named for James Blythe" —
  // the post-"and" word is a different town, not a co-honoree.
  const andIdx = name.lastIndexOf(" and ");
  if (andIdx !== -1) {
    const tail = name.slice(andIdx + 5);
    if (!tail.includes(" ") && /(town|ville|burg|burgh|city|borough|mouth|haven|shire|port)$/i.test(tail)) {
      name = name.slice(0, andIdx);
    }
  }
  const lastTok = name.split(/\s+/).pop().toLowerCase().replace(/\.$/, "");
  if (NOT_A_PERSON.has(lastTok) || NOT_A_PERSON.has(name.toLowerCase())) return null;
  return { person: name };
}

const FOUNDING_PREDICATE = /\b(found|founded|established|incorporated|settled)\s+(?:in\s+(?:the\s+)?)?(\d{3,4})s?\b/i;
// Looser word order: "founded by John Smith in 1854". Kept tight (one
// sentence, 80 chars) so the year cannot drift in from another clause;
// the story-carrier rule below still applies.
const FOUNDING_PREDICATE_LOOSE = /\b(founded|established|incorporated|settled)\b[^.?!]{0,80}?\bin\s+(?:the\s+)?(\d{3,4})s?\b/i;
// The P571-style drift: "first mentioned/recorded in 1234" is a source
// date, never a founding date. ("First settled" is a settlement claim
// and stays eligible.)
const FIRST_MENTIONED = /\bfirst\s+(mentioned|recorded|appeared|documented|noted)\s+in\b/i;
// Record-creation, not town-creation.
const RECORD_CREATION =
  /\b(GNIS|database|entry|record)\s+(was\s+)?created\b/i;
const REGISTER_LISTING = /\badded\s+to\s+the\s+(national\s+)?register\b/i;
// The predicate belongs to a post office, school, church… not the place.
const NON_PLACE_SUBJECT =
  /\b(post\s+office|railroad\s+station|depot|school|church|mission|day|festival|event|award|prize|holiday|company|corporation|organization|university|college|band|team)\s+(was\s+)?(established|founded)\b/i;

/**
 * Extract a founded fact from one sentence. Returns `{ year, founder }`
 * (founder may be null) or null. A triple is only returned when the year
 * has a story carrier: a named founder, or a story keyword in the
 * sentence.
 */
export function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractFounded(sentence, placeBase = "") {
  if (!isFactSentence(sentence)) return null;
  if (FIRST_MENTIONED.test(sentence)) return null;
  if (RECORD_CREATION.test(sentence)) return null;
  if (REGISTER_LISTING.test(sentence)) return null;
  if (NON_PLACE_SUBJECT.test(sentence)) return null;
  // Strict word order first ("founded in 1854"); the loose pattern
  // ("founded by X in 1854", "founded as a boomtown in 1850") only runs
  // when strict finds nothing.
  let m = sentence.match(FOUNDING_PREDICATE);
  let isLoose = false;
  if (!m) {
    m = sentence.match(FOUNDING_PREDICATE_LOOSE);
    isLoose = true;
  }
  if (!m) return null;
  const year = Number(m[2]);
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) return null;
  // Optional founder: the capitalized name after a "by" that belongs to
  // the founding clause. "owned by", "developed by", "backed by" in a later
  // clause name someone adjacent to the founding, not the founder — so the
  // stretch between the year and the "by" must be clause-clean (no comma,
  // no competing verb).
  let founder = null;
  // Loose matches span predicate..year, so the founder's "by" lives
  // inside the match; strict matches end at the year, so it lives after.
  const searchFrom = isLoose ? m[0].slice(m[1].length) : sentence.slice(m.index + m[0].length);
  const byM = searchFrom.match(/\bby\s+(the\s+)?/i);
  if (byM) {
    const gap = searchFrom.slice(0, byM.index);
    const gapClean = !/[,;]/.test(gap) && !/\b(was|were|is|are|owned|led|built|operated|developed)\b/i.test(gap);
    if (gapClean) {
      const cand = captureName(searchFrom.slice(byM.index + byM[0].length));
      if (isValidName(cand) && !ADMIN_NOUNS.test(cand)) {
        const lastTok = cand.split(/\s+/).pop().toLowerCase().replace(/\.$/, "");
        if (!NOT_A_PERSON.has(lastTok) && !NOT_A_PERSON.has(cand.toLowerCase())) {
          founder = cand;
        }
      }
    }
  }
  // Story-carrier rule: a founder or a tellable keyword, else this is a
  // bare date anchor ("incorporated in 1914", "incorporated in 1914 by
  // the County Commission") — paperwork, not a fact. The place's own name
  // tokens are blanked first, so "Mission, BC ... Mission City" cannot
  // carry itself on the word "mission".
  let carrierText = sentence;
  if (placeBase) {
    const toks = placeBase.toLowerCase().match(/[a-z]+/g) ?? [];
    if (toks.length > 0) {
      carrierText = sentence.replace(
        new RegExp(`\\b(${toks.map(escapeRegExp).join("|")})\\b`, "gi"),
        " ",
      );
    }
  }
  if (!founder && !STORY_KEYWORDS.test(carrierText)) return null;
  return { year, founder };
}

/**
 * Extract all structured facts from a Wikipedia intro extract. Each fact
 * carries its verbatim source sentence. `placeBase` is the place's own
 * base name (for self-reference rejection).
 */
export function extractFacts(extractText, placeBase = "") {
  if (typeof extractText !== "string" || !extractText.trim()) return [];
  const facts = [];
  const seen = new Set();
  for (const sentence of splitSentences(extractText)) {
    if (sentence.length > 600) continue;
    const na = extractNamedAfter(sentence, placeBase);
    if (na) {
      const key = `named_after|${na.person.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        facts.push({ factType: "named_after", person: na.person, year: null, sentence });
      }
    }
    const fo = extractFounded(sentence, placeBase);
    if (fo) {
      const key = `founded|${fo.year}|${(fo.founder ?? "").toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        facts.push({ factType: "founded", person: fo.founder, year: fo.year, sentence });
      }
    }
  }
  return facts;
}

// ---------------------------------------------------------------------------
// Cache reading (read-only; the crawler may be writing right now)
// ---------------------------------------------------------------------------

/**
 * First matched record with a non-empty extract per geonames id. Streams
 * the file so a concurrently-growing cache is fine; a torn trailing line
 * is skipped.
 */
export async function readMatchedRecords() {
  const records = new Map();
  const rl = createInterface({
    input: createReadStream(CACHE_PATH, "utf8"),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      continue; // torn line from the live crawler — skip
    }
    if (records.has(rec.id)) continue; // dedupe: first record per id wins
    if (rec.status === "matched" && typeof rec.extract === "string" && rec.extract.trim()) {
      records.set(rec.id, rec);
    }
  }
  return records;
}

function readExistingIds() {
  const ids = new Set();
  if (!existsSync(FACTS_PATH)) return ids;
  for (const line of readFileSync(FACTS_PATH, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (rec.geonamesId) ids.add(rec.geonamesId);
    } catch {
      // skip torn lines
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function cmdExtract() {
  if (!existsSync(CACHE_PATH)) {
    console.error("crawl cache not found — run enrich-wikipedia.mjs crawl first");
    process.exit(1);
  }
  mkdirSync(FACTS_DIR, { recursive: true });
  const doneIds = readExistingIds();
  const records = await readMatchedRecords();
  const out = createWriteStream(FACTS_PATH, { flags: "a" });
  let processed = 0;
  let namedAfter = 0;
  let founded = 0;
  let skipped = 0;
  for (const rec of records.values()) {
    const geonamesId = rec.id;
    if (doneIds.has(geonamesId)) {
      skipped++;
      continue;
    }
    const base = placeBaseName(rec.title ?? "");
    const slug = sourceSlug(rec.title ?? "");
    for (const f of extractFacts(rec.extract, base)) {
      out.write(
        JSON.stringify({
          geonamesId,
          factType: f.factType,
          person: f.person,
          year: f.year,
          sentence: f.sentence,
          sourceSlug: slug,
        }) + "\n",
      );
      if (f.factType === "named_after") namedAfter++;
      else founded++;
    }
    processed++;
  }
  out.end();
  await new Promise((r) => out.on("finish", r));
  console.log(
    `extract done: ${processed.toLocaleString("en-US")} places processed ` +
      `(${skipped.toLocaleString("en-US")} already present), ` +
      `named_after=${namedAfter.toLocaleString("en-US")}, founded=${founded.toLocaleString("en-US")}`,
  );
}

async function cmdReport() {
  if (!existsSync(FACTS_PATH)) {
    console.error("no facts yet — run `extract` first");
    process.exit(1);
  }
  const perType = {};
  const places = new Set();
  const people = new Map();
  let sampleNA = [];
  let sampleF = [];
  for (const line of readFileSync(FACTS_PATH, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    perType[rec.factType] = (perType[rec.factType] ?? 0) + 1;
    places.add(rec.geonamesId);
    if (rec.person) {
      const key = rec.person.toLowerCase();
      people.set(key, (people.get(key) ?? 0) + 1);
    }
    if (rec.factType === "named_after" && sampleNA.length < 5) {
      sampleNA.push(rec);
    } else if (rec.factType === "founded" && sampleF.length < 5) {
      sampleF.push(rec);
    }
  }
  console.log(`facts: ${Object.entries(perType).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`places with ≥1 fact: ${places.size.toLocaleString("en-US")}`);
  console.log("top person names:");
  for (const [name, n] of [...people.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`  ${n}x  ${name}`);
  }
  for (const s of sampleNA) {
    console.log(`  NA [${s.geonamesId}] ${s.person} — "${s.sentence.slice(0, 140)}"`);
  }
  for (const s of sampleF) {
    console.log(`  FO [${s.geonamesId}] ${s.year}${s.person ? ` by ${s.person}` : ""} — "${s.sentence.slice(0, 140)}"`);
  }
}

const cmd = process.argv[2];
const onlyMain = process.argv[1] === fileURLToPath(import.meta.url);
if (onlyMain) {
  if (cmd === "extract") {
    await cmdExtract();
  } else if (cmd === "report") {
    await cmdReport();
  } else {
    console.error("usage: facts-wiki-text.mjs <extract|report>");
    process.exit(1);
  }
}
