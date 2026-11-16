/**
 * AgeBandControl.tsx — the Why Learn picker's own band control
 * (Radhae's reconciliation design, voice call 2026-11-15).
 *
 * Everything band-related stays contained in the Why Learn
 * workflow — there is no player-facing settings screen — so the
 * picker page carries the band ask itself:
 *
 * - No band set (first time): the three band pills, labelled from
 *   the band table. A pick writes through the store's unset path
 *   (setBand, the settings flow's own first-set call) and the
 *   picker's change-event subscription re-deals the list at the
 *   picked band; the pills then collapse away.
 * - Band set: the pills are gone and a "Change band" option shows
 *   instead. Tapping it re-opens the pills; a different band
 *   writes through the store's change path (saveBand with the
 *   host's run-in-progress input — the same write
 *   AgeProfileSettings performs) and the list re-deals in place.
 *   This is the graduation path: a player moves up a band from
 *   the page they play from.
 *
 * Deliberately NO grown-up gate here, and that widens who can
 * write the band: the gate in AgeProfileSettings still guards the
 * profile settings (and its reset), but band choice on this page
 * is ungated by design (Radhae's direction, voice call
 * 2026-11-15) — there is no settings surface a player could
 * graduate through instead. Flagged for the owner in the PR,
 * like the band step's note before it.
 *
 * The component lives in the age-profile UI module for the same
 * reason AgeAskGate does: store mutations stay inside this
 * module, never in game screens. The picker only hosts it.
 */

import { useEffect, useState } from "react";
import type { AgeBandId, AgeProfile } from "@/game/age-profile";
import { AGE_BANDS, AGE_BAND_IDS, loadProfile, onAgeProfileChanged } from "@/game/age-profile";
import { setBand, saveBand } from "@/game/age-profile/store.ts";
import { Button } from "@/components/ui/button";

export interface AgeBandControlProps {
  /** The settings flow's own change input: true while a run/card
   * is in progress, so a change write defers its event to the
   * next boundary instead of re-dealing mid-run. GameApp passes
   * the same expression it passes AgeProfileSettings. */
  runInProgress?: boolean;
}

export default function AgeBandControl({ runInProgress = false }: AgeBandControlProps) {
  const [profile, setProfile] = useState<AgeProfile>(() => loadProfile());
  const [expanded, setExpanded] = useState(false);

  // Follow every profile change, whoever made it: a grown-up
  // resetting the profile from the hosted settings while this
  // page is open brings the pills back; a set from anywhere
  // collapses them.
  useEffect(
    () =>
      onAgeProfileChanged(() => {
        setProfile(loadProfile());
        setExpanded(false);
      }),
    [],
  );

  const pick = (id: AgeBandId) => {
    // Read the profile fresh at tap time rather than trusting
    // the rendered snapshot, so the write path is never chosen
    // off a stale status.
    const current = loadProfile();
    if (current.status === "unset") {
      // First set: the store's unset path. The change event fires
      // inside setBand, so the picker's band state (and this
      // control's, via the subscription above) re-reads the
      // picked band before anything else renders.
      setBand(id);
    } else if (id !== current.band) {
      // A change: the store's change path, the settings flow's
      // own write. The write lands immediately; with a run in
      // progress only its event defers to the next boundary.
      saveBand(id, { runInProgress });
    }
    // Re-read unconditionally: a deferred change event (a run in
    // progress) never reaches the subscription, but this control
    // still shows the band the player just picked.
    setProfile(loadProfile());
    setExpanded(false);
  };

  const pills = (current: AgeBandId | null) => (
    <div role="group" aria-label="Age band" className="flex flex-wrap gap-2" data-testid="band-pills">
      {AGE_BAND_IDS.map((id) => (
        <Button
          key={id}
          variant={id === current ? "primary" : "secondary"}
          className="rounded-full"
          data-testid={`band-pill-${id}`}
          aria-pressed={current !== null ? id === current : undefined}
          onClick={() => pick(id)}
        >
          {AGE_BANDS[id].label}
        </Button>
      ))}
    </div>
  );

  if (profile.status === "unset") {
    return (
      <div data-testid="age-band-control">
        {/* The picker's own first-set line (AgePicker's sub copy):
            the closest band now, changeable right here later. */}
        <p className="mb-2 text-sm text-muted">Pick the closest — you can change it anytime.</p>
        {pills(null)}
      </div>
    );
  }

  if (!expanded) {
    return (
      <div data-testid="age-band-control">
        <Button
          variant="secondary"
          className="rounded-full"
          data-testid="change-band-button"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
        >
          Change band
        </Button>
      </div>
    );
  }

  return <div data-testid="age-band-control">{pills(profile.band)}</div>;
}
