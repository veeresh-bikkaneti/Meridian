/**
 * ReadAloudPrefPrompt.tsx — the kid-set read-aloud onboarding preference.
 *
 * Item C (B3): "Do you like stories read aloud? Always / Sometimes / Never."
 * Asked ONCE, never nags: the component renders only while the preference
 * is unset, and writes the answer the moment the kid picks — after that it
 * never appears again (storage: meridian.readAloudPref.v1).
 *
 * "Sometimes" semantics: no auto-read; the ghost speaker button is shown and
 * the kid taps it to play. "Always": auto-narrate when sound is on. "Never":
 * no auto-read, but the button stays visible (never hide the kid's tool).
 *
 * Never gated behind a parent setting — this is the kid's tool. Mount it on
 * the home screen (first-run surface) so every kid sees it exactly once.
 * Works fully offline (device-local storage; no network).
 */

import { useState } from "react";
import { setReadAloudPref, shouldAskReadAloudPref } from "@/game/age-profile/read-aloud-pref";
import type { ReadAloudPref } from "@/game/age-profile/read-aloud-pref";

export interface ReadAloudPrefPromptProps {
  /** Called after the kid answers (e.g. to continue onboarding). */
  onAnswered?: (value: ReadAloudPref) => void;
}

const OPTIONS: { value: ReadAloudPref; label: string; sub: string }[] = [
  { value: "always", label: "Always", sub: "Read every story to me" },
  { value: "sometimes", label: "Sometimes", sub: "I'll tap the speaker myself" },
  { value: "never", label: "Never", sub: "I'll read them myself" },
];

export function ReadAloudPrefPrompt({ onAnswered }: ReadAloudPrefPromptProps) {
  const [answered, setAnswered] = useState(false);

  // Asked once, never nags: answered here or in a previous boot → gone.
  if (answered || !shouldAskReadAloudPref()) return null;

  const choose = (value: ReadAloudPref) => {
    setReadAloudPref(value); // persisted before anything else
    setAnswered(true);
    onAnswered?.(value);
  };

  return (
    <section className="agep-pref-prompt" aria-labelledby="agep-pref-q">
      <h2 id="agep-pref-q" className="agep-pref-q">
        Do you like stories read aloud?
      </h2>
      <div className="agep-pref-options" role="group" aria-label="Read-aloud preference">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="agep-pref-option"
            onClick={() => choose(opt.value)}
          >
            <span className="agep-pref-label">{opt.label}</span>
            <span className="agep-pref-sub">{opt.sub}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
