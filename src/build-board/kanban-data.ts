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
 * The overlay rule: a subtask moves only FORWARD from its
 * snapshot column (Backlog = Blocked < In progress < In review
 * < Done). Signals are its pre-recorded `closes` PRs (Done only
 * when every one of them has merged) and `work` branches, plus
 * any live pull whose title or head branch carries the subtask
 * `num`, plus any live branch whose name carries that `num`.
 * `ref` PRs, `ref` branches and issues are context links — they
 * are never read as movement. Pull bodies are never read.
 *
 * TD-08.5 adds the PR number backfill: a checked-in map
 * (pr-number-map.ts) pins older PRs to the planning ids their
 * titles and branches never carried. The map wins over the
 * derived key, a multi-id PR chips onto each of its cards, and
 * an empty mapping keeps a PR Unnumbered even when its title
 * names another PR's id (the #612 / TD-06.3 clash).
 */
import { PR_NUMBER_MAP, mappedIdsFor } from "./pr-number-map.ts";

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
  /** Stable planning number, unique across stories and subtasks (e.g. "TD-01.1"). */
  num: string;
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
  /** Set by the overlay only: distinct `C:` labels from matched pulls. */
  seatTags?: string[];
}

export interface Story {
  id: string;
  /** Stable planning number, unique across stories and subtasks (e.g. "TD-01"). */
  num: string;
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
  /** Pull title, when the live check recorded one. */
  title?: string;
  /** Head branch name (`head.ref`), when the live check recorded one. */
  headRef?: string;
  /** Label names, when the live check recorded them. */
  labels?: string[];
}

/**
 * Subtask ids inside free text, normalized to uppercase and
 * de-duplicated. The boundary is strict: `TD-01.1` is not a hit
 * inside `TD-01.10`, and a story id such as `TD-08` is not a
 * subtask id.
 */
export function extractSubtaskNums(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /(?:^|[^a-z0-9])((?:TD|FW)-\d{2}\.\d+)(?=$|[^a-z0-9])/gi;
  for (const match of text.matchAll(re)) {
    const num = match[1].toUpperCase();
    if (seen.has(num)) continue;
    seen.add(num);
    out.push(num);
  }
  return out;
}

/**
 * Story numbers (`TD-08`, `FW-10`) that are not the prefix of a
 * subtask number. `TD-08.4` is a subtask, not story `TD-08`.
 */
export function extractStoryNums(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /(?:^|[^a-z0-9])((?:TD|FW)-\d{2})(?!\.\d)(?=$|[^a-z0-9])/gi;
  for (const match of text.matchAll(re)) {
    const num = match[1].toUpperCase();
    if (seen.has(num)) continue;
    seen.add(num);
    out.push(num);
  }
  return out;
}

/**
 * The item key in one string: the first subtask number, else the
 * first story number, else null. Callers try the PR title, then
 * `head.ref`, then the branch name — the first source that
 * returns a key wins.
 */
export function extractItemKey(text: string): string | null {
  return extractSubtaskNums(text)[0] ?? extractStoryNums(text)[0] ?? null;
}

/** A `C:blocked` label, or a plain `blocked` label. */
export function isBlockedLabel(label: string): boolean {
  const name = label.trim().toLowerCase();
  return name === "blocked" || name.startsWith("c:blocked");
}

/**
 * Column for one pull. The first matching rule wins:
 * blocked label, merged, open non-draft, open draft, else
 * closed-unmerged backlog.
 */
export function columnForPull(info: PullInfo): { col: Column; note?: string } {
  if ((info.labels ?? []).some(isBlockedLabel)) return { col: "Blocked" };
  if (info.merged) return { col: "Done" };
  if (info.state === "open" && !info.draft) return { col: "In review" };
  if (info.state === "open" && info.draft) return { col: "In progress" };
  return { col: "Backlog", note: "closed unmerged" };
}

/**
 * The standing of a whole card from ALL of its pulls at once.
 * One merged pull never outvotes an open one: Done needs the
 * whole set settled. Rules, in order:
 *  1. A `blocked` / `c:blocked*` label on any pull → Blocked.
 *  2. Closed-unmerged pulls are superseded: ignored while
 *     other pulls exist; when every pull is closed-unmerged
 *     → Backlog with the note "closed unmerged".
 *  3. Any open non-draft pull → In review; else any open
 *     draft pull → In progress.
 *  4. Done only with at least one merged pull and no open pull.
 */
export function standingForPulls(
  infos: readonly PullInfo[],
): { col: Column; note?: string } {
  if (infos.some((info) => (info.labels ?? []).some(isBlockedLabel))) {
    return { col: "Blocked" };
  }
  const open = infos.filter((info) => info.state === "open");
  if (open.some((info) => !info.draft)) return { col: "In review" };
  if (open.some((info) => info.draft)) return { col: "In progress" };
  if (infos.some((info) => info.merged)) return { col: "Done" };
  if (infos.length === 0) return { col: "Backlog" };
  return { col: "Backlog", note: "closed unmerged" };
}

/**
 * Lane for one card or census id. When a snapshot is passed it
 * wins: the exact story or subtask row, else the parent story
 * (`TD-06.9` → `TD-06` via `storyNumOf`). With no row and no
 * parent story — TD-08.x, a brand-new FW, an unnumbered card —
 * the heuristic stands: a TD number is tech-debt, an `arch-*`
 * name or phase work is architecture, and everything else,
 * including FW numbers, is product.
 */
export function laneForItem(
  num: string | null,
  texts: readonly string[],
  snapshot?: Snapshot | null,
): Lane {
  if (snapshot && num) {
    const key = num.toUpperCase();
    const exact = exactLane(snapshot, key);
    if (exact) return exact;
    const parent = storyNumOf(key);
    if (parent) {
      const inherited = exactLane(snapshot, parent);
      if (inherited) return inherited;
    }
  }
  if (num && /^TD-/i.test(num)) return "tech-debt";
  const blob = texts.join("\n");
  if (/(?:^|[^a-z0-9])arch-/i.test(blob) || /(?:^|[^a-z0-9])phase\d*/i.test(blob)) {
    return "architecture";
  }
  return "product";
}

/** The snapshot lane for this exact num, if the ledger has that row. */
function exactLane(snapshot: Snapshot, num: string): Lane | undefined {
  return (
    snapshot.stories.find((story) => story.num === num)?.lane ??
    snapshot.subtasks.find((sub) => sub.num === num)?.lane
  );
}

/** One card derived from pulls and branches. GitHub is the only source. */
export interface DerivedCard {
  id: string;
  /** TD or story number, or null for the Unnumbered group. */
  num: string | null;
  title: string;
  lane: Lane;
  col: Column;
  note?: string;
  prs: PrLink[];
  seatTags: string[];
  unnumbered: boolean;
}

const LIVE_PR_HREF = "https://github.com/veeresh-bikkaneti/Meridian/pull/";
/** An open GitHub issue with the `bug` label, from the live check. */
export interface IssueInfo {
  number: number;
  title: string;
  htmlUrl: string;
  /** Label names, when the live check recorded them. */
  labels?: string[];
}

/** A live bug card: an open `bug` issue, filed under the product lane. */
export interface BugCard {
  issue: IssueInfo;
  col: Column;
  lane: Lane;
  /** Open pull numbers whose title or head ref mentions this issue. */
  linkedPrs: number[];
}

/**
 * Bug cards for the live board. A bug is Backlog until an OPEN
 * pull's title or head ref mentions `#N` — then it is In
 * progress. A merged pull that only says "Refs #N" does not
 * move it: the bug is still open. A bug the ledger already
 * links still gets its own card; the ledger row keeps its chip.
 * Bugs never join the story/task census.
 */
export function deriveBugCards(
  issues: ReadonlyMap<number, IssueInfo>,
  pulls: ReadonlyMap<number, PullInfo>,
): BugCard[] {
  const cards: BugCard[] = [];
  for (const issue of issues.values()) {
    const mention = new RegExp(`(?:^|[^0-9])#${issue.number}(?!\\d)`);
    const linkedPrs: number[] = [];
    for (const [number, info] of pulls) {
      if (info.state !== "open") continue;
      if (mention.test(info.title ?? "") || mention.test(info.headRef ?? "")) {
        linkedPrs.push(number);
      }
    }
    cards.push({
      issue,
      col: linkedPrs.length > 0 ? "In progress" : "Backlog",
      lane: "product",
      linkedPrs,
    });
  }
  cards.sort((a, b) => a.issue.number - b.issue.number);
  return cards;
}

const LIVE_ISSUE_HREF = "https://github.com/veeresh-bikkaneti/Meridian/issues/";

/**
 * The `html_url` of an issue row, or the issue URL built from
 * its number when the row carries none.
 */
export function issueHtmlUrl(number: number, htmlUrl: unknown): string {
  return typeof htmlUrl === "string" && htmlUrl.length > 0
    ? htmlUrl
    : `${LIVE_ISSUE_HREF}${number}`;
}

interface DerivedAcc {
  id: string;
  num: string | null;
  title: string;
  texts: string[];
  pullInfos: PullInfo[];
  prs: PrLink[];
  seatTags: string[];
  unnumbered: boolean;
}

function takeSeatTags(acc: DerivedAcc, labels: string[] | undefined): void {
  for (const tag of storySeatTags([{ seatTags: labels ?? [] }])) {
    if (!acc.seatTags.includes(tag)) acc.seatTags.push(tag);
  }
}

/**
 * Build the board from the pull list (newest first) and the
 * branch set. Pulls and branches with no TD or story number land
 * in the Unnumbered group — they are never dropped. Several pulls
 * for one number keep the most advanced column (`columnRank`);
 * every pull number is kept as a chip. The title is the newest
 * pull's title, else the branch name. Pass the snapshot so a
 * card takes the ledger lane (or its parent story's lane)
 * instead of the TD heuristic.
 */
/** The repo's default branch; never a card of its own. */
const DEFAULT_BRANCH = "main";

export function deriveBoardItems(
  pulls: ReadonlyMap<number, PullInfo>,
  branches: ReadonlySet<string>,
  snapshot: Snapshot | null = null,
): DerivedCard[] {
  const byKey = new Map<string, DerivedAcc>();
  const headRefs = new Set<string>();

  for (const [number, info] of pulls) {
    if (info.headRef) headRefs.add(info.headRef);
    /* The backfill map wins over the derived key. An empty
     * mapping is a deliberate exclusion: the pull stays
     * Unnumbered even when its title names another PR's id. A
     * multi-id pull contributes its chip and standing to each
     * of its cards. */
    const mapped = mappedIdsFor(number);
    const keys: readonly string[] | null =
      mapped !== undefined
        ? mapped.length > 0
          ? mapped
          : null
        : (() => {
            const key = extractItemKey(info.title ?? "") ?? extractItemKey(info.headRef ?? "");
            return key ? [key] : null;
          })();
    const ids = keys ?? [`unnumbered:pr:${number}`];
    for (const id of ids) {
      const key = keys ? id : null;
      let acc = byKey.get(id);
      if (!acc) {
        const title = info.title?.trim() || info.headRef || `PR #${number}`;
        acc = {
          id,
          num: key,
          title,
          texts: [],
          pullInfos: [],
          prs: [],
          seatTags: [],
          unnumbered: key === null,
        };
        byKey.set(id, acc);
      }
      if (info.title) acc.texts.push(info.title);
      if (info.headRef) acc.texts.push(info.headRef);
      acc.prs.push({ number, role: "closes", href: `${LIVE_PR_HREF}${number}` });
      acc.pullInfos.push(info);
      takeSeatTags(acc, info.labels);
    }
  }

  for (const name of branches) {
    // The default branch is the trunk, not a piece of work.
    if (headRefs.has(name) || name === DEFAULT_BRANCH) continue;
    const key = extractItemKey(name);
    if (key && byKey.has(key)) {
      byKey.get(key)?.texts.push(name);
      continue;
    }
    if (key) {
      byKey.set(key, {
        id: key,
        num: key,
        title: name,
        texts: [name],
        pullInfos: [],
        prs: [],
        seatTags: [],
        unnumbered: false,
      });
      continue;
    }
    const id = `unnumbered:branch:${name}`;
    if (byKey.has(id)) continue;
    byKey.set(id, {
      id,
      num: null,
      title: name,
      texts: [name],
      pullInfos: [],
      prs: [],
      seatTags: [],
      unnumbered: true,
    });
  }

  return [...byKey.values()].map((acc) => {
    // A card with pulls takes the whole-set standing; a
    // branch-only card is work in flight, In progress.
    const standing =
      acc.pullInfos.length > 0
        ? standingForPulls(acc.pullInfos)
        : { col: "In progress" as Column };
    const card: DerivedCard = {
      id: acc.id,
      num: acc.num,
      title: acc.title,
      lane: laneForItem(acc.num, acc.texts, snapshot),
      col: standing.col,
      prs: acc.prs,
      seatTags: acc.seatTags,
      unnumbered: acc.unnumbered,
    };
    if (standing.note && standing.col === "Backlog") card.note = standing.note;
    return card;
  });
}

/** `num` is a non-empty string, unique across stories and subtasks together. */
function claimNum(
  item: { id?: string; num?: unknown },
  kind: "story" | "subtask",
  seen: Set<string>,
): void {
  const id = typeof item?.id === "string" && item.id.length > 0 ? item.id : "?";
  if (typeof item?.num !== "string" || item.num.length === 0) {
    throw new Error(`kanban snapshot: ${kind} "${id}" has no non-empty string num`);
  }
  if (seen.has(item.num)) {
    throw new Error(`kanban snapshot: duplicate num "${item.num}"`);
  }
  seen.add(item.num);
}

/**
 * Validate an unknown payload as a v2 board snapshot. Throws on
 * the wrong story/subtask counts, duplicate ids, a missing or
 * duplicate `num`, a subtask that sits in zero or two stories,
 * a dangling dependsOn, or a malformed envelope — the board
 * would rather fail loudly than render a half-empty picture of
 * the work.
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
  if (!Array.isArray(data.stories)) {
    throw new Error("kanban snapshot: stories must be an array");
  }
  if (!Array.isArray(data.subtasks)) {
    throw new Error("kanban snapshot: subtasks must be an array");
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
  const nums = new Set<string>();
  for (const story of stories) {
    if (typeof story?.id !== "string" || story.id.length === 0) {
      throw new Error("kanban snapshot: a story has no non-empty string id");
    }
    if (storyIds.has(story.id)) throw new Error(`kanban snapshot: duplicate story id "${story.id}"`);
    storyIds.add(story.id);
    claimNum(story, "story", nums);
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
    claimNum(sub, "subtask", nums);
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
 * The live standing one subtask's GitHub evidence proves, or
 * null when it proves nothing. Recorded `closes` PRs are read
 * as one set — only when EVERY one of them was fetched: a
 * partial answer proves nothing (the live module fetches every
 * needed number, so a gap means the PR could not be read).
 * Numbered pulls that are not `ref` links join the same set,
 * so one merged pull never outvotes an open one. A live work
 * branch (recorded, or a live branch carrying the number)
 * proves work started: it lifts an all-closed-unmerged
 * standing to In progress, and nothing else.
 */
function liveStanding(
  sub: Subtask,
  pulls: ReadonlyMap<number, PullInfo>,
  branches: ReadonlySet<string>,
  byPull: ReadonlyMap<string, [number, PullInfo][]>,
  byBranch: ReadonlyMap<string, string[]>,
): { col: Column | null; note?: string } {
  const closes = sub.prs.filter((p) => p.role === "closes");
  const closesComplete = closes.every((p) => pulls.has(p.number));
  const recordedInfos = closesComplete
    ? closes.map((p) => pulls.get(p.number) as PullInfo)
    : [];
  const closeNumbers = new Set(closes.map((p) => p.number));
  const autoInfos = autoPullsFor(sub, byPull)
    .filter(([number]) => !closeNumbers.has(number))
    .map(([, info]) => info);
  const branchEvidence =
    autoBranchesFor(sub, byBranch).length > 0 || recordedWorkBranchExists(sub, branches);
  const infos = [...recordedInfos, ...autoInfos];
  if (infos.length === 0) {
    return branchEvidence ? { col: "In progress" } : { col: null };
  }
  const standing = standingForPulls(infos);
  if (standing.col === "Backlog" && branchEvidence) return { col: "In progress" };
  return standing;
}

/** A recorded `work` branch exists in the live branch set. */
function recordedWorkBranchExists(sub: Subtask, branches: ReadonlySet<string>): boolean {
  for (const branch of sub.branches) {
    if (branch.role !== "work") continue;
    const exists =
      branch.match === "prefix"
        ? [...branches].some((name) => name.startsWith(branch.name))
        : branches.has(branch.name);
    if (exists) return true;
  }
  return false;
}

function indexPulls(pulls: ReadonlyMap<number, PullInfo>): Map<string, [number, PullInfo][]> {
  const byNum = new Map<string, [number, PullInfo][]>();
  for (const entry of pulls) {
    const info = entry[1];
    /* A mapped pull indexes under its mapped subtask ids only:
     * #614's head.ref says td-10.1, but the map pins it to
     * TD-10.5, so it must never auto-attach to TD-10.1's row. */
    const mapped = mappedIdsFor(entry[0]);
    const nums = new Set<string>(
      mapped !== undefined
        ? mapped.filter((id) => extractSubtaskNums(id).length > 0)
        : [
            ...extractSubtaskNums(info.title ?? ""),
            ...extractSubtaskNums(info.headRef ?? ""),
          ],
    );
    for (const num of nums) {
      const list = byNum.get(num);
      if (list) list.push(entry);
      else byNum.set(num, [entry]);
    }
  }
  return byNum;
}

function indexBranches(branches: ReadonlySet<string>): Map<string, string[]> {
  const byNum = new Map<string, string[]>();
  for (const name of branches) {
    for (const num of extractSubtaskNums(name)) {
      const list = byNum.get(num);
      if (list) list.push(name);
      else byNum.set(num, [name]);
    }
  }
  return byNum;
}

function autoPullsFor(
  sub: Subtask,
  byPull: ReadonlyMap<string, [number, PullInfo][]>,
): [number, PullInfo][] {
  const refs = new Set(sub.prs.filter((p) => p.role === "ref").map((p) => p.number));
  return (byPull.get(sub.num.toUpperCase()) ?? []).filter(([number]) => !refs.has(number));
}

function isRefBranch(sub: Subtask, name: string): boolean {
  const lower = name.toLowerCase();
  return sub.branches.some((b) => b.role === "ref" && b.name.toLowerCase() === lower);
}

function autoBranchesFor(
  sub: Subtask,
  byBranch: ReadonlyMap<string, string[]>,
): string[] {
  return (byBranch.get(sub.num.toUpperCase()) ?? []).filter((name) => !isRefBranch(sub, name));
}

function enrichPrs(sub: Subtask, matched: readonly [number, PullInfo][]): PrLink[] {
  const seen = new Set(sub.prs.map((p) => p.number));
  const extra: PrLink[] = [];
  for (const [number] of matched) {
    if (seen.has(number)) continue;
    seen.add(number);
    extra.push({ number, role: "closes", href: `${LIVE_PR_HREF}${number}` });
  }
  return extra.length === 0 ? sub.prs : [...sub.prs, ...extra];
}

function seatTagsFor(
  sub: Subtask,
  pulls: ReadonlyMap<number, PullInfo>,
  matched: readonly [number, PullInfo][],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const take = (info: PullInfo | undefined) => {
    for (const label of info?.labels ?? []) {
      if (!label.startsWith("C:") || seen.has(label)) continue;
      seen.add(label);
      out.push(label);
    }
  };
  for (const pr of sub.prs) {
    if (pr.role !== "closes") continue;
    take(pulls.get(pr.number));
  }
  for (const [, info] of matched) take(info);
  return out;
}

/**
 * Apply live GitHub state to snapshot subtasks. The live column
 * replaces the snapshot column only when it ranks higher —
 * forward only, so an open draft PR never pulls an In review
 * subtask back to In progress. A closed-unmerged closes PR
 * keeps the column and leaves the "closed unmerged" note.
 * Newly numbered pulls are appended as `closes` links (existing
 * numbers are left as recorded). Inputs are not mutated.
 */
export function applyOverlay<T extends Subtask>(
  subtasks: readonly T[],
  pulls: ReadonlyMap<number, PullInfo>,
  branches: ReadonlySet<string>,
): T[] {
  const byPull = indexPulls(pulls);
  const byBranch = indexBranches(branches);
  return subtasks.map((sub) => {
    const live = liveStanding(sub, pulls, branches, byPull, byBranch);
    const col =
      live.col !== null && columnRank(live.col) > columnRank(sub.col) ? live.col : sub.col;
    const matched = autoPullsFor(sub, byPull);
    const seatTags = seatTagsFor(sub, pulls, matched);
    const next: T = { ...sub, col, note: live.note, prs: enrichPrs(sub, matched) };
    if (seatTags.length > 0) next.seatTags = seatTags;
    return next;
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

/** Distinct `C:` seat tags across a story's subtasks, first-seen order. */
export function storySeatTags(subtasks: readonly Pick<Subtask, "seatTags">[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sub of subtasks) {
    for (const tag of sub.seatTags ?? []) {
      if (!tag.startsWith("C:") || seen.has(tag)) continue;
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
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

/** The story-level id inside a subtask id (`TD-01.1` → `TD-01`), else null. */
export function storyNumOf(num: string): string | null {
  const match = /^((?:TD|FW)-\d{2})\.\d+$/i.exec(num);
  return match ? match[1].toUpperCase() : null;
}

export interface LaneCensus {
  /** Unique story-level ids (TD-01, FW-08, …). */
  stories: number;
  /** Unique subtask ids (TD-01.1, TD-06.5, …). */
  tasks: number;
  /** Live cards with no number — neither a story nor a task. */
  unnumbered: number;
}

/**
 * The live census: story and task counts for the lane segment,
 * counted separately over the UNION of the checked-in ledger,
 * the PR number map and the live derived cards — never just the
 * length of the 100-PR window, which silently capped both
 * numbers at the window size. A live or mapped id the stale
 * ledger lacks (TD-06.5, TD-08.1, TD-10.5) still counts, and a
 * ledger id whose PR has fallen out of the window counts too.
 * Lane assignment is the cards' rule (`laneForItem`): the
 * snapshot row, else the parent story, else the heuristic.
 * A live card is filed first, so the lane on that card is the
 * one the tab counts. Unnumbered live cards count in neither
 * figure; they are reported separately.
 */
export function boardCensus(
  snapshot: Snapshot,
  items: readonly DerivedCard[],
): Record<Lane | "all", LaneCensus> {
  const storyLane = new Map<string, Lane>();
  const taskLane = new Map<string, Lane>();
  const add = (num: string, lane: Lane) => {
    const story = storyNumOf(num);
    if (!story) {
      if (!storyLane.has(num)) storyLane.set(num, lane);
      return;
    }
    if (!taskLane.has(num)) taskLane.set(num, lane);
    if (!storyLane.has(story)) storyLane.set(story, lane);
  };
  // Live cards first, so an id the window holds takes the exact
  // lane its card is filed under.
  let unnumbered = 0;
  const unnumberedByLane: Record<Lane, number> = {
    "tech-debt": 0,
    architecture: 0,
    product: 0,
  };
  for (const item of items) {
    if (item.unnumbered || !item.num) {
      unnumbered += 1;
      unnumberedByLane[item.lane] += 1;
      continue;
    }
    add(item.num, item.lane);
  }
  // Ledger and map ids use the same rule as the cards.
  for (const story of snapshot.stories) add(story.num, laneForItem(story.num, [], snapshot));
  for (const sub of snapshot.subtasks) add(sub.num, laneForItem(sub.num, [], snapshot));
  for (const row of PR_NUMBER_MAP) {
    for (const id of row.ids) add(id, laneForItem(id, [], snapshot));
  }
  const census = {} as Record<Lane | "all", LaneCensus>;
  const lanes: Lane[] = ["tech-debt", "architecture", "product"];
  for (const lane of lanes) {
    census[lane] = {
      stories: [...storyLane.values()].filter((l) => l === lane).length,
      tasks: [...taskLane.values()].filter((l) => l === lane).length,
      unnumbered: unnumberedByLane[lane],
    };
  }
  census.all = { stories: storyLane.size, tasks: taskLane.size, unnumbered };
  return census;
}
