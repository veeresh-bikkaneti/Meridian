import type { ReactNode } from "react";
import { anchorTail, nameTier, refineDisplayString, type NameTier } from "@/game/place-name";

export type { NameTier };
export { nameTier };

/**
 * Cartographer's Plate name renderer (spec §2/§3 + Veeresh's ratified
 * anchor-bolding decision).
 *
 * - The tier is computed from the RAW name length; callers set
 *   `data-name-tier` on the name element themselves.
 * - The DISPLAY string gets zero-width spaces after `/`, `–`, `-`
 *   (spec §3) — never in data, never in ARIA names, never in `title`.
 * - The strict-rule anchor tail (", Country" only when the name ends
 *   with ", " + a recognized country name, case-insensitive) renders as
 *   a nested `<strong>`: a single element, no double-announce — the
 *   visible text stays the full name in visual order.
 */
export function PlaceNameText({ name }: { name: string }): ReactNode {
  const tail = anchorTail(name);
  if (!tail) return <>{refineDisplayString(name)}</>;
  return (
    <>
      {refineDisplayString(tail.head)}
      <strong className="place-name-anchor">{refineDisplayString(tail.tail)}</strong>
    </>
  );
}
