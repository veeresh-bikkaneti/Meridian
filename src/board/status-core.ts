/**
 * Board v3 — pure status core (no React, no DOM, node-testable).
 *
 * One source of truth for how the public board's words are produced:
 *  - the curation file (private, lives with the work) holds epics,
 *    features, stories, their hidden tasks and work records, and the
 *    recorded waits;
 *  - this module computes statuses mechanically and builds the
 *    SANITISED published file the board actually reads. Task counts are
 *    computed here and never leave: the published shape has no field
 *    that could carry one (enforced by scanBanned + the shape tests).
 *
 * Status words and phase strings marked † are the design mockup's
 * defaults (council spec §9 items 1–2), recorded in the PR as
 * "default, awaiting owner ruling" — not settled copy.
 */

export type BoardStatus = "not-started" | "in-progress" | "done";

/** † DEFAULT — AWAITING OWNER RULING (spec §9.1): UI/UX seat's plain set. */
export const STATUS_WORD: Record<BoardStatus, string> = {
  "not-started": "Not started yet",
  "in-progress": "Working on it now",
  done: "Done",
};

export type AnimKind =
  | "sum"
  | "pin"
  | "magnifier"
  | "compass"
  | "river"
  | "flask"
  | "book"
  | "mic"
  | "gear"
  | "star";

/** A hidden builder job. Never rendered, never published. */
export interface CurationTask {
  title: string;
  /** Phase stem, e.g. "Testing" → the line "Testing in progress". */
  phase: string;
  /** Work-record (pull request) number, private to the curation file. */
  record?: number;
}

export interface CurationStory {
  /** Repo-internal story id (lane/slug). Private: never published. */
  sourceId: string;
  /** Public link key, derived from the plain title. */
  slug: string;
  title: string;
  /** Work-record numbers proving this story's work. Private. */
  records: number[];
  /** Status carried by the §6 migration rule until a task breakdown exists. */
  carriedStatus: BoardStatus;
  /** † Phase line for a carried in-progress story (mockup default, §9.2). */
  phase?: string;
  /**
   * Board v4: an explicit player-words line that wins over the derived
   * line for a done / in-progress story (e.g. a finished story whose
   * honest line is "Finished", not "Ready to play"). Set only from the
   * generation source's LINE_OVERRIDES (scripts/board/board-v3-data.mjs).
   */
  lineOverride?: string;
  /** Hidden tasks — present only once the story's feature is broken down. */
  tasks?: CurationTask[];
}

export interface CurationFeature {
  id: string;
  name: string;
  promise: string;
  anim: AnimKind;
  stories: CurationStory[];
}

export interface CurationEpic {
  id: string;
  name: string;
  color: string;
  features: CurationFeature[];
}

export interface Curation {
  epics: CurationEpic[];
  /** Recorded waits, by story sourceId. The ONLY bonds that may be drawn. */
  waits: { from: string; to: string }[];
}

export interface RecordState {
  merged: boolean;
  open: boolean;
}

/**
 * The migration/status rule (spec §6), identical in shape to the rule
 * that produced the verified live picture: a story with records is Done
 * when ALL its records are merged, In progress when ANY is open,
 * otherwise it keeps its carried status. A partially-known record set
 * cannot prove Done. Stories without records keep their carried status.
 */
export function deriveFromRecords(
  records: readonly number[],
  states: ReadonlyMap<number, RecordState>,
  carried: BoardStatus,
): BoardStatus {
  if (records.length === 0) return carried;
  const known = records.map((n) => states.get(n)).filter((s): s is RecordState => Boolean(s));
  if (known.length === 0) return carried;
  if (known.some((s) => s.open)) return "in-progress";
  if (known.length === records.length && known.every((s) => s.merged)) return "done";
  return carried;
}

/** A task is done when its work record is merged (no record = not done). */
export function taskDone(task: CurationTask, states: ReadonlyMap<number, RecordState>): boolean {
  if (task.record === undefined) return false;
  return states.get(task.record)?.merged === true;
}

/**
 * Mechanical status for a story. With a task breakdown, closure is
 * task-based (§2): Done only when every task is done; In progress when
 * at least one task is done or has an open record; otherwise Not
 * started. Without a breakdown, the §6 migration rule carries the
 * record-derived status. Handover is monotone: a breakdown written for
 * a carried-Done story (all its tasks done) reproduces Done.
 */
export function storyStatus(story: CurationStory, states: ReadonlyMap<number, RecordState>): BoardStatus {
  if (story.tasks && story.tasks.length > 0) {
    const doneCount = story.tasks.filter((t) => taskDone(t, states)).length;
    if (doneCount === story.tasks.length) return "done";
    const anyOpen = story.tasks.some((t) => t.record !== undefined && states.get(t.record)?.open === true);
    if (doneCount > 0 || anyOpen) return "in-progress";
    return "not-started";
  }
  return deriveFromRecords(story.records, states, story.carriedStatus);
}

/**
 * The one line's phase, derived — never freehand (§2). With tasks, it
 * is the phase of the earliest unfinished task. Without tasks (a
 * carried story), the curation file's † phase stands until the
 * breakdown replaces it. † Strings: spec §9.2, mockup default list.
 */
export function phaseLineFor(story: CurationStory, states: ReadonlyMap<number, RecordState>): string {
  if (story.tasks && story.tasks.length > 0) {
    const next = story.tasks.find((t) => !taskDone(t, states));
    if (!next) return "Ready to play";
    if (next.phase === "Still planning") return "Still planning";
    return `${next.phase} in progress`;
  }
  return story.phase ?? "Still planning";
}

/** The single line a story card shows (§4 anatomy). */
export function storyLine(
  status: BoardStatus,
  phaseLine: string,
  comingAfterTitle: string | null,
): string {
  if (status === "done") return "Ready to play";
  if (status === "in-progress") return phaseLine;
  if (comingAfterTitle) return `Coming after: ${comingAfterTitle}`;
  return "Not started yet";
}

export interface PublishedStory {
  slug: string;
  title: string;
  status: BoardStatus;
  line: string;
  /** Plain title of the story this one waits on, when that wait is unfinished. */
  comingAfter?: string;
}

export interface PublishedFeature {
  id: string;
  name: string;
  promise: string;
  anim: AnimKind;
  done: number;
  total: number;
  bonds: number;
  stories: PublishedStory[];
}

export interface PublishedEpic {
  id: string;
  name: string;
  color: string;
  features: PublishedFeature[];
}

export interface PublishedBond {
  fromSlug: string;
  toSlug: string;
  fromTitle: string;
  toTitle: string;
}

export interface PublishedBoard {
  version: 3;
  source: "generated" | "manual";
  updatedAt: string;
  counts: { done: number; inProgress: number; notStarted: number; total: number };
  epics: PublishedEpic[];
  bonds: PublishedBond[];
}

/**
 * Build the sanitised published file from the curation file. The
 * output shape is the contract: per story only slug/title/status/line,
 * per feature/epic only story rollups. No records, no source ids, no
 * tasks, no task counts — there is no field that could carry them.
 */
export function buildPublished(
  curation: Curation,
  states: ReadonlyMap<number, RecordState>,
  opts: { source: "generated" | "manual"; updatedAt: string },
): PublishedBoard {
  const bySourceId = new Map<string, CurationStory>();
  for (const epic of curation.epics)
    for (const feature of epic.features)
      for (const story of feature.stories) bySourceId.set(story.sourceId, story);

  const statusOf = new Map<string, BoardStatus>();
  for (const story of bySourceId.values()) statusOf.set(story.sourceId, storyStatus(story, states));

  const bonds: PublishedBond[] = curation.waits.map((w) => {
    const from = bySourceId.get(w.from);
    const to = bySourceId.get(w.to);
    if (!from || !to) throw new Error(`wait references unknown story: ${w.from} -> ${w.to}`);
    return { fromSlug: from.slug, toSlug: to.slug, fromTitle: from.title, toTitle: to.title };
  });

  const counts = { done: 0, inProgress: 0, notStarted: 0, total: 0 };
  const epics: PublishedEpic[] = curation.epics.map((epic) => ({
    id: epic.id,
    name: epic.name,
    color: epic.color,
    features: epic.features.map((feature) => {
      const stories: PublishedStory[] = feature.stories.map((story) => {
        const status = statusOf.get(story.sourceId)!;
        counts.total += 1;
        if (status === "done") counts.done += 1;
        else if (status === "in-progress") counts.inProgress += 1;
        else counts.notStarted += 1;
        // "Coming after" names the first recorded wait whose target is
        // not done yet — a bond in words, never "waitsOn".
        const wait = curation.waits.find(
          (w) => w.from === story.sourceId && statusOf.get(w.to) !== "done",
        );
        const comingAfter = wait ? bySourceId.get(wait.to)!.title : null;
        const derivedLine = storyLine(status, phaseLineFor(story, states), comingAfter);
        return {
          slug: story.slug,
          title: story.title,
          status,
          line:
            story.lineOverride && status !== "not-started" ? story.lineOverride : derivedLine,
          ...(comingAfter ? { comingAfter } : {}),
        };
      });
      const featureSlugs = new Set(feature.stories.map((s) => s.slug));
      return {
        id: feature.id,
        name: feature.name,
        promise: feature.promise,
        anim: feature.anim,
        done: stories.filter((s) => s.status === "done").length,
        total: stories.length,
        bonds: bonds.filter((b) => featureSlugs.has(b.fromSlug) || featureSlugs.has(b.toSlug)).length,
        stories,
      };
    }),
  }));

  return { version: 3, source: opts.source, updatedAt: opts.updatedAt, counts, epics, bonds };
}

/* ------------------------------------------------------------------ */
/* Banned-token scan — the readability law as a check (§4).            */
/* ------------------------------------------------------------------ */

const BANNED: { name: string; re: RegExp }[] = [
  { name: "PR reference", re: /\bPR\s?\d+\b|\bpull request/i },
  { name: "story id (lane/slug)", re: /\b[a-z]+(?:-[a-z0-9]+)+\/[a-z0-9]+(?:-[a-z0-9]+)+/ },
  { name: "file name", re: /\b[\w-]+\.(?:ts|tsx|js|jsx|mjs|json|md|css)\b/ },
  { name: "commit SHA", re: /\b[0-9a-f]{7,40}\b/ },
  { name: "waitsOn wording", re: /waits\s?on/i },
  { name: "Live from GitHub", re: /live from github/i },
  { name: "XP/points", re: /\bXP\b|\bpoints\b/i },
  { name: "team lane name", re: /infra and process|detective core|audio and clips/i },
];

/**
 * Scan any published-file-shaped value for banned content. Strings are
 * matched against the banned patterns; object KEYS are checked for
 * task/record fields (a numeric `tasks`/`records`/`taskCount` field is
 * how a private count would leak). Returns human-readable violations.
 */
export function scanBanned(value: unknown, path = "$"): string[] {
  const out: string[] = [];
  if (typeof value === "string") {
    for (const b of BANNED) if (b.re.test(value)) out.push(`${path}: ${b.name} in "${value.slice(0, 60)}"`);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => out.push(...scanBanned(v, `${path}[${i}]`)));
    return out;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/^(tasks?|records?|taskCount|prs)$/i.test(k)) out.push(`${path}.${k}: private field must not be published`);
      out.push(...scanBanned(v, `${path}.${k}`));
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Dev-language scan — board v4's player-words law as a check.         */
/*                                                                     */
/* The v4 rewrite (board-v4 sample README, the 46-row table) classes   */
/* of dev language that must never reach a published title or line:    */
/* "in code", a filename-like token (a file extension, or one of the   */
/* leaked voice-clip file names), builder-document/process words       */
/* (spec, registry, mockup, engine, channel, port, sign-off, release), */
/* and stage/version jargon. Only the player-visible fields are        */
/* scanned (titles, lines, comingAfter, bond titles, feature/epic      */
/* names and promises) — slugs are stable link keys, not words a       */
/* player reads, and are deliberately out of scope. The patterns are   */
/* precise enough to never match any of the 37 player titles/lines:    */
/* the unit tests prove this scan FAILS on the pre-v4 published        */
/* titles and passes on the v4 file.                                   */
/* ------------------------------------------------------------------ */

const DEV_LANGUAGE: { name: string; re: RegExp }[] = [
  { name: "in code", re: /\bin code\b/i },
  { name: "file name", re: /\b[\w-]+\.(?:ts|tsx|js|jsx|mjs|json|md|css)\b/ },
  { name: "clip file name", re: /\b(?:beat-me|win-together|truce-watson)\b/ },
  { name: "builder document/process word", re: /\bspecs?\b|\bregistry\b|\bmockup\b|\bsign-off\b|\brelease\b/i },
  { name: "dev jargon", re: /\bengine\b|\bchannel\b|\bport\b|\bart sheets\b|\bdolly\b|\bunrendered\b/i },
  { name: "source/stage file wording", re: /\bsource files\b|\bvideo files\b|\bstage\s+[a-z]\b/i },
  { name: "version jargon", re: /\(v\d/i },
  { name: "abbreviation", re: /\bGK\b/ },
];

/** Scan a published board's player-visible words for dev language. */
export function scanDevLanguage(board: PublishedBoard): string[] {
  const out: string[] = [];
  const check = (value: string | undefined, where: string) => {
    if (!value) return;
    for (const d of DEV_LANGUAGE)
      if (d.re.test(value)) out.push(`${where}: ${d.name} in "${value.slice(0, 60)}"`);
  };
  for (const epic of board.epics) {
    check(epic.name, `epic ${epic.id}`);
    for (const feature of epic.features) {
      check(feature.name, `feature ${feature.id}`);
      check(feature.promise, `feature ${feature.id} promise`);
      for (const story of feature.stories) {
        check(story.title, `story ${story.slug} title`);
        check(story.line, `story ${story.slug} line`);
        check(story.comingAfter, `story ${story.slug} comingAfter`);
      }
    }
  }
  for (const bond of board.bonds) {
    check(bond.fromTitle, `bond ${bond.fromSlug} fromTitle`);
    check(bond.toTitle, `bond ${bond.fromSlug} toTitle`);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Precomputed 3D layout (§3: shipped in the data, no runtime physics) */
/* ------------------------------------------------------------------ */

export interface BoardLayout {
  positions: Record<string, [number, number, number]>;
  featureCenters: Record<string, [number, number, number]>;
  featureRadii: Record<string, number>;
  epicCenters: Record<string, [number, number, number]>;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EPIC_CENTERS: Record<string, [number, number, number]> = {
  geodetective: [0, 2, 0],
  subjects: [22, 5, -4],
  journals: [-21, 8, -7],
  voices: [-11, -11, 7],
  behind: [14, -11, 8],
};

/** Deterministic layout, same construction as the owner-seen mockup. */
export function computeLayout(board: PublishedBoard): BoardLayout {
  const rand = mulberry32(46);
  const positions: BoardLayout["positions"] = {};
  const featureCenters: BoardLayout["featureCenters"] = {};
  const featureRadii: BoardLayout["featureRadii"] = {};
  const epicCenters: BoardLayout["epicCenters"] = {};
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (const epic of board.epics) {
    const ec = EPIC_CENTERS[epic.id] ?? [0, 0, 0];
    epicCenters[epic.id] = ec;
    epic.features.forEach((feature, fi) => {
      const nf = epic.features.length;
      const ang = (2 * Math.PI * fi) / Math.max(nf, 1) - Math.PI / 2;
      const dist = nf === 1 ? 0 : 8.5;
      const fc: [number, number, number] = [
        ec[0] + Math.cos(ang) * dist,
        ec[1] + Math.sin(ang) * dist * 0.7,
        ec[2] + Math.sin(ang) * 3.0,
      ];
      const n = feature.stories.length;
      const radius = 2.0 + 0.55 * n;
      featureCenters[feature.id] = fc.map((v) => Math.round(v * 100) / 100) as [number, number, number];
      featureRadii[feature.id] = Math.round(radius * 100) / 100;
      feature.stories.forEach((story, i) => {
        const y = 1 - (i / Math.max(n - 1, 1)) * 2;
        const rad = Math.sqrt(Math.max(0, 1 - y * y));
        const th = golden * i;
        const rr = radius * 0.66 * (1 - 0.125 + rand() * 0.25);
        positions[story.slug] = [
          Math.round((fc[0] + Math.cos(th) * rad * rr) * 100) / 100,
          Math.round((fc[1] + y * rr) * 100) / 100,
          Math.round((fc[2] + Math.sin(th) * rad * rr) * 100) / 100,
        ];
      });
    });
  }
  return { positions, featureCenters, featureRadii, epicCenters };
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
