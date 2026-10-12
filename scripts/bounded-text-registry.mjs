#!/usr/bin/env node
/**
 * bounded-text-registry.mjs — the closed-world element registry for the
 * wrapping contract (WRAPPING_SPEC §6c).
 *
 * Every text node inside `.result-card` must have an ancestor-or-self
 * matching one of these selectors. Two kinds:
 *   - "bounded": rendered via <BoundedText> (the sanctioned text renderer).
 *   - "raw":     allowlisted raw text (icon-only / signal chips / button
 *                labels / short ledger labels) with the reason it is NOT
 *                a BoundedText. Adding a new raw text element requires a
 *                registry entry + reason — otherwise the lint Tier 3 gate
 *                and the closed-world E2E test fail the build.
 *
 * Shared by scripts/lint-cards.mjs (static gate) and
 * tests/e2e/bounded-text.mobile.spec.ts (runtime closed-world check).
 */

export const BOUNDED_TEXT_REGISTRY = [
  // ---- Bounded: the §4 adoption list ----
  { selector: ".verdict-headline", file: "src/components/result-card.tsx", tag: "BoundedText", cls: "verdict-headline", kind: "bounded", reason: "§4: verdict headline h2, variant=headline" },
  { selector: ".place-name", file: "src/components/result-card.tsx", tag: "BoundedText", cls: "place-name", kind: "bounded", reason: "§4: both .place-name h2s (fallback + hit answer), variant=place" },
  { selector: ".name-eyebrow", file: "src/components/result-card.tsx", tag: "BoundedText", cls: "name-eyebrow", kind: "bounded", reason: "§4: edition/region eyebrow, variant=body" },
  { selector: ".yourpin-name", file: "src/components/result-card.tsx", tag: "BoundedText", cls: "yourpin-name", kind: "bounded", reason: "§4: pin-ledger dd, variant=place" },
  { selector: ".truespot-name", file: "src/components/result-card.tsx", tag: "BoundedText", cls: "truespot-name", kind: "bounded", reason: "§4: pin-ledger dd, variant=place" },
  { selector: ".score-breakdown", file: "src/components/result-card.tsx", tag: "BoundedText", cls: "score-breakdown", kind: "bounded", reason: "§4: score breakdown, variant=body" },
  { selector: ".result-note", file: "src/components/result-card.tsx", tag: "BoundedText", cls: "result-note", kind: "bounded", reason: "§4: result-note, variant=body" },
  { selector: ".result-story", file: "src/components/result-card.tsx", tag: "BoundedText", cls: "result-story", kind: "bounded", reason: "§4: result-story (hit + miss), variant=body" },
  { selector: ".result-subscript", file: "src/components/result-card.tsx", tag: "BoundedText", cls: "result-subscript", kind: "bounded", reason: "§4: miss subscript, variant=body" },
  { selector: ".growth-line", file: "src/components/result-card.tsx", tag: "BoundedText", cls: "growth-line", kind: "bounded", reason: "§4: growth line, variant=body" },
  { selector: ".result-source", file: "src/components/result-card.tsx", tag: "BoundedText", cls: "result-source", kind: "bounded", reason: "§4: source link as=a, variant=url" },
  { selector: ".share-pre", file: "src/components/result-card.tsx", tag: "BoundedText", cls: "share-pre", kind: "bounded", reason: "§4: share block as=pre, variant=url" },
  { selector: ".scroll-cue-text", file: "src/components/scroll-cue.tsx", tag: "BoundedText", cls: "scroll-cue-text", kind: "bounded", reason: "§4: 'more below' cue text, variant=body" },
  { selector: ".storyteller-caption-text", file: "src/components/storyteller.tsx", tag: "BoundedText", cls: "storyteller-caption-text", kind: "bounded", reason: "§4: storyteller dock caption, variant=banner" },

  // ---- Raw: allowlisted, with reasons (spec §4 DO NOT ADOPT + nested) ----
  { selector: ".difficulty-chip", file: "src/components/result-card.tsx", tag: "span", cls: "difficulty-chip", kind: "raw", reason: "DO NOT ADOPT: nowrap signal chip beside BoundedText in the meta band" },
  { selector: ".grade-chip", file: "src/components/grade-chip.tsx", tag: "span", cls: "grade-chip", kind: "raw", reason: "DO NOT ADOPT: nowrap signal chip beside BoundedText in the verdict row" },
  { selector: ".ai-story-badge", file: "src/components/result-card.tsx", tag: "span", cls: "ai-story-badge", kind: "raw", reason: "DO NOT ADOPT: iconic disclosure, not prose (role=img)" },
  { selector: ".pin-ledger dt", file: "src/components/result-card.tsx", tag: "dt", cls: "", kind: "raw", reason: "short ledger labels ('Your pin' / 'True spot') — labels, not wrapping prose" },
  { selector: ".near-qualifier", file: "src/components/result-card.tsx", tag: "span", cls: "near-qualifier", kind: "raw", reason: "nested inside BoundedText (yourpin-name); covered by ancestor match" },
  { selector: ".sr-only", file: "src/components/result-card.tsx", tag: "span", cls: "sr-only", kind: "raw", reason: "nested inside BoundedText (verdict headline); visually hidden" },
  { selector: ".scroll-cue-dots", file: "src/components/scroll-cue.tsx", tag: "span", cls: "scroll-cue-dots", kind: "raw", reason: "DO NOT ADOPT: decorative dots, not prose (aria-hidden)" },
  { selector: ".storyteller-fallback", file: "src/components/storyteller.tsx", tag: "span", cls: "storyteller-fallback", kind: "raw", reason: "short audio-fallback line inside the dock caption container" },
  { selector: ".storyteller-word", file: "src/components/storyteller.tsx", tag: "span", cls: "storyteller-word", kind: "raw", reason: "karaoke word spans nested inside BoundedText caption; covered by ancestor match" },
  { selector: ".result-cta button", file: "src/components/result-card.tsx", tag: "Button", cls: "", kind: "raw", reason: "DO NOT ADOPT: 'Next place →' — the button owns its label and 48px tap target" },
  { selector: ".agep-listen-row", file: "src/components/result-card.tsx", tag: "ReadAloudButton", cls: "agep-listen-row", kind: "raw", reason: "DO NOT ADOPT: ghost speaker icon (44px, no text label); band-invisible by design" },
  { selector: ".result-body button", file: "src/components/share-button.tsx", tag: "ShareButton", cls: "", kind: "raw", reason: "share action button — the button owns its label (only button inside .result-body)" },
];

/** Classes that put a CSS rule in "result-card scope" for the §6c.3 guardrail. */
export const CARD_TEXT_CLASSES = [
  ...new Set(
    BOUNDED_TEXT_REGISTRY.flatMap((e) =>
      (e.cls || "").split(/\s+/).filter(Boolean),
    ),
  ),
];

/**
 * Subset of CARD_TEXT_CLASSES used for the §6c.3 CSS scope check.
 * Generic utilities (sr-only) are EXCLUDED: the guardrail targets the
 * card's own text selectors, not app-wide utilities that happen to
 * render inside the card (the sr-only visually-hidden pattern REQUIRES
 * overflow:hidden + nowrap — flagging it would be a false positive).
 */
export const CSS_SCOPE_CLASSES = CARD_TEXT_CLASSES.filter(
  (c) => c !== "sr-only",
);
