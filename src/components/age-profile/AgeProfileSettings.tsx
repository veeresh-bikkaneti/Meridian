/**
 * AgeProfileSettings.tsx — the gate-walled settings flow (Phase 2 §1a–1d).
 *
 * LAZY ENTRY: this module is loaded via React.lazy from the home footer,
 * so the gate + picker cost zero initial-bundle bytes. It is the ONLY
 * caller of the age-profile store mutations — parent-control writes stay
 * behind the grown-up gate by construction.
 *
 * Flow: GrownUpGate → AgePicker → (confirm-change | confirm-reset) →
 * toast + close. Saves write the new band immediately; a mid-run save's
 * change event fires at the next card/round boundary (never a rug-pull,
 * never a mid-run re-render).
 */

import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { AgeBandId, AgeProfile } from "@/game/age-profile";
import { AGE_BANDS, getBand, loadProfile } from "@/game/age-profile";
import {
  setBand,
  saveBand,
  resetProfile,
} from "@/game/age-profile/store.ts";

const GrownUpGate = lazy(() =>
  import("./GrownUpGate.tsx").then((m) => ({ default: m.GrownUpGate })),
);
const AgePicker = lazy(() =>
  import("./AgePicker.tsx").then((m) => ({ default: m.AgePicker })),
);

export interface AgeProfileSettingsProps {
  /** True when a run/card is in progress — the change event defers to the next boundary. */
  runInProgress: boolean;
  /** Return to the origin surface. */
  onClose: () => void;
  /** Show a transient toast in the host app. */
  onToast: (message: string) => void;
  /** Local-only gate-attempt hook (result, attempts) — never the answer. */
  onGateAttempt?: (result: "pass" | "fail", attempts: number) => void;
}

type Step = "gate" | "picker" | "confirm-change" | "confirm-reset";

export default function AgeProfileSettings({
  runInProgress,
  onClose,
  onToast,
  onGateAttempt,
}: AgeProfileSettingsProps) {
  const [step, setStep] = useState<Step>("gate");
  const [profile, setProfile] = useState<AgeProfile>(() => loadProfile());
  const [selected, setSelected] = useState<AgeBandId | null>(() => profile.band);
  const [confirmTarget, setConfirmTarget] = useState<AgeBandId | null>(null);

  const save = () => {
    if (selected === null) return;
    if (profile.status === "unset") {
      setBand(selected);
      setProfile(loadProfile());
      onToast("Saved — enjoy the trail. 🌿");
      onClose();
      return;
    }
    if (selected === profile.band) return;
    setConfirmTarget(selected);
    setStep("confirm-change");
  };

  const confirmChange = () => {
    if (confirmTarget === null) return;
    saveBand(confirmTarget, { runInProgress });
    setProfile(loadProfile());
    if (runInProgress) {
      onToast("Saved — takes effect on the next card. ✅");
    } else {
      // Child-visible: never names the band (band-invisible design pillar).
      onToast("Saved ✅");
    }
    onClose();
  };

  const confirmReset = () => {
    resetProfile();
    setProfile(loadProfile());
    onToast("Cleared — the full game is open again. 🗺️");
    onClose();
  };

  /** Esc backs out of either confirm dialog to the picker (no change). */
  const dismissToPicker = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") setStep("picker");
  };

  // Focus moves into the confirm dialog when it opens (correct modal
  // pattern) — this is also what lets the dialog's Esc handler fire.
  const confirmRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (step === "confirm-change" || step === "confirm-reset") {
      confirmRef.current?.focus({ preventScroll: true });
    }
  }, [step]);

  if (step === "gate") {
    return (
      <Suspense fallback={null}>
        <GrownUpGate
          onPass={() => setStep("picker")}
          onCancel={onClose}
          onAttempt={onGateAttempt}
        />
      </Suspense>
    );
  }

  if (step === "confirm-change" && confirmTarget !== null) {
    const from = profile.band !== null ? getBand(profile.band).label : "the full game";
    const to = getBand(confirmTarget).label;
    return (
      <div role="alertdialog" aria-modal="true" aria-labelledby="agep-confirm-title" className="agep-screen" data-testid="agep-confirm-change" ref={confirmRef} tabIndex={-1} onKeyDown={dismissToPicker}>
        <h1 id="agep-confirm-title" className="agep-h1">
          Switch from {from} to {to}?
        </h1>
        <p className="agep-sub">
          {runInProgress
            ? "Takes effect on the next card — nothing in progress changes."
            : "The change applies right away."}
        </p>
        {/* Per-band consequence line (behind the gate, so parent-safe). */}
        <p className="agep-note">{getBand(confirmTarget).whatChanges}</p>
        <div className="agep-actions">
          <button type="button" className="agep-primary" onClick={confirmChange} data-testid="agep-confirm-switch">
            Switch
          </button>
          <button type="button" className="agep-ghost" onClick={() => setStep("picker")}>
            Keep as is
          </button>
        </div>
      </div>
    );
  }

  if (step === "confirm-reset") {
    return (
      <div role="alertdialog" aria-modal="true" aria-labelledby="agep-reset-title" className="agep-screen" data-testid="agep-confirm-reset" ref={confirmRef} tabIndex={-1} onKeyDown={dismissToPicker}>
        <h1 id="agep-reset-title" className="agep-h1">
          Clear the choice?
        </h1>
        <p className="agep-sub">The full game opens up again, exactly as today.</p>
        <div className="agep-actions">
          <button type="button" className="agep-danger" onClick={confirmReset} data-testid="agep-confirm-clear">
            Clear
          </button>
          <button type="button" className="agep-ghost" onClick={() => setStep("picker")}>
            Keep
          </button>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <AgePicker
        profile={profile}
        selected={selected}
        onSelect={setSelected}
        onSave={save}
        onCancel={onClose}
        onClear={() => setStep("confirm-reset")}
      />
    </Suspense>
  );
}

// Re-exported for the lazy entry point's type surface.
export type { AgeBandId };
export { AGE_BANDS };
