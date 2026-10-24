# BRANCH_STATUS — fix/footer-row-alignment

**Branch:** `fix/footer-row-alignment`
**Base:** origin/main @ `d2b643e`
**State: CURED — panel round 1 returned NOT READY on a records
contradiction (this file's E2E bullet vs the PR body); the
bullet now carries the terminal record, verified below.
Awaiting the panel re-vote and the owner's merge word.** One
CSS file changed; no DOM, copy, or component changes. It
supersedes the previous contents of this file (the
`docs/232-verification-record` branch record, whose history
lives on its own PR).

## The bug

On the home footer link row, the two `<button>` items
("🔒 For grown-ups", "🗺️ Take the tour") rendered their text
~11.5px lower than the two `<a>` items ("Privacy",
"Contact us (grown-ups)"), even though all four boxes were
perfectly aligned. Owner screenshot; verified on the
production build (buildId `d2b643e`).

## Root cause (measured, not guessed)

Computed styles on the production build were **identical** for
buttons and links — font-family Karla, font-size 14px,
line-height 21px, padding 0 16px — and all four boxes sat at the
same y with height 44px. The difference was inside the box:
Chromium vertically centers a `<button>`'s content on its own
(text rect +13.5px from the box top = exactly centered in
44px), while a link's line box rides at the top of the 44px
min-height box (text rect +2.0px). `.agep-footer-link` set the
shared box but never normalized how the content sits in it.

## The fix

`src/components/age-profile/age-profile.css` — `.agep-footer-link`
only: added `display: inline-flex; align-items: center;
justify-content: center;` (with an explanatory comment), so
both element types center their text identically in the 44px
box. Nothing else touched.

## Measurements (Playwright, built artifact, serveBuiltArtifact)

1280px, pre-fix → post-fix (box y / text-rect y):

| item | box y | text y pre | text y post |
| :--- | :--- | :--- | :--- |
| grown-ups (button) | 407.08 | 420.58 | 420.58 |
| take-tour (button) | 407.08 | 420.58 | 420.58 |
| privacy (link) | 407.08 | 409.08 | 420.58 |
| contact (link) | 407.08 | 409.08 | 420.58 |

Pre-fix text spread 11.5px → post-fix spread **0.0px**.

390px (row wraps 2+2, as before): text offset from each box
top was +13.5px (buttons) vs +2.0px (links) pre-fix; post-fix
**+13.5px on all four**.

768px horizontal overflow: scrollWidth 824 vs innerWidth 768
**both pre- and post-fix** — pre-existing on main, not worse.

## Gates (this branch)

- `npx tsc --noEmit` — clean.
- `npm test` — scripts **810 pass / 0 fail**, src **1479 pass /
  0 fail** — the main baselines.
- `node scripts/lint-cards.mjs` — **GATE PASSED**.
- `VITE_KOFI_URL=… npm run build:pages` — green.
- E2E (`--workers=1`, `VITE_KOFI_URL` at build + test time):
  batch 1 (grownups-privacy-contact, age-profile-gate,
  home-visual-layout) — **17 passed**; grandpa-coffee-run
  desktop/mobile/reduced + mobile-home-overlap — passed;
  home-badges-readaloud's batch — terminal record **exit 0,
  22 passed**; home-badges-readaloud solo — **8/8 green on
  this branch's build and 8/8 on unmodified main** (solo run
  re-verified 8/8 on this branch's build during the cure
  round).

## Pending

- Panel re-vote on the cured tip.
- Owner's merge word. Only the owner merges.
