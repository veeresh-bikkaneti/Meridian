/**
 * PackDoorway — the Capitals & Flags strip on Home (issue #344).
 *
 * SIGNPOST ONLY (owner's pick, superseding the #344 door design).
 * Veeresh, 2026-11-05: "Option C — signpost only, no buttons".
 * He flagged the doorway's two Play buttons as redundant to the
 * GeoDetective / Cold Trail cards below: the doors did deal the
 * Capitals deck, but invisibly. The strip therefore carries NO
 * doors and NO buttons — it advertises the pack (flags, title,
 * count line), and the pack's only entry point is the deck shelf
 * inside each mode, where the player picks the Capitals deck on
 * the shelf chip. This supersedes the #344 ratified
 * one-door-per-mode design (one door into each mode that deals
 * the pack before opening).
 *
 * The land count in the sub-line comes from the shipped pack manifest,
 * so it can never promise cases that do not exist; until the manifest
 * answers (or if it never does), the line runs without a count. The
 * count is display-only — nothing on this strip deals or opens.
 *
 * THEME RESTYLE (designed on branch design/home-rework-variants,
 * composed into production 2026-11-04): the restyle started from the
 * owner's finding "doesnt follow the theme" — Veeresh, 2026-11-04,
 * with screenshots of the then-current doorway — plus his placement
 * call (beside the About card). The insides are rebuilt in the
 * home-v5 card language — hv5-head badge + eyebrow label,
 * display-type title — so the strip reads as a sibling of the
 * GeoDetective / Cold Trail cards instead of a generic banner.
 * Copy scoping, stated precisely: the locked lines (heading, count
 * sub-line) are unchanged word-for-word versus main; one label is
 * new versus main — the eyebrow "Story pack · Capitals", added in
 * this theme restyle (design branch commit 266c00c) and flagged in
 * the PR body for the owner's word at merge. `density="compact"`
 * is the anti-crowding cut for the beside-About placement: same
 * signpost, tighter footprint.
 */
import { useEffect, useState } from "react";

import { FlagImg } from "@/components/flag-img";
import { FIRST_PACK_ID, fetchPackManifest } from "@/components/pack-shelf-data";

/**
 * The design sketch's three swatches: a country flag, a US state flag,
 * a second country flag — the registry's most famous three. Each sits
 * beside the strip's own title text naming the pack's lands in words,
 * and a flagless registry entry would simply render no swatch.
 */
const DOORWAY_SWATCH_KEYS = ["us", "us-tx", "gb"];

export function PackDoorway({
  density = "full",
}: {
  density?: "full" | "compact";
}) {
  const [landCount, setLandCount] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    fetchPackManifest(FIRST_PACK_ID)
      .then((manifest) => {
        if (live && manifest) setLandCount(manifest.size);
      })
      .catch(() => {
        // No count, no problem: the count is display-only, so the
        // signpost simply runs without one.
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <section
      aria-label="Capitals and Flags"
      data-testid="pack-doorway"
      className={`hv5-card hv5-doorway home-rise${density === "compact" ? " hv5-doorway-compact" : ""}`}
    >
      <div className="hv5-head">
        <span className="hv5-badge" aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M5 21 V4" strokeLinecap="round" /><path d="M5 5 C8 3.5 10.5 6 13.5 4.5 L19 6.5 L19 12 C16 10.5 13.5 13 10.5 11.5 L5 12.5 Z" /></svg>
        </span>
        <span className="hv5-label">Story pack · Capitals</span>
      </div>
      <div className="hv5-doorway-flags" aria-hidden="true">
        {DOORWAY_SWATCH_KEYS.map((flagKey) => (
          <FlagImg key={flagKey} flagKey={flagKey} className="hv5-doorway-flag" />
        ))}
      </div>
      <h2>Capitals &amp; Flags</h2>
      <p>
        {landCount !== null ? `${landCount} lands · ` : ""}Find the capital,
        learn its flag
      </p>
    </section>
  );
}
