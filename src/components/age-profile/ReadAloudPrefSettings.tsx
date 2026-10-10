/**
 * ReadAloudPrefSettings.tsx — change the read-aloud preference after the
 * first tap.
 *
 * Owner 2026-10-09: the kid's Always / Sometimes / Never choice must be
 * changeable later — one impulsive tap is not permanent. Kid-reachable:
 * this sits in the home footer NEXT TO (never behind) the grown-ups gate.
 * Read-aloud is the kid's tool; it is never parent-gated.
 *
 * Changing the preference writes immediately and takes effect on the next
 * card (the read-aloud button reads getReadAloudPref() live).
 * Works fully offline (device-local storage only).
 */

import { useRef, useState } from "react";
import {
  getReadAloudPref,
  setReadAloudPref,
  type ReadAloudPref,
  type ReadAloudPrefOrUnset,
} from "@/game/age-profile/read-aloud-pref";

const OPTIONS: { value: ReadAloudPref; label: string; sub: string }[] = [
  { value: "always", label: "Always", sub: "Read every story to me" },
  { value: "sometimes", label: "Sometimes", sub: "I'll tap the speaker myself" },
  { value: "never", label: "Never", sub: "I'll read them myself" },
];

function labelFor(pref: ReadAloudPrefOrUnset): string {
  return OPTIONS.find((o) => o.value === pref)?.label ?? "Choose";
}

export function ReadAloudPrefSettings() {
  const [pref, setPref] = useState<ReadAloudPrefOrUnset>(() => getReadAloudPref());
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Unset → the onboarding prompt owns the first choice; nothing to change yet.
  if (pref === "unset") return null;

  const choose = (value: ReadAloudPref) => {
    setReadAloudPref(value); // persisted before anything else
    setPref(value);
    setOpen(false);
    toggleRef.current?.focus(); // focus returns to the toggle
  };

  return (
    <div
      className="agep-readaloud-settings"
      data-testid="readaloud-settings"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          toggleRef.current?.focus();
        }
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        className="agep-readaloud-toggle"
        aria-expanded={open}
        aria-label={`Stories read aloud: ${labelFor(pref)}. Change read-aloud setting.`}
        data-testid="readaloud-settings-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">🔊</span> Stories: {labelFor(pref)}
      </button>
      {open ? (
        <div
          className="agep-readaloud-options"
          role="group"
          aria-label="Read-aloud preference"
        >
          {OPTIONS.map((opt) => {
            const selected = opt.value === pref;
            return (
              <button
                key={opt.value}
                type="button"
                className="agep-pref-option"
                aria-pressed={selected}
                data-testid={`readaloud-option-${opt.value}`}
                onClick={() => choose(opt.value)}
              >
                <span className="agep-pref-label">
                  {opt.label}
                  {selected ? " ✓" : ""}
                </span>
                <span className="agep-pref-sub">{opt.sub}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
