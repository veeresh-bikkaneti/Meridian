import { assetBase } from "./storyteller-lines.ts";

/**
 * Pack shelf data: the one adapter between the shelf UI and the deck
 * state the rest of the story-pack swarm builds.
 *
 * Slice 4 owns this file. Slice 1 (per-deck store plumbing) was built
 * in parallel; the Stacker wired these functions to the integrated
 * stores. Each edition has exactly one selection store, owned by the
 * engine that deals from it, and both the chips and the dealer read
 * that same store:
 *
 * 1. GeoDetective selection lives in the loop store itself: the
 *    activeDeckId field of the meridian.loop.v2 blob (owner:
 *    src/game/loop/store.ts, written by setActiveDeck). Reads peek
 *    the blob. Writes go through the loop screen's own store commit
 *    (PackShelf's onPickDeck prop), because the screen owns the live
 *    in-memory copy of the store; a storage write from here would be
 *    overwritten by the screen's next commit. Shelf deck ids differ
 *    from loop deck ids in one place: the shelf's core deck is "all",
 *    the loop store's is "core" (LOOP_CORE_DECK_ID in
 *    src/game/loop/types.ts, restated below and pinned by test).
 *    toShelfDeckId maps between the two vocabularies.
 * 2. GeoDetective per-deck progress: a deck state's cycleCompleted
 *    count is its cases-closed number. The core deck's state is the
 *    blob's deck field; a pack deck's state is blob.packDecks[<id>].
 *    A deck that was never built reads as unknown, never as zero.
 * 3. Cold Trail selection lives under PACK_SHELF_SELECTION_KEY, one
 *    deck id for the edition. TrailScreen reads the same blob when
 *    it deals the next case (its onPickDeck handler writes through
 *    writeSelectedDeck below). Cold Trail pack progress: the pack
 *    store key from docs/story-packs.md section 1.4
 *    (meridian.coldtrail.pack.capitals.v1, spelling owned by
 *    COLDTRAIL_PACK_CAPITALS_STORAGE_KEY in
 *    src/game/coldtrail/cases-pack.ts) holds the same ColdTrailStore
 *    shape as the core store, and its solved field is the
 *    cases-closed count.
 * 4. Pack availability comes from the pack manifest at
 *    public/packs/<packId>/manifest.json (docs/story-packs.md section 1.2). No
 *    manifest, no chip: an unshipped pack never appears on a kid
 *    surface (docs/story-packs.md section 7).
 *
 * Storage keys are restated here as literals, each with its owner
 * named, so this module adds no import edge into either engine's
 * bundle. pack-shelf-data.test.ts pins the literals against the owner
 * files so a key change fails a test instead of drifting silently.
 */

export type PackEditionId = "geodetective" | "coldtrail";

/** The core deck's id in selection and chip test ids. */
export const CORE_DECK_ID = "all";

/** The one pack that ships in v1 (docs/story-packs.md section 0, ruling 4). */
export const FIRST_PACK_ID = "capitals";

/** Selection storage: { v: 1, decks: { [edition]: deckId } }. */
export const PACK_SHELF_SELECTION_KEY = "meridian.pack-shelf.v1";

/** Owner: LOOP_STORAGE_KEY_V2 in src/game/loop/types.ts. */
const LOOP_STORE_KEY = "meridian.loop.v2";

/** Owner: LOOP_CORE_DECK_ID in src/game/loop/types.ts. */
const LOOP_CORE_DECK_ID = "core";

/** Owner: COLDTRAIL_STORAGE_KEY in src/game/coldtrail/store.ts. */
const COLDTRAIL_STORE_KEY = "meridian.coldtrail.v2";

/** Owner: COLDTRAIL_PACK_CAPITALS_STORAGE_KEY in src/game/coldtrail/cases-pack.ts. */
const COLDTRAIL_PACK_STORE_KEY = "meridian.coldtrail.pack.capitals.v1";

/**
 * Map a loop-store deck id to the shelf's vocabulary: the loop
 * store's core deck is the shelf's "all", and pack ids pass through.
 */
export function toShelfDeckId(loopDeckId: string): string {
  return loopDeckId === LOOP_CORE_DECK_ID ? CORE_DECK_ID : loopDeckId;
}

/** The pack manifest shape from docs/story-packs.md section 1.2. */
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
  if (!Array.isArray(m.loopIndexes)) return false;
  const indexes = m.loopIndexes as unknown[];
  return (
    m.v === 1 &&
    typeof m.packId === "string" &&
    m.packId.length > 0 &&
    typeof m.category === "string" &&
    m.category.length > 0 &&
    Number.isInteger(m.size) &&
    (m.size as number) > 0 &&
    // The size is the GeoDetective deck size: it must equal the loop
    // index count, and indexes must be unique — the same pins the
    // loop validator (isLoopPackManifest in src/game/loop/packs.ts)
    // applies, so the two validators cannot diverge on a manifest.
    m.size === indexes.length &&
    new Set(indexes).size === indexes.length &&
    typeof m.generatedAt === "string" &&
    indexes.every((i) => Number.isInteger(i) && (i as number) >= 0) &&
    (m.coldtrailFile === null ||
      (typeof m.coldtrailFile === "string" && m.coldtrailFile.length > 0))
  );
}

/** One deck as the shelf renders it. Counts are null when unknown. */
export interface PackDeckView {
  id: string;
  label: string;
  glyph: string;
  /** Pack decks carry the star from the docs/story-packs.md section 7 sketch. */
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
 * The shelf-vocabulary label for one deck, by deck id. Accepts either
 * vocabulary: the loop store's core id ("core") and the shelf's
 * ("all") both read "All cases"; a pack id reads through the same
 * category-label logic the chips use, so a deck is called the same
 * thing wherever it is named. The case screen uses this to name the
 * OPEN case's deck (issue #336): the caller derives the id from the
 * open case itself, never from the player's pick.
 */
export function deckLabelForId(deckId: string): string {
  if (deckId === CORE_DECK_ID || deckId === LOOP_CORE_DECK_ID) return "All cases";
  return categoryLabel(deckId, deckId).label;
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
  /**
   * The pack deck's real case count in THIS edition, when the screen
   * bundles it (Cold Trail passes capitalsPackCaseCount()). The
   * manifest's size is the GeoDetective count (72); Cold Trail's deck
   * is a different, smaller deck (60) built from the same records, so
   * its chip must never show the manifest size — per-deck progress
   * could never complete against a total the deck does not have.
   */
  packTotal?: number | null;
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
    total:
      input.edition === "coldtrail" && input.packTotal != null
        ? input.packTotal
        : m.size,
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

/**
 * Which Cold Trail deck the screen opens on at mount. Resume wins over
 * the selection blob (mirroring LoopScreen, where an in-progress
 * mystery is never clobbered): when exactly one deck's store holds an
 * unrevealed current case, that deck opens, whatever the blob says.
 * When both or neither deck has a case mid-play, the stored selection
 * decides.
 */
export function initialTrailDeck(input: {
  selected: string;
  coreCurrent: { revealed: boolean } | null | undefined;
  packCurrent: { revealed: boolean } | null | undefined;
}): string {
  const coreOpen = !!input.coreCurrent && !input.coreCurrent.revealed;
  const packOpen = !!input.packCurrent && !input.packCurrent.revealed;
  if (coreOpen && !packOpen) return CORE_DECK_ID;
  if (packOpen && !coreOpen) return FIRST_PACK_ID;
  return input.selected;
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
 * The deck the player picked for an edition, read from the store
 * that owns selection for that edition. Defaults to the core deck on
 * any doubt: missing storage, a corrupt blob, or an id that is not a
 * plain deck token all fail closed to "all".
 */
export function readSelectedDeck(
  edition: PackEditionId,
  storage: StoragePeek | null = defaultStorage(),
): string {
  if (edition === "geodetective") {
    const blob = readJsonBlob(storage, LOOP_STORE_KEY);
    const active = blob?.activeDeckId;
    return typeof active === "string" && DECK_ID_RE.test(active) && active !== LOOP_CORE_DECK_ID
      ? active
      : CORE_DECK_ID;
  }
  const blob = readJsonBlob(storage, PACK_SHELF_SELECTION_KEY);
  if (!blob || blob.v !== 1) return CORE_DECK_ID;
  const decks = blob.decks as Record<string, unknown> | undefined;
  const value = decks?.[edition];
  return typeof value === "string" && DECK_ID_RE.test(value) ? value : CORE_DECK_ID;
}

/**
 * Store the player's Cold Trail deck pick. Fail-silent, like the game
 * stores. GeoDetective picks are not written here: that edition's
 * selection lives in the loop store, and the loop screen writes it
 * through its own store commit (PackShelf's onPickDeck prop), so this
 * function is a documented no-op for "geodetective".
 */
export function writeSelectedDeck(
  edition: PackEditionId,
  deckId: string,
  storage: StorageWrite | null = defaultStorage(),
): void {
  if (edition === "geodetective") return;
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
 * GeoDetective cases closed in one deck's current cycle: the core
 * deck ("all" in shelf vocabulary) or a pack deck by pack id. Reads
 * the loop store blob directly (a peek, never a write). A pack deck
 * that was never built reads as unknown, never zero.
 */
export function readLoopDeckClosed(
  deckId: string,
  storage: StoragePeek | null = defaultStorage(),
): number | null {
  const blob = readJsonBlob(storage, LOOP_STORE_KEY);
  if (!blob) return null;
  if (deckId === CORE_DECK_ID || deckId === LOOP_CORE_DECK_ID) {
    const deck = blob.deck as Record<string, unknown> | undefined;
    return isNonNegativeInt(deck?.cycleCompleted) ? deck.cycleCompleted : null;
  }
  const packDecks = blob.packDecks as Record<string, unknown> | undefined;
  const deck = packDecks?.[deckId] as Record<string, unknown> | undefined;
  return isNonNegativeInt(deck?.cycleCompleted) ? deck.cycleCompleted : null;
}

/** GeoDetective core deck progress: cases closed in the current cycle. */
export function readLoopCoreClosed(storage: StoragePeek | null = defaultStorage()): number | null {
  return readLoopDeckClosed(CORE_DECK_ID, storage);
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
