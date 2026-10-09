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
        return (
          <span
            key={b.id}
            className="atlas-badge-chip"
            role="listitem"
            title={def.blurb}
          >
            <span aria-hidden="true">🏅</span> {def.name}
          </span>
        );
      })}
    </div>
  );
}
