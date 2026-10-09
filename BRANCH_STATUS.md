# BRANCH_STATUS — fix/kofi-cloud-mobile

Owner: Dinesh · Branch: `fix/kofi-cloud-mobile` · Base: origin/main @ 64c82d6
· Created: 2026-10-09. **DO NOT PUSH, DO NOT MERGE** — scrum master pushes
after gates; owner merges (PR #111).

Standing rules: named-file staging only, never `git add -A`. Locked Ko-fi
copy must stay byte-identical (verified by grep after every edit):
`Grown-ups — buy me a coffee? ☕` · `Your support keeps Meridian free for kids` ·
`Grown-ups — buy me a coffee? Activate to learn how to support Meridian.`

## Done (prior squad, ce193c8 — "shorten mobile tasting tour so the donation cloud appears sooner")

Option B (Game Designer + UI/UX Expert reconciled spec). Mobile tour only;
desktop strip untouched.
- `src/components/grandpa-coffee-run.tsx` ONLY:
  - `TOUR_JOURNEY_CAP_MS` 25_000 → 10_000; `TOUR_TARGET_MS` 20_000 → 6_000
  - `TOUR_SIP_MS` 1200 → 800; `TOUR_POUR_MS` unchanged (2800)
  - `measureTour` stops: difficulty → geodetective → editions (dropped review)
- E2E spec timing updates to match (sip-dwell sampling gap 450ms → 250ms).
- Explicitly untouched: showCloud logic, once-per-session gate, handoff end
  state, gate copy, offline/no-URL fail-closed, skip button, reduced-motion.

## Done (fix squad, 2026-10-09 — PR #111: cloud visibility, walker a11y, sip sync)

Files changed:
- `src/components/grandpa-coffee-run.css`
- `src/components/grandpa-coffee-run.tsx`
- `tests/e2e/grandpa-tasting-tour.spec.ts` (new regression test + stale
  header-comment fixes)

### Fix 1 — cloud visible + sensibly positioned during the tour
Empirically verified in Chromium (390×844, touch): at HEAD the cloud was
ALREADY visible during the tour (opacity 1, translate(-50%,0)) — the
"invisible whole walk" premise was stale; the mobile media query
(`max-width: 1023.5px`) has forced it visible since 7de5cc8. BUT the cloud
was clipped ~46px off the right viewport edge (centered on the parked
walker at the strip's right edge; screenshot proved the cut-off copy).
- Added `.grandpa-scene[data-mode="tour"] .grandpa-donation-bubble` reveal
  rule mirroring the seated reveal's transition (mode-scoped guarantee).
- Right-anchored the bubble to the walker (`left:auto; right:-8px`) and
  re-seated the tail over grandpa (`right:40px`) in the tour-mode rule AND
  the mobile media-query rule; added a mobile seated override neutralizing
  the desktop `translate(-50%)` so the tour→seated handoff doesn't jump.
- Stale CSS header comment updated (sip ~0.8s, 10s cap, no review stop,
  cloud visible from the first beat, walker not a tap target mid-tour).

### Fix 2 — walker non-interactive during tour (option A)
- `walkerInteractive = showCloud && mode !== "tour"`: no role/tabIndex/
  onClick/onKeyDown on the parked strip walker while the tour runs.
- CSS: `.grandpa-scene[data-mode="tour"] .grandpa-walker { pointer-events:
  none; cursor: default; }` — taps fall through; the bubble keeps
  `pointer-events:auto` so its ask button stays the gate entry.
- Stale tsx comment ("tappable walker is the parked strip figure…")
  rewritten to describe the new behavior.
- Accessibility Auditor sign-off 2026-10-09: "Option (a) approved. No focus
  moves into hidden content (WCAG 2.4.3/3.2.1 intact — openCloudGate's
  focus-Continue is unreachable mid-walk); tab order is Skip → visible ask
  button; no keyboard trap; pointer-events can't dead-end taps; cursor no
  longer promises a tap. Screen-reader order is coherent: tour layer is
  aria-hidden, the walker figure's SVGs are aria-hidden, the cloud ask
  button carries its label."

### Fix 3 — sip animation synced to the 800ms dwell
- CSS `sip-drink` 1.2s → 0.8s (matches `TOUR_SIP_MS`). Game Designer call
  2026-10-09: 800ms still reads as a deliberate sip (raise/hold/lower
  keyframes intact); extending the dwell would push against the 10s tour
  cap — tour budget wins. Stale "1.2s" comments updated in CSS + spec header.

### Gates
- `npx tsc --noEmit` clean
- `npm test` 977/977 pass
- `node scripts/lint-cards.mjs` GATE PASSED
- `npm run build:pages` green (rebuilt with `VITE_KOFI_URL` for e2e)
- Playwright `grandpa-tour` project: 23/25 pass — the 2 failures
  ("walker stops at each option", "no snap-to-top") also fail on the clean
  base ce193c8 (verified via stash + rebuild): pre-existing timing flakes
  under VM load, unrelated to this change. The NEW regression test
  ("tour: cloud visible from the first beat, walker not a tap target
  mid-walk") passes.
- Playwright `mobile` project (grandpa-coffee-run.mobile): 3/3 pass —
  incl. the gate-viewport assertion (gate ≤392px) the positioning fix
  addresses.
- Playwright `desktop` project: 7/8 pass — "walk has no cloud, kettle…"
  misses the transient kettle beat; also fails on the clean base
  (verified via stash + rebuild): pre-existing flake, unrelated (this
  change doesn't touch the beat machine or desktop strip mode).
- Playwright `reduced` project: 1/2 pass — "seated and fully static"
  fails the walker-left-of-Comet assertion (1408 > 1072); also fails on
  the clean base (verified via stash + rebuild): pre-existing, unrelated
  (reduced project is 1440px wide — the mobile media-query changes can't
  apply; tour mode never runs under reduced motion).
- Live Chromium verification (dev server, 390×844 touch): mid-tour the
  cloud is opacity 1/visible at x=146..366 (fully on-screen); the walker
  has no role/tabindex, pointer-events none, cursor default; the sip
  animation runs `sip-drink` at 0.8s × 1.

### Follow-ups for the mobile QA check (not in scope, noted)
- Desktop seated cloud has the same centering overflow (~36px clip at the
  viewport's right edge) — pre-existing, desktop-only, left untouched.
- Visual check on a real phone: cloud sits right-anchored above the parked
  walker in the strip band, tail pointing at grandpa, fully on-screen at
  360/390px; tap the walker mid-walk does nothing; tap the cloud opens the
  gate; sip reads as one deliberate drink at each stop.
