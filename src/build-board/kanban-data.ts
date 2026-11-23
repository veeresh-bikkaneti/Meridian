/**
 * Build-board data, schema v2: stories with subtasks.
 *
 * A STORY is the card on the board; a SUBTASK is one work item
 * inside it (the 45 handover items). Subtasks never render as
 * top-level cards. This module owns the snapshot shape and its
 * validation, the live-overlay rule, the story rollup and the
 * free-to-claim view — all pure, no fetching: kanban-live feeds
 * GitHub state in and the view renders what comes out, so every
 * rule is testable without a network.
 *
 * The overlay rule (SCHEMA.md, "Live overlay rule"): only a
 * subtask's `closes` PRs and `work` branches may move it, and
 * only FORWARD from its snapshot column (Backlog = Blocked <
 * In progress < In review < Done). `ref` PRs, `ref` branches
 * and issues are context links — they are never read here.
 * Round 1's rule (any linked merged PR = Done) marked 18
 * subtasks Done where the truth is 11, because the flat v1
 * card mixed "the PR that finishes this" with "the PR that
 * created this debt"; v2 separates them with `role`.
 */

export type Lane = "tech-debt" | "architecture" | "product";

export type Column = "Backlog" | "Blocked" | "In progress" | "In review" | "Done";

export const COLUMNS: Column[] = ["Backlog", "Blocked", "In progress", "In review", "Done"];

/** Forward-only ranking: a live column must outrank the snapshot's. */
export function columnRank(col: Column): number {
  switch (col) {
    case "Backlog":
    case "Blocked":
      return 0;
    case "In progress":
      return 1;
    case "In review":
      return 2;
    case "Done":
      return 3;
  }
}

export interface PrLink {
  number: number;
  /** "closes": merging it completes the subtask. "ref": context only. */
  role: "closes" | "ref";
  href: string;
}

export interface IssueLink {
  number: number;
  href: string;
}

export interface BranchLink {
  name: string;
  /** "work": the planned branch — if it exists, work has started.
   * "ref": a parked or protected branch; never moves a card. */
  role: "work" | "ref";
  /** "prefix": any branch starting with `name` counts. */
  match: "exact" | "prefix";
  href: string | null;
}

export type OwnsStatus = "known" | "partial" | "unknown" | "none";

export interface Subtask {
  id: string;
  story: string;
  lane: Lane;
  title: string;
  /** Verified snapshot column; the overlay returns subtasks with this moved. */
  col: Column;
  phase: string | null;
  /** Handover prompt number ("01".."09"), or null. */
  prompt: string | null;
  owner: string;
  /** Repo paths the work edits; a trailing "/" means a folder. */
  owns: string[];
  ownsStatus: OwnsStatus;
  ownsNote: string | null;
  /** Subtask ids that must be Done first. */
  dependsOn: string[];
  /** Human text for a blocker that isn't a card, or null. */
  blockedBy: string | null;
  /** A step needed before code, but not a blocker, or null. */
  gate: string | null;
  prs: PrLink[];
  issues: IssueLink[];
  branches: BranchLink[];
  evidence: string;
  /** Traceability to the v1 card this subtask came from. */
  v1: { index: number; id: string; title: string; dep: string };
  /** Set by the overlay only, e.g. when a closes PR closes unmerged. */
  note?: string;
}

export interface Story {
  id: string;
  lane: Lane;
  title: string;
  phase: string | null;
  why: string;
  prompts: string[];
  /** Ordered subtask ids. */
  subtasks: string[];
  /** Snapshot copy of the rollup — recompute with storyRollup, never trust this. */
  rollup: { col: Column; done: number; total: number };
}

export interface GaugeInfo {
  label: string;
  start: number;
  startRef: string;
  now: number;
  target: number;
}

export type GaugeKey = "noRawIo" | "noUpwardImport" | "shellBan";

export interface Snapshot {
  schemaVersion: 2;
  asOf: string;
  mainSha: string;
  /**
   * When the per-deploy public file was written (ISO stamp,
   * added by scripts/board/publish-kanban.mjs). Only the public
   * snapshot carries it; the bundled kanban.json does not. The
   * view's stamp uses it to say which snapshot is showing.
   */
  builtAt?: string;
  columns: Column[];
  lanes: { id: Lane; label: string }[];
  /** Per-gauge {label, start, now, target} — the gauges component reads this. */
  gaugeInfo: Record<GaugeKey, GaugeInfo>;
  /** Shared hot files the free-to-claim overlap check ignores. */
  hotFiles: string[];
  stories: Story[];
  subtasks: Subtask[];
}

/** The slice of a GitHub pull the overlay rules read. */
export interface PullInfo {
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
}

export const EXPECTED_STORY_COUNT = 18;
export const EXPECTED_SUBTASK_COUNT = 45;

/**
 * Validate an unknown payload as a v2 board snapshot. Throws on
 * the wrong story/subtask counts, duplicate ids, a subtask that
 * sits in zero or two stories, a dangling dependsOn, or a
 * malformed envelope — the board would rather fail loudly than
 * render a half-empty picture of the work.
 */
export function loadSnapshot(json: unknown): Snapshot {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error("kanban snapshot: top level is not an object");
  }
  const data = json as Record<string, unknown>;
  if (data.schemaVersion !== 2) {
    throw new Error("kanban snapshot: schemaVersion must be 2");
  }
  if (typeof data.asOf !== "string" || data.asOf.length === 0) {
    throw new Error("kanban snapshot: asOf must be a non-empty string");
  }
  if (typeof data.mainSha !== "string" || data.mainSha.length === 0) {
    throw new Error("kanban snapshot: mainSha must be a non-empty string");
  }
  if (!Array.isArray(data.stories) || data.stories.length !== EXPECTED_STORY_COUNT) {
    throw new Error(
      `kanban snapshot: expected ${EXPECTED_STORY_COUNT} stories, got ${
        Array.isArray(data.stories) ? data.stories.length : "none"
      }`,
    );
  }
  if (!Array.isArray(data.subtasks) || data.subtasks.length !== EXPECTED_SUBTASK_COUNT) {
    throw new Error(
      `kanban snapshot: expected ${EXPECTED_SUBTASK_COUNT} subtasks, got ${
        Array.isArray(data.subtasks) ? data.subtasks.length : "none"
      }`,
    );
  }
  const gaugesRaw = data.gauges as Record<string, Partial<GaugeInfo>> | undefined;
  if (typeof gaugesRaw !== "object" || gaugesRaw === null) {
    throw new Error("kanban snapshot: gauges missing");
  }
  const gaugeInfo = {} as Record<GaugeKey, GaugeInfo>;
  for (const key of ["noRawIo", "noUpwardImport", "shellBan"] as const) {
    const g = gaugesRaw[key];
    if (
      typeof g !== "object" || g === null ||
      typeof g.now !== "number" || typeof g.start !== "number" || typeof g.target !== "number"
    ) {
      throw new Error(`kanban snapshot: gauges.${key} must carry numeric start/now/target`);
    }
    gaugeInfo[key] = g as GaugeInfo;
  }
  if (!Array.isArray(data.hotFiles) || !data.hotFiles.every((h) => typeof h === "string")) {
    throw new Error("kanban snapshot: hotFiles must be an array of strings");
  }

  const stories = data.stories as Story[];
  const subtasks = data.subtasks as Subtask[];
  const storyIds = new Set<string>();
  for (const story of stories) {
    if (typeof story?.id !== "string" || story.id.length === 0) {
      throw new Error("kanban snapshot: a story has no non-empty string id");
    }
    if (storyIds.has(story.id)) throw new Error(`kanban snapshot: duplicate story id "${story.id}"`);
    storyIds.add(story.id);
  }
  const subtaskIds = new Set<string>();
  for (const sub of subtasks) {
    if (typeof sub?.id !== "string" || sub.id.length === 0) {
      throw new Error("kanban snapshot: a subtask has no non-empty string id");
    }
    if (subtaskIds.has(sub.id)) {
      throw new Error(`kanban snapshot: duplicate subtask id "${sub.id}"`);
    }
    subtaskIds.add(sub.id);
    if (!COLUMNS.includes(sub.col)) {
      throw new Error(`kanban snapshot: subtask "${sub.id}" has unknown column "${sub.col}"`);
    }
    for (const dep of sub.dependsOn ?? []) {
      if (!subtaskIds.has(dep) && !subtasks.some((s) => s.id === dep)) {
        throw new Error(`kanban snapshot: subtask "${sub.id}" depends on unknown "${dep}"`);
      }
    }
  }
  // Every subtask in exactly one story, and the story it names
  // is the story that lists it.
  const membership = new Map<string, number>();
  for (const story of stories) {
    for (const id of story.subtasks) {
      if (!subtaskIds.has(id)) {
        throw new Error(`kanban snapshot: story "${story.id}" lists unknown subtask "${id}"`);
      }
      membership.set(id, (membership.get(id) ?? 0) + 1);
    }
  }
  for (const sub of subtasks) {
    if (membership.get(sub.id) !== 1) {
      throw new Error(
        `kanban snapshot: subtask "${sub.id}" sits in ${membership.get(sub.id) ?? 0} stories`,
      );
    }
    if (!storyIds.has(sub.story)) {
      throw new Error(`kanban snapshot: subtask "${sub.id}" names unknown story "${sub.story}"`);
    }
  }

  return {
    schemaVersion: 2,
    asOf: data.asOf,
    mainSha: data.mainSha,
    ...(typeof data.builtAt === "string" && data.builtAt.length > 0
      ? { builtAt: data.builtAt }
      : {}),
    columns: (data.columns as Column[]) ?? [...COLUMNS],
    lanes: (data.lanes as Snapshot["lanes"]) ?? [],
    gaugeInfo,
    hotFiles: data.hotFiles,
    stories,
    subtasks,
  };
}

/**
 * The live column one subtask's GitHub state proves, before the
 * forward-only clamp — or null when it proves nothing. PRs are
 * read first, and only when EVERY closes PR was fetched: a
 * partial answer proves nothing (the live module fetches every
 * needed number, so a gap means the PR could not be read).
 */
function liveColumnFor(
  sub: Subtask,
  pulls: ReadonlyMap<number, PullInfo>,
  branches: ReadonlySet<string>,
): { col: Column | null; note?: string } {
  const closes = sub.prs.filter((p) => p.role === "closes");
  if (closes.length > 0 && closes.every((p) => pulls.has(p.number))) {
    const infos = closes.map((p) => pulls.get(p.number) as PullInfo);
    if (infos.every((i) => i.merged)) return { col: "Done" };
    if (infos.some((i) => i.state === "open" && !i.draft)) return { col: "In review" };
    if (infos.some((i) => i.state === "open" && i.draft)) return { col: "In progress" };
    if (infos.some((i) => i.state === "closed" && !i.merged)) {
      return { col: null, note: "closed unmerged" };
    }
    return { col: null };
  }
  for (const branch of sub.branches) {
    if (branch.role !== "work") continue;
    const exists =
      branch.match === "prefix"
        ? [...branches].some((name) => name.startsWith(branch.name))
        : branches.has(branch.name);
    if (exists) return { col: "In progress" };
  }
  return { col: null };
}

/**
 * Apply live GitHub state to snapshot subtasks. The live column
 * replaces the snapshot column only when it ranks higher —
 * forward only, so an open draft PR never pulls an In review
 * subtask back to In progress. A closed-unmerged closes PR
 * keeps the column and leaves the "closed unmerged" note.
 * Inputs are not mutated.
 */
export function applyOverlay<T extends Subtask>(
  subtasks: readonly T[],
  pulls: ReadonlyMap<number, PullInfo>,
  branches: ReadonlySet<string>,
): T[] {
  return subtasks.map((sub) => {
    const live = liveColumnFor(sub, pulls, branches);
    const col =
      live.col !== null && columnRank(live.col) > columnRank(sub.col) ? live.col : sub.col;
    return { ...sub, col, note: live.note };
  });
}

/**
 * A story's column from its subtasks' columns, in rule order:
 * all Done → Done; any In review → In review; any In progress →
 * In progress; any Backlog → Backlog; otherwise Blocked. Also
 * returns the done share the card shows as "4/7 done".
 */
export function storyRollup(
  story: Pick<Story, "subtasks">,
  subtasksById: ReadonlyMap<string, Subtask>,
): { col: Column; done: number; total: number } {
  const cols: Column[] = [];
  let done = 0;
  for (const id of story.subtasks) {
    const sub = subtasksById.get(id);
    if (!sub) throw new Error(`kanban rollup: unknown subtask "${id}"`);
    cols.push(sub.col);
    if (sub.col === "Done") done += 1;
  }
  const col: Column = cols.every((c) => c === "Done")
    ? "Done"
    : cols.includes("In review")
      ? "In review"
      : cols.includes("In progress")
        ? "In progress"
        : cols.includes("Backlog")
          ? "Backlog"
          : "Blocked";
  return { col, done, total: cols.length };
}

/** Two owned paths clash when equal, or when one is a directory of the other. */
function ownsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  return longer.startsWith(`${shorter.replace(/\/$/, "")}/`);
}

/**
 * Subtasks an agent can pick up now: snapshot column Backlog,
 * every dependency Done, and no owned path (hotFiles excluded —
 * every branch touches those by design) overlapping an
 * In progress or In review subtask's owns, so two claimed
 * subtasks are never editing the same ground.
 */
export function freeToClaim<T extends Subtask>(
  subtasks: readonly T[],
  hotFiles: readonly string[] = [],
): T[] {
  const hot = new Set(hotFiles);
  const byId = new Map(subtasks.map((s) => [s.id, s]));
  const busyOwns = subtasks
    .filter((s) => s.col === "In progress" || s.col === "In review")
    .flatMap((s) => s.owns.filter((p) => !hot.has(p)));
  return subtasks.filter((sub) => {
    if (sub.col !== "Backlog") return false;
    if (!sub.dependsOn.every((id) => byId.get(id)?.col === "Done")) return false;
    return !sub.owns
      .filter((p) => !hot.has(p))
      .some((path) => busyOwns.some((busy) => ownsOverlap(path, busy)));
  });
}

/** Subtask totals per lane, every lane present (the filter row's counts). */
export function laneCounts<T extends { lane: Lane }>(
  items: readonly T[],
): Record<Lane, number> {
  const counts: Record<Lane, number> = { "tech-debt": 0, architecture: 0, product: 0 };
  for (const item of items) counts[item.lane] += 1;
  return counts;
}
