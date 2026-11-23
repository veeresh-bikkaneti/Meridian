/**
 * Build-board data: the snapshot shape, the live-overlay rules and the
 * pure views over the cards (lane counts, free-to-claim). No fetching
 * lives here — the view feeds GitHub state in and renders what comes
 * out, so every rule is testable without a network.
 */

export type Lane = "tech-debt" | "architecture" | "product";

export type Column = "Backlog" | "Blocked" | "In progress" | "In review" | "Done";

export const COLUMNS: Column[] = ["Backlog", "Blocked", "In progress", "In review", "Done"];

export interface CardLink {
  label: string;
  href: string;
}

export interface Card {
  id: string;
  title: string;
  lane: Lane;
  /** The lane's display string; the only ownership signal in the seed. */
  owner: string;
  /** Handover prompt number ("01".."09"), or null when the source names none. */
  prompt: string | null;
  /** Snapshot column; the overlay returns cards with this moved. */
  col: Column;
  pr: number | null;
  branch: string | null;
  owns: string[];
  /** Card ids this card waits on (curated; the seed leaves it empty). */
  dependsOn: string[];
  /** For Blocked cards, the ruling or wait from the source prose. */
  blockedBy: string | null;
  depText: string;
  evidence: string;
  links: CardLink[];
  /** Set by the overlay only, e.g. when a PR closes unmerged. */
  note?: string;
}

export interface Gauges {
  noRawIo: number;
  noUpwardImport: number;
  shellBan: number;
}

export interface Snapshot {
  asOf: string;
  gauges: Gauges;
  cards: Card[];
}

/** The slice of a GitHub pull the overlay rules read. */
export interface PullInfo {
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
}

export const EXPECTED_CARD_COUNT = 45;

/**
 * Validate an unknown payload as a board snapshot. Throws on the wrong
 * card count, duplicate ids, or a malformed envelope — the board would
 * rather fail loudly than render a half-empty picture of the work.
 */
export function loadSnapshot(json: unknown): Snapshot {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error("kanban snapshot: top level is not an object");
  }
  const data = json as Partial<Snapshot>;
  if (typeof data.asOf !== "string" || data.asOf.length === 0) {
    throw new Error("kanban snapshot: asOf must be a non-empty string");
  }
  if (typeof data.gauges !== "object" || data.gauges === null) {
    throw new Error("kanban snapshot: gauges missing");
  }
  for (const key of ["noRawIo", "noUpwardImport", "shellBan"] as const) {
    if (typeof data.gauges[key] !== "number") {
      throw new Error(`kanban snapshot: gauges.${key} must be a number`);
    }
  }
  if (!Array.isArray(data.cards)) {
    throw new Error("kanban snapshot: cards must be an array");
  }
  if (data.cards.length !== EXPECTED_CARD_COUNT) {
    throw new Error(
      `kanban snapshot: expected ${EXPECTED_CARD_COUNT} cards, got ${data.cards.length}`,
    );
  }
  const ids = new Set<string>();
  for (const card of data.cards) {
    if (typeof card?.id !== "string" || card.id.length === 0) {
      throw new Error("kanban snapshot: a card has no non-empty string id");
    }
    if (ids.has(card.id)) throw new Error(`kanban snapshot: duplicate card id "${card.id}"`);
    ids.add(card.id);
    if (!COLUMNS.includes(card.col)) {
      throw new Error(`kanban snapshot: card "${card.id}" has unknown column "${card.col}"`);
    }
  }
  return data as Snapshot;
}

/**
 * Apply live GitHub state to the snapshot cards. PR state decides first
 * (merged → Done; closed unmerged → Backlog with a note; open draft →
 * In progress; open ready → In review); a card with no resolved PR
 * moves to In progress when its branch exists. Anything else keeps its
 * snapshot column. Inputs are not mutated.
 */
export function applyOverlay(
  cards: Card[],
  pulls: ReadonlyMap<number, PullInfo>,
  branches: ReadonlySet<string>,
): Card[] {
  return cards.map((card) => {
    const pull = card.pr !== null ? pulls.get(card.pr) : undefined;
    if (pull !== undefined) {
      if (pull.merged) return { ...card, col: "Done" as Column, note: undefined };
      if (pull.state === "closed") {
        return { ...card, col: "Backlog" as Column, note: "PR closed unmerged" };
      }
      return {
        ...card,
        col: (pull.draft ? "In progress" : "In review") as Column,
        note: undefined,
      };
    }
    if (card.branch !== null && branches.has(card.branch)) {
      return { ...card, col: "In progress" as Column, note: undefined };
    }
    return { ...card };
  });
}

/** Two owned paths clash when equal, or when one is a directory of the other. */
function ownsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  return longer.startsWith(`${shorter.replace(/\/$/, "")}/`);
}

/**
 * Backlog cards an agent can pick up now: every dependency Done, and no
 * owned path overlapping an In progress card's — two claimed cards can
 * never be editing the same ground.
 */
export function freeToClaim(cards: Card[]): Card[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const busyOwns = cards.filter((c) => c.col === "In progress").flatMap((c) => c.owns);
  return cards.filter((card) => {
    if (card.col !== "Backlog") return false;
    if (!card.dependsOn.every((id) => byId.get(id)?.col === "Done")) return false;
    return !card.owns.some((path) => busyOwns.some((busy) => ownsOverlap(path, busy)));
  });
}

/** Card totals per lane, every lane present (the filter row's counts). */
export function laneCounts(cards: Card[]): Record<Lane, number> {
  const counts: Record<Lane, number> = { "tech-debt": 0, architecture: 0, product: 0 };
  for (const card of cards) counts[card.lane] += 1;
  return counts;
}
