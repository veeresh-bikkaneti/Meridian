import { assetBase } from "./storyteller-lines.ts";

/**
 * Pack shelf data: the one adapter between the shelf UI and the deck
 * state the rest of the story-pack swarm builds.
 *
 * Slice 4 owns this file. Slice 1 (per-deck store plumbing) is built in
 * parallel, so every read here goes through a narrow, defensive peek at
 * the storage shapes DESIGN.md fixes, and the Stacker rewires these
 * functions to slice 1's final API at integration time. The assumed
 * interfaces are:
 *
 * 1. Deck selection lives under PACK_SHELF_SELECTION_KEY, one deck id
 *    per edition. Slice 1's deal functions read it through
 *    readSelectedDeck() so a run deals from the deck the player picked.
 * 2. GeoDetective per-deck progress: a deck state's cycleCompleted
 *    count is its cases-closed number. The core deck reads the current
 *    loop store blob (meridian.loop.v2, owned by src/game/loop/types.ts
 *    as LOOP_STORAGE_KEY_V2). Pack decks have no store yet on this
 *    branch, so their closed count reads as unknown, never as zero.
 * 3. Cold Trail pack progress: the pack store key from DESIGN.md
 *    section 1.4 (meridian.coldtrail.pack.capitals.v1) holds the same
 *    ColdTrailStore shape as the core store, and its solved field is
 *    the cases-closed count.
 * 4. Pack availability comes from the pack manifest at
 *    public/packs/<packId>/manifest.json (DESIGN.md section 1.2). No
 *    manifest, no chip: an unshipped pack never appears on a kid
 *    surface (DESIGN.md section 7).
 *
 * Storage keys are restated here as literals, each with its owner
 * named, so this module adds no import edge into either engine's
 * bundle. pack-shelf-data.test.ts pins the literals against the owner
 * files so a key change fails a test instead of drifting silently.
 */

export type PackEditionId = "geodetective" | "coldtrail";

/** The core deck's id in selection and chip test ids. */
export const CORE_DECK_ID = "all";

/** The one pack that ships in v1 (DESIGN.md section 0, ruling 4). */
export const FIRST_PACK_ID = "capitals";

/** Selection storage: { v: 1, decks: { [edition]: deckId } }. */
export const PACK_SHELF_SELECTION_KEY = "meridian.pack-shelf.v1";

/** Owner: LOOP_STORAGE_KEY_V2 in src/game/loop/types.ts. */
const LOOP_STORE_KEY = "meridian.loop.v2";

/** Owner: COLDTRAIL_STORAGE_KEY in src/game/coldtrail/store.ts. */
const COLDTRAIL_STORE_KEY = "meridian.coldtrail.v2";

/** Owner: DESIGN.md section 1.4 (the Cold Trail pack store key). */
const COLDTRAIL_PACK_STORE_KEY = "meridian.coldtrail.pack.capitals.v1";

/** The pack manifest shape from DESIGN.md section 1.2. */
export interface PackManifest {
  v: 1;
  packId: string;
  category: string;
  size: number;
  generatedAt: string;
  loopIndexes: number[];
  coldtrailFile: string | null;
}

export function isPackManifest(value: unknown): value is PackManifest {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    m.v === 1 &&
    typeof m.packId === "string" &&
    m.packId.length > 0 &&
    typeof m.category === "string" &&
    m.category.length > 0 &&
    Number.isInteger(m.size) &&
    (m.size as number) > 0 &&
    typeof m.generatedAt === "string" &&
    Array.isArray(m.loopIndexes) &&
    (m.loopIndexes as unknown[]).every(
      (i) => Number.isInteger(i) && (i as number) >= 0,
    ) &&
    (m.coldtrailFile === null ||
      (typeof m.coldtrailFile === "string" && m.coldtrailFile.length > 0))
  );
}

/** One deck as the shelf renders it. Counts are null when unknown. */
export interface PackDeckView {
  id: string;
  label: string;
  glyph: string;
  /** Pack decks carry the star from the DESIGN.md section 7 sketch. */
  star: boolean;
  closed: number | null;
  total: number | null;
}

const CATEGORY_LABELS: Record<string, { label: string; glyph: string }> = {
  capitals: { label: "Capitals", glyph: "🏛️" },
};

function categoryLabel(category: string, packId: string): { label: string; glyph: string } {
  const known = CATEGORY_LABELS[category];
  if (known) return known;
  const name = packId.charAt(0).toUpperCase() + packId.slice(1);
  return { label: name, glyph: "🗺️" };
}

/**
 * Build the chip list for one edition. The core deck always leads. The
 * pack chip joins only when the manifest says this edition can deal it:
 * GeoDetective needs loop indexes, Cold Trail needs its pack case file.
 */
export function buildDeckList(input: {
  edition: PackEditionId;
  packManifest: PackManifest | null;
  coreClosed: number | null;
  coreTotal: number | null;
  packClosed: number | null;
}): PackDeckView[] {
  const decks: PackDeckView[] = [
    {
      id: CORE_DECK_ID,
      label: "All cases",
      glyph: "📁",
      star: false,
      closed: input.coreClosed,
      total: input.coreTotal,
    },
  ];
  const m = input.packManifest;
  if (!m) return decks;
  const playable =
    input.edition === "geodetective"
      ? m.loopIndexes.length > 0
      : m.coldtrailFile !== null;
  if (!playable) return decks;
  const { label, glyph } = categoryLabel(m.category, m.packId);
  decks.push({
    id: m.packId,
    label,
    glyph,
    star: true,
    closed: input.packClosed,
    total: m.size,
  });
  return decks;
}

/**
 * The small line under a chip's label. Every number shown is a number
 * the stores actually hold; unknown counts are left out, not zeroed.
 */
export function deckProgressLine(deck: { closed: number | null; total: number | null }): string {
  const { closed, total } = deck;
  if (closed !== null && total !== null && closed <= total) {
    return `${closed} of ${total} cases closed`;
  }
  if (closed !== null) {
    if (closed === 0) return "No cases closed yet";
    return closed === 1 ? "1 case closed" : `${closed} cases closed`;
  }
  if (total !== null) return `${total} cases`;
  return "";
}

type StoragePeek = Pick<Storage, "getItem">;
type StorageWrite = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readJsonBlob(storage: StoragePeek | null, key: string): Record<string, unknown> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isNonNegativeInt(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

const DECK_ID_RE = /^[a-z0-9-]+$/;

/**
 * The deck the player picked for an edition. Defaults to the core deck
 * on any doubt: missing storage, a corrupt blob, or an id that is not
 * a plain deck token all fail closed to "all".
 */
export function readSelectedDeck(
  edition: PackEditionId,
  storage: StoragePeek | null = defaultStorage(),
): string {
  const blob = readJsonBlob(storage, PACK_SHELF_SELECTION_KEY);
  if (!blob || blob.v !== 1) return CORE_DECK_ID;
  const decks = blob.decks as Record<string, unknown> | undefined;
  const value = decks?.[edition];
  return typeof value === "string" && DECK_ID_RE.test(value) ? value : CORE_DECK_ID;
}

/** Store the player's deck pick for an edition. Fail-silent, like the game stores. */
export function writeSelectedDeck(
  edition: PackEditionId,
  deckId: string,
  storage: StorageWrite | null = defaultStorage(),
): void {
  if (!storage || !DECK_ID_RE.test(deckId)) return;
  const blob = readJsonBlob(storage, PACK_SHELF_SELECTION_KEY);
  const decks: Record<string, unknown> = {
    ...((blob?.decks as Record<string, unknown> | undefined) ?? {}),
    [edition]: deckId,
  };
  try {
    storage.setItem(PACK_SHELF_SELECTION_KEY, JSON.stringify({ v: 1, decks }));
  } catch {
    // Blocked storage: the pick lasts for this screen visit only.
  }
}

/**
 * GeoDetective core deck progress: cases closed in the current deck
 * cycle. Reads the loop store blob directly (a peek, never a write).
 */
export function readLoopCoreClosed(storage: StoragePeek | null = defaultStorage()): number | null {
  const blob = readJsonBlob(storage, LOOP_STORE_KEY);
  const deck = blob?.deck as Record<string, unknown> | undefined;
  return isNonNegativeInt(deck?.cycleCompleted) ? deck.cycleCompleted : null;
}

/**
 * Cold Trail cases closed for one store key (core or pack). The store
 * shape is ColdTrailStore; solved counts every finished case.
 */
export function readColdtrailClosed(
  storeKey: "core" | "pack",
  storage: StoragePeek | null = defaultStorage(),
): number | null {
  const blob = readJsonBlob(
    storage,
    storeKey === "core" ? COLDTRAIL_STORE_KEY : COLDTRAIL_PACK_STORE_KEY,
  );
  if (!blob || blob.v !== 2) return null;
  return isNonNegativeInt(blob.solved) ? blob.solved : null;
}

type Fetcher = (url: string) => Promise<unknown>;

/** Fetch and parse JSON, or return null on any failure. */
async function fetchJsonOrNull(url: string, fetcher?: Fetcher): Promise<unknown> {
  try {
    if (fetcher) return await fetcher(url);
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/** The pack manifest for a pack id, or null when the pack has not shipped. */
export async function fetchPackManifest(
  packId: string,
  fetcher?: Fetcher,
): Promise<PackManifest | null> {
  const raw = await fetchJsonOrNull(`${assetBase()}packs/${packId}/manifest.json`, fetcher);
  return isPackManifest(raw) ? raw : null;
}

/** The GeoDetective core deck size from the loop manifest, or null. */
export async function fetchLoopDeckSize(fetcher?: Fetcher): Promise<number | null> {
  const raw = await fetchJsonOrNull(`${assetBase()}loop/manifest.json`, fetcher);
  if (!raw || typeof raw !== "object") return null;
  const size = (raw as Record<string, unknown>).size;
  return Number.isInteger(size) && (size as number) > 0 ? (size as number) : null;
}
