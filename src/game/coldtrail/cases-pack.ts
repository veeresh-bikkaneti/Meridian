import capitalsJson from "./cases.capitals.generated.json" with { type: "json" };
import { isCase } from "./cases.ts";
import type { ColdTrailCase } from "./types.ts";

/**
 * Cold Trail pack deck access, the capitals pack.
 *
 * Pack cases live in their own generated file
 * (cases.capitals.generated.json, built by
 * scripts/build-coldtrail-capitals.mjs) and deal from this deck only.
 * They never enter the core deck in cases.ts, and the core deck never
 * serves them: the two decks have different files, different loaders,
 * and different progress stores, so a pack case index can never shift
 * what a core case index means for an existing player.
 *
 * Fail-closed, same as the core loader: the generated file is
 * validated on load with the core deck's own shape guard (isCase in
 * cases.ts), a case counts only when its packId matches the pack, and
 * a corrupt entry yields null instead of a broken case.
 */

/** The one pack this module serves. */
export const CAPITALS_PACK_ID = "capitals";

/**
 * Progress store key for the capitals pack, per the pack design
 * (docs/story-packs.md section 1.4). The
 * core store key meridian.coldtrail.v2 in store.ts is untouched, and
 * core progress can never be read or overwritten through this key.
 * The pack screen wiring that consumes it lands with the shelf work;
 * the key is defined here so there is exactly one spelling of it.
 */
export const COLDTRAIL_PACK_CAPITALS_STORAGE_KEY =
  "meridian.coldtrail.pack.capitals.v1";

function loadPackDeck(raw: unknown, packId: string): ColdTrailCase[] {
  const file = raw as { v?: unknown; cases?: unknown };
  if (file.v !== 1 || !Array.isArray(file.cases)) return [];
  return file.cases.filter(
    (c): c is ColdTrailCase =>
      isCase(c) && (c as ColdTrailCase).packId === packId,
  );
}

const capitalsDeck: ColdTrailCase[] = loadPackDeck(
  capitalsJson as unknown,
  CAPITALS_PACK_ID,
);

/** Number of playable cases in the capitals pack deck. */
export function capitalsPackCaseCount(): number {
  return capitalsDeck.length;
}

/**
 * Capitals pack case by 0-based index (wraps around the pack deck).
 * Returns null when the pack deck is empty or corrupt, and for a
 * non-integer index. The wrap is over the pack deck's length, never
 * the core deck's.
 */
export function getCapitalsPackCase(index: number): ColdTrailCase | null {
  if (capitalsDeck.length === 0 || !Number.isInteger(index)) return null;
  return (
    capitalsDeck[
      ((index % capitalsDeck.length) + capitalsDeck.length) %
        capitalsDeck.length
    ] ?? null
  );
}
