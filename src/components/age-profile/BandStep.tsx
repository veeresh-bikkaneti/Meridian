/**
 * BandStep.tsx — the Why Learn entry's age-band step (owner
 * direction, 2026-11-15: the band comes right after the "Why Do We
 * Learn This?" card, so reaching a case takes fewer taps and the
 * band is never silently assumed).
 *
 * GameApp hosts this step over the subjects branch, exactly as it
 * hosts AgeProfileSettings: it is lazy-loaded, and it lives in this
 * module because the age-profile store mutations (setBand /
 * saveBand) are called only from the age-profile UI. That is a
 * deliberate widening of the module's original rule — until this
 * step, the gate-walled settings UI was the only caller — made by
 * owner direction (2026-11-15) and recorded here and in the
 * facade's and settings' headers, which are updated to match. No
 * parallel band state is created: a tap writes through the store's
 * own functions, so the
 * stored profile, the `ageprofile:changed` event and the subject
 * picker's re-deal all behave exactly as they do for a settings
 * save.
 *
 * The presentation is AgePicker's own — the same heading and sub
 * copy, the same cards (agep-cards / agep-card classes, the band
 * table's label / description / what-changes lines, the checked
 * ring + checkmark on the current band) — with one deliberate
 * difference: there is no Save button. Tapping a card IS the
 * choice: it writes the band and advances to the subject picker
 * in the same tap. The grown-up gate is not part of this step, and
 * the gate itself is unchanged: AgeProfileSettings (gate → picker
 * → confirm) remains the gated profile-management flow — the only
 * path to a reset, and the only band path behind a confirm —
 * reachable from Home's footer and the picker's "For grown-ups"
 * entry as before. What changed is only that band selection is
 * no longer exclusively behind it.
 *
 * The step is presented on every Why Learn entry, even when a
 * profile band already exists — the stored band shows as the
 * current selection (checked card), and tapping any card,
 * including that one, advances. Re-entering the flow re-asks,
 * which is the point: the earlier defect was a band silently
 * assumed with no in-flow way to pick.
 */

import { useEffect, useRef, useState } from "react";
import type { AgeBandId, AgeProfile } from "@/game/age-profile";
import { AGE_BANDS, AGE_BAND_IDS, loadProfile } from "@/game/age-profile";
import { setBand, saveBand } from "@/game/age-profile/store.ts";
import { ScreenShell } from "@/components/ui/screen-shell";
import { WhyLearnHero } from "@/subjects/shared/WhyLearnHero";
import { WhyLearnWorld } from "@/subjects/shared/WhyLearnWorld";
import { WhyLearnDrift } from "@/subjects/shared/WhyLearnDrift";

export interface BandStepProps {
  /** True when a run/card is in progress — a band change's event
   * defers to the next boundary, exactly as for a settings save. */
  runInProgress: boolean;
  /** Advance to the subject picker (the band is already written). */
  onPick: (band: AgeBandId) => void;
  /** Leave the Why Learn flow, back to Home. */
  onExit: () => void;
}

export default function BandStep({ runInProgress, onPick, onExit }: BandStepProps) {
  // The stored profile drives the current-selection ring; it is
  // read once, on arrival — the step is mounted fresh on every
  // Why Learn entry.
  const [profile] = useState<AgeProfile>(() => loadProfile());
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // Arrival focus, the SubjectPicker pattern: land focus on the
  // heading so it is never stranded on the Home card that opened
  // the flow.
  useEffect(() => {
    const el = headingRef.current;
    if (el && typeof el.focus === "function") el.focus({ preventScroll: true });
  }, []);

  const pick = (band: AgeBandId) => {
    // The settings flow's own write pattern (AgeProfileSettings):
    // first setup goes through setBand, a change through saveBand;
    // re-picking the stored band writes nothing (saveBand would
    // no-op) and simply advances.
    if (profile.status === "unset") {
      setBand(band);
    } else if (profile.band !== band) {
      saveBand(band, { runInProgress });
    }
    onPick(band);
  };

  const isFirstSet = profile.status === "unset";

  return (
    <ScreenShell
      onHome={onExit}
      className="why-learn-screen lg:max-w-6xl"
      testId="subject-band-step"
      hero={<WhyLearnHero />}
      eyebrow="Case file · Why it matters"
      title="Why Do We Learn This?"
      titleRef={headingRef}
      sub="Who plays most?"
    >
      <WhyLearnWorld />
      <WhyLearnDrift />
      <p className="agep-sub mt-6">
        {isFirstSet
          ? "Pick the closest — you can change it anytime."
          : "You're set — change it here anytime."}
      </p>
      <div role="group" aria-label="Age band" className="agep-cards mt-5">
        {AGE_BAND_IDS.map((id, i) => {
          const band = AGE_BANDS[id];
          const current = profile.band === id;
          return (
            <button
              key={id}
              type="button"
              className={`agep-card text-left${current ? " agep-card-checked" : ""}`}
              data-testid={`band-step-card-${id}`}
              aria-label={`${band.label}, ${i + 1} of 3${current ? ", current choice" : ""}`}
              onClick={() => pick(id)}
            >
              <span className="agep-card-title">{band.label}</span>
              <span className="agep-card-desc">{band.description}</span>
              <span className="agep-card-changes">{band.whatChanges}</span>
            </button>
          );
        })}
      </div>
    </ScreenShell>
  );
}
