/**
 * AI-first sports enrichment.
 *
 * Carve-out from the "no LLM for place data" rule, approved 2026-10-01 for
 * Big-5 team names only.
 *
 * Flow per place:
 *   1. The blurb baked at build time already carries the curated
 *      "Home of the ..." sentence — that is the instant fallback and renders
 *      with no JavaScript and no AI at all.
 *   2. When the browser exposes an on-device Prompt API model that is already
 *      downloaded (availability() === "available"), we ask it for the city's
 *      current Big-5 teams. The AI answer takes precedence when valid.
 *   3. The answer is validated before it ever reaches the DOM: it must parse
 *      as JSON, every league must be NFL/MLB/NBA/NHL/MLS, every team name
 *      must appear in the verified 154-team roster (sports-notes.json) with
 *      its official league, AND every team must belong to the queried city
 *      per the curated city mapping. A real team from the wrong city, or a
 *      right team with the wrong league, is dropped. If nothing valid
 *      remains, the curated line stands. An empty AI answer is treated as
 *      "nothing to add", never as proof a city has no teams. The AI can only
 *      ever confirm teams the city verifiably has — it can never invent
 *      teams, move teams between cities, or change a team's league.
 *   4. Valid results are cached per device (localStorage, 180-day TTL) so the
 *      model is consulted at most twice a year per place.
 *
 * We never trigger a silent multi-gigabyte model download: only
 * availability() === "available" is used. Everywhere else (Safari, Firefox,
 * mobile, no model) the curated line is the whole story.
 */
import { useEffect, useState } from "react";
import sportsNotesJson from "./data/sports-notes.json" with { type: "json" };

export interface AiSportsTeam {
  team: string;
  league: string;
}

const LEAGUE_ORDER = ["NFL", "MLB", "NBA", "NHL", "MLS"] as const;
const LEAGUES = new Set<string>(LEAGUE_ORDER);

/**
 * Verified rosters, built once from sports-notes.json (keyed by GeoNames id).
 * - TEAM_LEAGUE: every official Big-5 team name (lowercase) -> its league.
 * - CITY_TEAMS: GeoNames id -> the curated team names (lowercase) for that city.
 * Validation is city-scoped: a team must be in the queried city's set, so a
 * real team from the wrong city can never reach the DOM.
 */
const { TEAM_LEAGUE, CITY_TEAMS } = (() => {
  const leagues = new Map<string, string>();
  const cities = new Map<string, Set<string>>();
  const data = sportsNotesJson as unknown as Record<
    string,
    { teams?: Array<{ team?: unknown; league?: unknown }> }
  >;
  for (const [key, entry] of Object.entries(data)) {
    if (key.startsWith("_")) continue;
    const set = new Set<string>();
    for (const t of entry.teams ?? []) {
      if (typeof t.team !== "string" || t.team.length === 0) continue;
      const name = t.team.toLowerCase();
      set.add(name);
      if (typeof t.league === "string" && t.league.length > 0 && !leagues.has(name)) {
        leagues.set(name, t.league);
      }
    }
    cities.set(key, set);
  }
  return { TEAM_LEAGUE: leagues, CITY_TEAMS: cities };
})();

/** "Home of the Green Bay Packers (NFL)." — same shape as the build-time blurb. */
export function buildSportsSentence(teams: AiSportsTeam[]): string {
  const parts = teams.map((t) => `${t.team} (${t.league})`);
  if (parts.length === 1) return `Home of the ${parts[0]}.`;
  if (parts.length === 2) return `Home of the ${parts[0]} and ${parts[1]}.`;
  return `Home of the ${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}.`;
}

/**
 * Replace (or append) the trailing "Home of the ..." sentence in a blurb with
 * the AI-validated teams. Pure string surgery on a deterministic format.
 */
export function withSportsLine(story: string, teams: AiSportsTeam[]): string {
  const sentence = buildSportsSentence(teams);
  // Period-tolerant: team names like "D.C. United" and "St. Louis City SC"
  // contain periods, so [^.] can never span the sentence. Anchor on the LAST
  // "Home of the" occurrence and require the parenthesized league before the
  // final period — every baked/AI sports sentence ends "(LEAGUE)." — so a
  // trailing non-sports sentence, or an earlier "Home of the" mention, can
  // never be eaten by a greedy match.
  const idx = story.lastIndexOf(" Home of the ");
  if (idx !== -1 && / \([A-Z]+\)\.\s*$/.test(story)) {
    return `${story.slice(0, idx)} ${sentence}`;
  }
  return `${story} ${sentence}`;
}

/** Extract the JSON payload from a model reply (tolerates ``` fences). */
export function parseAiJson(text: string): unknown {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

/**
 * Validate a parsed AI answer against the queried city's curated roster.
 * Keeps only entries with a known league, a team name from the verified
 * global roster, the team's official league, and membership in the city's
 * team set; dedupes; sorts NFL → MLB → NBA → NHL → MLS. Returns [] when
 * nothing survives or the city is unknown (caller treats that as "no
 * override"). The AI can only confirm teams the city verifiably has — a
 * wrong-city team or a league mismatch never survives.
 */
export function validateAiTeams(raw: unknown, geonameId: string | null): AiSportsTeam[] {
  if (!Array.isArray(raw)) return [];
  const cityTeams = geonameId ? CITY_TEAMS.get(geonameId) : undefined;
  if (!cityTeams) return [];
  const seen = new Set<string>();
  const out: AiSportsTeam[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { team, league } = item as { team?: unknown; league?: unknown };
    if (typeof team !== "string" || typeof league !== "string") continue;
    const name = team.trim();
    if (name.length === 0 || name.length > 60) continue;
    if (!LEAGUES.has(league)) continue;
    const key = name.toLowerCase();
    const officialLeague = TEAM_LEAGUE.get(key);
    if (!officialLeague || officialLeague !== league) continue;
    if (!cityTeams.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ team: name, league });
  }
  out.sort(
    (a, b) =>
      LEAGUE_ORDER.indexOf(a.league as (typeof LEAGUE_ORDER)[number]) -
        LEAGUE_ORDER.indexOf(b.league as (typeof LEAGUE_ORDER)[number]) ||
      a.team.localeCompare(b.team),
  );
  return out;
}

/** "gn-5254962" → "5254962". */
export function geonameIdOf(placeId: string): string | null {
  const m = /^gn-(\d+)$/.exec(placeId);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Per-device cache (localStorage, 180-day TTL). Stores the validated AI teams;
// an empty array means "AI checked, nothing to add — curated line stands".
// ---------------------------------------------------------------------------

const CACHE_PREFIX = "meridian:sports-ai:v1:";
const CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000;

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function readCachedTeams(geonameId: string): AiSportsTeam[] | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(CACHE_PREFIX + geonameId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { teams?: unknown; at?: unknown };
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > CACHE_TTL_MS) {
      s.removeItem(CACHE_PREFIX + geonameId);
      return null;
    }
    const teams = validateAiTeams(parsed.teams, geonameId);
    // validateAiTeams([]) === [] — but we must distinguish "cached empty"
    // from "corrupt entry". Re-check the raw shape for the empty case.
    if (teams.length === 0 && !Array.isArray(parsed.teams)) return null;
    return teams;
  } catch {
    return null;
  }
}

export function writeCachedTeams(geonameId: string, teams: AiSportsTeam[]): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(CACHE_PREFIX + geonameId, JSON.stringify({ teams, at: Date.now() }));
  } catch {
    // Quota or private mode — the cache is best-effort; the curated line
    // still renders.
  }
}

// ---------------------------------------------------------------------------
// Browser Prompt API (Chrome on-device Gemini Nano). Feature-detected; the
// legacy window.ai namespace is accepted as a fallback.
// ---------------------------------------------------------------------------

export interface PromptSession {
  prompt(input: string): Promise<string>;
  destroy(): void;
}

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

function promptNamespace(): PromptApiNamespace | null {
  try {
    if (typeof window === "undefined") return null;
    if (window.LanguageModel) return window.LanguageModel;
    if (window.ai?.languageModel) return window.ai.languageModel;
    return null;
  } catch {
    return null;
  }
}

/**
 * True only when an on-device model is already present. "downloadable" /
 * "downloading" deliberately do NOT count — we never start a multi-gigabyte
 * download without the user asking for it.
 */
export async function browserAiAvailable(): Promise<boolean> {
  const ns = promptNamespace();
  if (!ns) return false;
  try {
    if (typeof ns.availability === "function") {
      return (await ns.availability()) === "available";
    }
    if (typeof ns.capabilities === "function") {
      const caps = await ns.capabilities();
      return caps?.available === "readily";
    }
    return false;
  } catch {
    return false;
  }
}

function buildPrompt(cityLabel: string): string {
  return (
    `List the Big-5 professional sports teams (NFL, MLB, NBA, NHL, MLS) whose ` +
    `home market is "${cityLabel}". Reply with ONLY a JSON array, no other text, ` +
    `like [{"team":"Green Bay Packers","league":"NFL"}]. If none, reply [].`
  );
}

const QUERY_TIMEOUT_MS = 30_000;

/**
 * Ask the on-device model for a city's teams. `openSession` is injectable for
 * tests; by default it creates a real Prompt API session at temperature 0.
 * The answer is validated against the city's curated roster (city-scoped, so
 * a wrong-city team can never survive). Returns the validated teams, or null
 * when the model is unusable / says nothing usable. Never throws.
 */
export async function queryAiTeams(
  cityLabel: string,
  geonameId: string | null,
  openSession?: () => Promise<PromptSession>,
): Promise<AiSportsTeam[] | null> {
  const open = openSession ?? (async () => {
    const ns = promptNamespace();
    if (!ns) throw new Error("no prompt API");
    try {
      return await ns.create({ temperature: 0 });
    } catch {
      return await ns.create();
    }
  });
  let session: PromptSession | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    session = await open();
    const reply = await Promise.race([
      session.prompt(buildPrompt(cityLabel)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("ai query timeout")), QUERY_TIMEOUT_MS);
      }),
    ]);
    const teams = validateAiTeams(parseAiJson(reply), geonameId);
    return teams.length > 0 ? teams : null;
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    try {
      session?.destroy();
    } catch {
      // ignore
    }
  }
}

function prettyRegion(regionId: string): string {
  if (!regionId || regionId === "globe") return "";
  return regionId
    .split("-")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function cityLabelForPlace(place: {
  name: string;
  regionId: string;
  originRegionId?: string;
}): string {
  // Whole-country runs re-tag subdivision places to the country's region;
  // prefer the display-only origin so the AI query keeps state-level
  // disambiguation ("Houston, Texas", not "Houston, United States").
  const region = prettyRegion(place.originRegionId ?? place.regionId);
  return region ? `${place.name}, ${region}` : place.name;
}

/**
 * React hook: the AI-first sports override for one place.
 * Returns the validated AI teams (render with withSportsLine), or null when
 * the curated blurb line should stand (no AI, cache hit with nothing new, or
 * the model had nothing usable to add).
 */
export function useAiSportsTeams(
  place: { id: string; name: string; regionId: string; originRegionId?: string } | null,
): AiSportsTeam[] | null {
  const [override, setOverride] = useState<AiSportsTeam[] | null>(null);
  const placeId = place?.id ?? null;

  useEffect(() => {
    setOverride(null);
    if (!place || !placeId) return;
    const gid = geonameIdOf(placeId);
    if (!gid) return;
    let cancelled = false;

    const cached = readCachedTeams(gid);
    if (cached) {
      if (cached.length > 0) setOverride(cached);
      return;
    }

    (async () => {
      if (!(await browserAiAvailable())) return;
      const teams = await queryAiTeams(cityLabelForPlace(place), gid);
      if (cancelled) return;
      // Cache the outcome either way (empty = "checked, nothing to add") so
      // we don't wake the model on every view of the same place.
      writeCachedTeams(gid, teams ?? []);
      if (teams && teams.length > 0) setOverride(teams);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);

  return override;
}
