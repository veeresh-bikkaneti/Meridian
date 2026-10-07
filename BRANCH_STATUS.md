# BRANCH_STATUS — feat/grandpa-tasting-tour

Grandpa's Tasting Tour (Veeresh 2026-10-07): rework of Grandpa's Coffee Run
into a guided tasting tour on mobile (≤1023.5px). Desktop ≥1024px keeps the
current walk/kettle/park behavior.

## Screenplay (mobile only)
- Beat 0: brass compass-rose origin node top-left (~1s after load, after the
  staggered entrance).
- Beat 1: grandpa walks a dotted S-trail through the gutters, STOPS at each
  option (difficulty → GeoDetective → editions → review if present), turns to
  face it, sips ~1.2s, walks on. Silent, not tappable mid-walk. Hard-capped
  25s. Trail: 2px, 6/6 dash, round caps, brass@60% / ink-bronze@60%, ≥16px
  from interactive rects, never on/behind cards.
- Beat 2: top-up at the pour waypoint above the park strip — the existing
  gooseneck-kettle dolly-vertigo pour (scale 0.25→2.6x, mug fill + steam).
- Beat 3: settle — sits on the bench beside Comet; trail fades to ~18% over
  ~2s; donation cloud fades in with Veeresh's exact copy
  ("Grown-ups — buy me a coffee? ☕" / "Your support keeps Meridian free
  for kids"). Tap → in-cloud gate → Continue opens Ko-fi → reverts;
  Cancel/Esc reverts. Ask once per session (sessionStorage).
- Return visits (same calendar day): faint trail, already seated, no replay
  (localStorage `meridian.grandpaTour.lastDate`, local YYYY-MM-DD).
- Fallback ladder: full weave → straight trail → current strip walk →
  hidden. Never redraw mid-walk; resize mid-walk settles immediately.

## Done
- [x] Branch created from origin/main
- [x] Read grandpa-coffee-run.tsx/css, game-app home, E2E conventions
- [x] game-app.tsx: 4 data-testids (difficulty, geodetective, editions, review)
- [x] comet-greetings.ts index 3 retext
- [x] src/components/grandpa-tour.ts (pure geometry) + 10 unit tests green
- [x] grandpa-coffee-run.tsx: extracted GrandpaFigure/GrandpaKettle, Veeresh's
      exact cloud copy, cheers-text removed, tour state machine + TourLayer,
      strip tour modes, once-per-day + once-per-session gating
- [x] grandpa-coffee-run.css: tour layer/trail/compass/walker, tour kettle
      triggers, data-tour strip rules, cloud sizing per brief
- [x] playwright.config.ts: grandpa-tour project; new spec
      tests/e2e/grandpa-tasting-tour.spec.ts
- [x] Updated existing specs (desktop/mobile/reduced copy; cheers assertions
      removed; mobile-home-overlap copy)
- [x] tsc clean; npm test 847 green; lint-cards GATE PASSED; build:pages green
- [x] E2E fixes: parked-bench measure (data-mode gate), pour geometry,
      straight-trail toggle dodge, getScreenCTM probe, handoff-timeout
      cancelled-flag bug, seed-arg + dwell-window fixes
- [ ] E2E full tour spec re-run (running)
- [ ] Regression: grandpa desktop/mobile/reduced, comet, tutorial,
      mobile-home-overlap

## Pending
- [ ] Open PR (Veeresh merges)
