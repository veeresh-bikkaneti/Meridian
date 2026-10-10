# BRANCH_STATUS — feat/storyteller-grandpa-mascot

Branch: `feat/storyteller-grandpa-mascot` · Base: origin/main @ ce88939
· Created: 2026-10-10. **PUSH OK, DO NOT MERGE** — merge is the owner's
(Chitti's) call, per standing policy.

Owner approval 2026-10-10: replace the storyteller's circular-masked JPEG
with the Grandpa mascot (page-mascot, MIT, scanned clean — 52-character
rig, 9-direction cursor-tracking + 9-reaction sheets, transparent bg).

Standing rules: named-file staging only, never `git add -A`. Leave
`.scrum-evidence/`, `workers/crash-report/package-lock.json`, and
`public/images/storyteller/homer-v2.svg` alone.

## Hard owner rulings (2026-10-10 — do not redesign)

1. Figure-tap = pause/resume narration. Button keeps
   `className="storyteller-figure"`, `data-testid="storyteller-figure"`,
   aria-label, onClick. Settled.
2. Speaker-toggle mute stays a separate feature. Untouched.
3. Tap choreography: pause/resume is the tap's job; the mascot reaction is
   a subordinate visual ack ONLY — tap → onToggle() + ~180ms 'blink'
   flash + squash bounce (skipped under prefers-reduced-motion). The
   dizzy-after-4-taps cycle is DELETED; no payoff cycle
   (heart/sparkle/delighted) on tap.
4. Cursor tracking is desktop-only, gated on
   `matchMedia('(hover: hover) and (pointer: fine)')` exactly like the
   skill. Touch/mobile: static center cell, no listeners.
5. Accessibility: real `<button>`, aria-label preserved, keyboard
   operable, focus-visible outline kept.

## Done (implementation, 2026-10-10)

- Assets: `public/images/storyteller/grandpa-directions.webp`,
  `grandpa-reactions.webp` (1080×1080 RGBA, 3×3 grid, from the
  owner-approved grandpa sheets), and `grandpa-static.webp` (center cell
  crop for the light banner shell). `storyteller.jpg` stays on disk;
  `public/sw.js` and `public/assets/storyteller/storyteller-assets.json`
  untouched.
- `src/components/grandpa-direction.ts` (new): pure DOM-free sector math —
  `directionForPointer(dx, dy)`, `GRANDPA_DIRECTIONS` (row-major),
  `directionCellIndex`, `DIRECTION_DEAD_ZONE` (70px), `DIRECTION_SECTOR`.
- `src/components/grandpa-mascot.tsx` (new): `GrandpaMascot`
  `{ label, onToggle, onLoaded?, className? }`. Renders the
  `<button className="storyteller-figure" data-testid="storyteller-figure">`
  with two inner sprite layers (`storyteller-figure-directions` /
  `-reactions` testids, background-size 300%). Preloads the directions
  sheet with `new Image()` → `onLoaded` on resolve (keeps the
  `storyteller_ready` milestone). Desktop-only cursor tracking with sector
  hysteresis; tap = onToggle + blink + squash (no dizzy, no payoffs).
- `src/components/storyteller.tsx`: `StorytellerMascot` now renders
  `<GrandpaMascot>`; the `src` prop and `<img>` are gone.
- `src/components/storyteller-home.tsx`: caller no longer passes `src`;
  `pose` removed from `ResolvedAssets`, initial state, and the manifest
  effect (send-off still uses `assets.pointing`; manifest loading kept).
- `src/components/storyteller-lines.ts`: added `grandpaDirectionsUrl()`,
  `grandpaReactionsUrl()`, `grandpaStaticUrl()`; removed
  `storytellerFigureUrl()`.
- `src/components/storyteller-banner-shell.tsx`: error-boundary fallback
  `<img>` now uses `grandpaStaticUrl()`.
- CSS: `storyteller-mascot.css` — removed `border-radius: 50%` +
  `overflow: hidden` from `.storyteller-figure` (now `position: relative`
  for the absolute layers); `box-shadow` replaced with
  `filter: drop-shadow(0 6px 18px rgba(0,0,0,.35))` on `.mascot-squash`
  (follows the alpha); deleted the `.storyteller-figure img` rule; added
  `.storyteller-figure .mascot-layer { position: absolute; inset: 0; }`;
  header comment updated (no longer "Interim art: circular-masked JPEG").
  All motion (entrance, breath, poke startle, yield recede, idle sway)
  survives — transform/opacity-only, reduced-motion-gated, still keyed off
  the button. `storyteller-home.css`: the error-boundary static figure
  lost its circular mask (`object-fit: contain` for the transparent webp);
  the skeleton keeps its shimmer circle. The speaking-shimmer `::after`
  ring still positions against the button (never assumed an img).
- Tests:
  - `src/components/grandpa-mascot.test.ts` (new, registered in `npm
    test`): directionForPointer cardinals/diagonals/dead-zone/boundary,
    row-major cell order, the three URL helpers.
  - `src/components/storyteller.test.ts`: URL assertions rewritten for
    the three grandpa helpers.
  - E2E `tests/e2e/storyteller-home.desktop.spec.ts`: cursor tracking —
    eyes leave center on mouse-left, return to center in the dead zone.
  - E2E `tests/e2e/storyteller.spec.ts`: figure tap pauses ("Resume the
    story") and resumes ("Pause the story") narration via the stalled-mp3
    deterministic setup. Also: the spec's `expectCleanConsole` now
    ignores `ERR_TUNNEL_CONNECTION_FAILED` — the crash-report beacon's
    fetch fallback posts to an external worker this VM's egress cannot
    reach (worker was healthy 2026-10-09; unreachable since — forced
    environmental failure, same precedent as the spec's existing
    `net::ERR_FAILED` ignore, not an app bug).
  - E2E `tests/e2e/storyteller-home.mobile.spec.ts`: no cursor tracking
    on touch — directions layer stays centered after pointer moves.

## Done (frontend cosmetic review, 2026-10-10 — owner directive)

Review cell (UX Researcher lead, UI Designer, Frontend Developer, UI
Finish-Gate Reviewer, Accessibility Auditor, Code Reviewer, Reality
Checker, Persona Walkthrough Specialist) audited the rebuilt dist with
Playwright screenshots + bounding-box overlap measurements at 390px and
1280px: banner figure vs h1 vs popover vs dismiss vs sound toggle, and
story-card dock figure vs caption vs speaker/replay controls.

Findings — NO overlapping/broken elements; nothing to fix:
- Banner @390px and @1280px: figure↔h1, figure↔popover, dismiss↔sound
  toggle, popover↔sound toggle all measure 0px² overlap. (The dismiss
  button sits inside the popover by design — its overlap with the popover
  is intentional.)
- Story card @1440px and @390px: figure↔caption 0px²; the speaker button
  straddles the caption's top-right edge by design (same as before).
- The docked figure peeks above the result card exactly like the old
  circular art did — same size clamps, same translateY(-40%); the
  drop-shadow follows the mascot's alpha.
- Accessibility: real `<button>`, aria-labels ("Pause/Resume the story",
  "Pause/Resume the greeting") preserved, keyboard operable,
  `:focus-visible` 3px brass outline kept; sprite layers aria-hidden.
- The speaking-shimmer `::after` ring still draws against the button
  (never assumed an `<img>`); reduced-motion path verified by the
  reduced spec (fade-only, no float).
- Two real bugs found and fixed during this phase (not cosmetic):
  1. `ERR_TUNNEL_CONNECTION_FAILED` console error in storyteller.spec.ts —
     the crash-report beacon's fetch fallback posts to an external worker
     this VM's egress cannot reach (healthy 2026-10-09, unreachable since).
     Forced environmental failure, not an app bug: the spec's
     `expectCleanConsole` now ignores it, following the file's existing
     `net::ERR_FAILED` precedent.
  2. Pause-during-buffering false failure — `audio.pause()` while `play()`
     was still pending rejected with AbortError, and `.catch(onFail)`
     flipped the narration to "failed". `isPlayAbort()` now swallows the
     abort in both the initial-play and resume paths. The new pause/resume
     e2e test (stalled-mp3 setup) walks this exact path as its regression
     test.

## Gates (final, 2026-10-10)

- `npx tsc --noEmit` — clean
- `npm test` — 1088/1088 green (13 new: directionForPointer ×7, cell
  order, URL helpers)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green (dist rebuilt after the last src change)
- Playwright on rebuilt dist: storyteller.spec.ts 6/6 ·
  storyteller-home.desktop.spec.ts 3/3 · storyteller-home.mobile.spec.ts
  21/21 · storyteller-home.reduced.spec.ts 2/2 — zero console errors
  (modulo the documented environmental beacon ignore)

## Pending

- Chitti review + merge (only merge path). Zero conflicts with main.

## Planned follow-up (NOT in this PR)

- @formkit/auto-animate is OUT OF SCOPE for this PR per owner 2026-10-10.
  No dependency added, no animation code using it. The owner will
  consider auto-animate only after this PR is merge-ready.
