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

## P2 sweep (owner approved 2026-11-16)

- **Item 40** — one vocabulary, swept across this stream's pages
  (boot splash, Credits, Privacy, Contact, home journal surfaces):
  US English — "caregivers" (was "carers") on Contact, Credits and
  Privacy; "license(s)" (was "licence(s)") throughout Credits.
  Age ranges take a hyphen ("7-10", "10-18", "18+") — the style the age
  picker already uses ("Ages 7-10"), and Privacy already matched.
  Small headings on Credits/Privacy were already sentence case; no
  "Maths" anywhere in scope. **Badge rule (from Stream S's Badge,
  `src/components/ui/badge.tsx`): a badge says the state of the case —
  "New" = never played, "Done" = finished; "Open" is retired.**
  Offenders outside this stream's files, listed not edited:
  `src/components/game-app.tsx` still renders a GeoDetective chip
  reading "Open" (Stream N's file) — swap it for the shared Badge.
- **Item 41** — Contact's grown-up check: the gate now speaks the shared
  site type (`.agep-screen` sets Karla; `.agep-h1`/`.agep-question` set
  Fraunces — no more platform system font); the check's action buttons
  are centred (`.agep-actions-centre` on the gate only); the lazy gate
  chunk no longer opens to a blank page — Contact shows a page-toned
  skeleton in the gate's shape (`GateSkeleton`, `aria-busy`).
  Gating audit: only surfaces that send something are gated — Contact's
  form (sends) and the Ko-fi coffee run (money) are gated; Board,
  Credits and Privacy send nothing and are not gated; the age-settings
  gate stays as an accidental-change guard (its documented purpose).
  Same blank-wait pattern outside this stream's files, listed not
  edited: `AgeProfileSettings.tsx` mounts its lazy gate with
  `Suspense fallback={null}` twice.
- **Item 42** — home journal: the teaser card no longer repeats the
  "What the land remembers" heading (the journal section carries the
  one title; the card keeps its "Latest Journal Entry" label and
  "Now showing" line); the movie loading still now sits on a page-toned
  skeleton (`--surface-2`) instead of a black box; rotation now also
  pauses while the journal card or section is on screen
  (IntersectionObserver → `journalOnScreen` blocker in
  `shouldApplySetChange`, on top of the existing focus blockers) and a
  deferred entry lands as soon as both leave the screen.
- **OG line** — `src/lib/og/site.json` description now reads "Free
  geography, math and science game for kids", matching item 38 (found
  by PR 522's Phase 3 reviewer).

## Handoff

- Done: items 38, 39 (above) + P2 sweep 40, 41, 42 and the OG line.
- Open: the item 39 sentence is the owner's call — flagged in the PR.
- Ruled out: touching any other Privacy policy text (item 39 says only
  the one claim changes); editing other streams' screens for item 40/41
  offenders (listed above instead).
