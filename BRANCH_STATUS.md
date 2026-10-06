# BRANCH_STATUS.md — feat/comet-mascot

Comet, the star-dragon pup, hosts the Chart Room home page: cursor-tracking
mascot + once-per-day TTS greeting bubble. Home page only.

## Done
- [x] `src/components/comet-greetings.ts` — 12 greeting lines (narrative-designer owned;
      suspense/excitement movie-trailer tone, `avocado_v2:casper` voice), day-of-year % 12
      index, `meridian.cometGreeting.lastDate` helpers, audio URL builder.
- [x] `src/components/comet-mascot.tsx` — inline-SVG Comet (adapted Chart Room Crew art),
      8-sector cursor tracking + 70px dead zone + 0.12 hysteresis (fine-pointer only),
      WAAPI squash-and-stretch boop (420ms), blink every 4–7s, 4-boop dizzy easter egg,
      prefers-reduced-motion → static pose, no tracking, no idle.
- [x] `src/components/comet-greeting.tsx` — daily bubble implementing all 6 locked
      designer decisions (sound-on sync w/ 150ms audio lead, sound-off + speaker opt-in,
      autoplay gesture gate w/ 3s sync window, dismiss rules, once-per-day, reduced-motion).
- [x] `src/components/comet-mascot.css` — 120–140px desktop / 72–88px mobile / 64px short
      viewports; fixed bottom-right; z-40; pointer-events gated; transform/opacity only.
- [x] Mounted in `Choose` (Chart Room home) in `game-app.tsx` — not in game, review, or GeoDetective.
- [x] `tests/e2e/helpers.ts` — added `.mp3 → audio/mpeg` MIME so the built artifact serves greeting audio.
- [x] E2E: `comet-mascot.desktop|mobile|reduced.spec.ts` (render size/placement, CTA overlap,
      boop, dizzy, tracking on/off, once-per-day, autoplay gate, speaker opt-in, no console errors).
- [x] Gates: `tsc` clean; gzip 10.2KB / 15KB budget.
- [x] Audio: 12 regenerated `public/audio/comet/greet-*.mp3` (casper voice, 459KB) — committed
      by parent as 8211183; lines module updated to match.

## Pending
- [ ] `npm test` full unit suite (running)
- [ ] `node scripts/lint-cards.mjs` gate
- [ ] `npm run build:pages` production build
- [ ] Playwright E2E (serialized via `flock ~/workspace/.e2e.lock --workers=1`)
- [ ] Open PR (base: main) — DO NOT MERGE

## Notes
- No new npm packages; no external assets (mp3s are the approved exception).
- Greeting lines live in `comet-greetings.ts` so the narrative designer can rewrite
  text without touching component logic; index ↔ mp3 pairing is positional.
- Voice note: `avocado_v2:casper` is an original voice — never described as a
  celebrity impression in code or UI.
