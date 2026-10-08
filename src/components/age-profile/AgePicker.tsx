/**
 * AgePicker.tsx — the 3-band picker (Phase 2 §1c).
 *
 * A real `radiogroup`: arrow-key navigation, screen-reader announces
 * position ("1 of 3"). Age eyebrows are parent-safe here because the whole
 * screen sits behind the grown-up gate. No age numbers, badges, or
 * "easy/hard" language appear on any child-visible surface.
 */

import { AGE_BANDS, AGE_BAND_IDS } from "@/game/age-profile";
import type { AgeBandId, AgeProfile } from "@/game/age-profile";

export interface AgePickerProps {
  /** The stored profile: drives preselection + pending-change note. */
  profile: AgeProfile;
  /** The pending-selection state lives in the parent (settings flow). */
  selected: AgeBandId | null;
  onSelect: (band: AgeBandId) => void;
  /** First set: save. Change: stage confirm. */
  onSave: () => void;
  /** Back to the origin surface, no changes. */
  onCancel: () => void;
  /** Reset flow (active profiles only). */
  onClear: () => void;
}

export function AgePicker({ profile, selected, onSelect, onSave, onCancel, onClear }: AgePickerProps) {
  const isFirstSet = profile.status === "unset";
  const pending = profile.status === "pending-change";
  const saveDisabled = selected === null || (!isFirstSet && selected === profile.band && !pending);
  const saveLabel = isFirstSet ? "Save choice" : pending ? "Save change" : "Save change";

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="agep-picker-title" className="agep-screen" data-testid="age-picker">
      <h1 id="agep-picker-title" className="agep-h1">
        Who plays most?
      </h1>
      <p className="agep-sub">
        {isFirstSet
          ? "Pick the closest — you can change it anytime."
          : "You're set — change it here anytime."}
      </p>
      {pending ? (
        <p className="agep-note" role="status">
          A change is waiting: it takes effect on the next card. Pick again to change your mind.
        </p>
      ) : null}

      <div role="radiogroup" aria-label="Age band" className="agep-cards">
        {AGE_BAND_IDS.map((id, i) => {
          const band = AGE_BANDS[id];
          const checked = pending ? profile.pendingBand === id : selected === id;
          return (
            <label key={id} className={`agep-card${checked ? " agep-card-checked" : ""}`}>
              <input
                type="radio"
                name="age-band"
                className="sr-only"
                checked={checked}
                onChange={() => onSelect(id)}
                aria-label={`${band.label}, ages ${band.ageMin} to ${band.ageMax}, ${i + 1} of 3`}
              />
              <span className="agep-eyebrow">
                Ages {band.ageMin}–{band.ageMax}
              </span>
              <span className="agep-card-title">{band.label}</span>
              <span className="agep-card-desc">{band.description}</span>
              <span className="agep-card-changes">{band.whatChanges}</span>
            </label>
          );
        })}
      </div>

      <div className="agep-actions">
        <button
          type="button"
          className="agep-primary"
          onClick={onSave}
          disabled={saveDisabled}
          data-testid="agep-save"
        >
          {saveLabel}
        </button>
        <button type="button" className="agep-ghost" onClick={onCancel}>
          {isFirstSet ? "Not now" : "Cancel"}
        </button>
      </div>
      {!isFirstSet ? (
        <button type="button" className="agep-danger-link" onClick={onClear}>
          Clear choice
        </button>
      ) : null}
    </div>
  );
}
