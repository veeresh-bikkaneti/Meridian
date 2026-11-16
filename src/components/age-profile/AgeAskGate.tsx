/**
 * AgeAskGate.tsx — the ask-first interstitial (owner decision,
 * 2026-11-14: "Ask first").
 *
 * A player with NO age band set must be asked to pick one before any
 * case starts — the game never silently defaults to the full-access
 * band on a case-start path. GameApp holds the intended continuation
 * (open the subject picker, open the tapped subject's case, resume
 * the GeoDetective mystery) and renders this gate instead of running
 * it; the pick writes the band and the continuation runs; "Not now"
 * abandons it — nothing is written, nothing starts.
 *
 * This is prod's own picker, not a new surface: the component hosts
 * AgePicker verbatim (same cards, same copy, same save contract) and
 * writes through the store's unset path — setBand, the exact call
 * AgeProfileSettings makes for a first set (no confirm: nothing to
 * lose, undo is one tap away). It lives in the age-profile UI module
 * for the same reason the settings flow does: store mutations stay
 * inside this module, never in game screens.
 *
 * Deliberately NO grown-up gate here. The gate in
 * AgeProfileSettings guards CHANGING a band a grown-up already set;
 * this is the first ask the owner ordered on the child's own paths,
 * and that flow is untouched by this file.
 */

import { useState } from "react";
import type { AgeBandId, AgeProfile } from "@/game/age-profile";
import { loadProfile } from "@/game/age-profile";
import { setBand } from "@/game/age-profile/store.ts";
import { AgePicker } from "./AgePicker.tsx";

export interface AgeAskGateProps {
  /** The pick is saved; continue to the case the player was going to. */
  onPicked: (band: AgeBandId) => void;
  /** Back out (AgePicker's "Not now"): no write, no case starts. */
  onCancel: () => void;
}

export default function AgeAskGate({ onPicked, onCancel }: AgeAskGateProps) {
  // The profile this gate exists for is unset by construction (the
  // host only renders it then); the snapshot drives AgePicker's
  // first-set copy and hides its reset affordance.
  const [profile] = useState<AgeProfile>(() => loadProfile());
  const [selected, setSelected] = useState<AgeBandId | null>(null);

  const save = () => {
    if (selected === null) return;
    // The store's own unset path, then continue. The change event
    // fires inside setBand, so every subscriber (the picker's band
    // state, GameApp's profile state) re-reads the picked band
    // before the continuation renders anything.
    setBand(selected);
    onPicked(selected);
  };

  return (
    <AgePicker
      profile={profile}
      selected={selected}
      onSelect={setSelected}
      onSave={save}
      onCancel={onCancel}
      // Unreachable for an unset profile (AgePicker renders its
      // clear affordance only for an active one); wired to the same
      // back-out so the prop is never a dead end.
      onClear={onCancel}
    />
  );
}
