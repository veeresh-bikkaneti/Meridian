/**
 * EarnedBadgeRow.tsx — earned badges shown on the home page card.
 *
 * Owner 2026-10-09: badges display ON the home page card — no separate
 * Passport page. Reads the device-local earned list
 * (`meridian.passport.badges.v1`); the home menu remounts when a loop
 * screen closes, so this is always fresh on return.
 *
 * Cosmetic ONLY: badge name + blurb. No points, no band state, no
 * age numbers, no easy/hard language — the band stays invisible.
 */

import { useState } from "react";
import {
  earnedPassportBadges,
  getPassportBadge,
} from "@/game/passport/badges";

export function EarnedBadgeRow() {
  // Read once on mount: home remounts after every loop, so this is fresh.
  const [earned] = useState(() => earnedPassportBadges());
  // #113 BLOCK: the blurb lived in a hover-only `title` tooltip — unreachable
  // on touch. Tapping a chip toggles its blurb as visible text instead.
  const [openId, setOpenId] = useState<string | null>(null);
  if (earned.length === 0) return null;

  return (
    <div
      className="atlas-badges"
      data-testid="earned-badges"
      role="list"
      aria-label="Badges you've earned"
    >
      {earned.map((b) => {
        const def = getPassportBadge(b.id);
        if (!def) return null;
        const open = openId === b.id;
        return (
          <span key={b.id} role="listitem">
            <button
              type="button"
              className="atlas-badge-chip"
              aria-expanded={open}
              aria-label={`${def.name}. ${open ? "Hide" : "Show"} badge details.`}
              data-testid={`badge-chip-${b.id}`}
              onClick={() => setOpenId(open ? null : b.id)}
            >
              <span aria-hidden="true">🏅</span> {def.name}
            </button>
            {open ? (
              <span className="atlas-badge-blurb" data-testid={`badge-blurb-${b.id}`}>
                {def.blurb}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
