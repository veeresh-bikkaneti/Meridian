# Stream K — copy and small pages

Branch `fix/ui-copy-sweep`. Base main `2ce6757a` + Stream S cherry-picks
`a0458929`, `cc745790`. Items 38–42. Owner of `boot-splash.tsx`,
`privacy.tsx`, `contact.tsx`, `credits.tsx` (Phase 0 doc).

## Done

- **Item 38** — the game is geography, math and science now, and the copy
  says so: boot splash eyebrow "Daily geography" → "Geography, math and
  science" (`boot-splash.tsx`); "free geography game" → "free geography,
  math and science game" on Credits and the Privacy intro. The hydration
  e2e pin (`tests/e2e/hydration-boot.desktop.spec.ts`) now expects the new
  splash string, updated in the same commit.
- **Item 39** — Privacy's short-version bullet no longer claims "we never
  ask a player for … age". It now says the game asks for an age band
  (7-10, 10-18, or 18+), saved only in this browser, used to pick the
  difficulty and the cases the player sees, never sent to us. Facts checked
  in code before writing: the band lives in localStorage
  (`meridian.ageProfile.v1`, `src/game/age-profile/store.ts`) and drives
  `src/game/age-profile/difficulty.ts`. No other policy text changed.
  **Flagged for the owner in the PR body, in its own section.**

## Deferred (recorded, not built)

- Item 40 (one spelling/dash/badge vocabulary) — deferred in the re-price.
- Item 41 (Contact grown-up check styling/gating) — deferred in the re-price.
- Item 42 (home journal title/spinner/rotation) — deferred in the re-price.

## Handoff

- Done: items 38, 39 (above). Next: Phase 3 council review of this PR.
- Open: the item 39 sentence is the owner's call — flagged in the PR.
- Ruled out: touching any other Privacy policy text (item 39 says only the
  one claim changes).
