# BRANCH_STATUS — feat/auto-animate

Branch: `feat/auto-animate` · Base: origin/main @ 51ed7f5 · Created: 2026-10-11.
**PUSH OK, DO NOT MERGE** — owner merges.

Owner order 2026-10-11 ~07:00 CDT: wire @formkit/auto-animate into the game
(enter/exit/move transitions only), with a hard reduced-motion guarantee.

## Done

- `src/hooks/use-auto-animate.ts` (new) — the ONE shared hook. Wraps
  @formkit/auto-animate (pinned exact `0.10.0`, the audited build — caret
  removed from package.json, lockfile refreshed). prefers-reduced-motion:
  the library is never called (zero animation, instant usable content);
  mid-session OS flips tear down / re-enable live. 200ms ease-out,
  transform/opacity WAAPI keyframes only (phone-cheap). destroy() on
  cleanup (no leaked observers). Enabling lives in its own dedicated
  effect (chained-timer law). `animate` param = test injection.
- Wired (4 hook instances):
  - `src/game/loop/LoopScreen.tsx` — screen container (PlaceSheet
    enter/exit, LoopReveal case transition, "Your guesses" first appear),
    map section (hint/notice paragraphs), guesses `<ol>` (row prepend +
    FLIP shift). Added `data-testid="loop-screen"` / `"loop-guesses"`.
  - `src/game/loop/guess-input.tsx` — suggestion `<ul>` (rows
    appear/disappear while typing). Added `data-testid="loop-suggestions"`.
- Deliberate leave-outs (reasons in SPEC_CHECKLIST.md): storyteller
  narration/figure (own motion contract + narration timers),
  grandpa-coffee-run walker/tour/seated + cloud (beat machine; cloud pane
  already CSS-animated; sibling branch rebasing), grandpa-mascot (single
  button), edition cards (static + tour-stop territory), LoopMap canvas,
  clue reveals (already animated via Rise). Open motion rulings (idle
  sway, theatrical 5–7s) untouched.
- Tests: 14 new, all runtime-path (react-test-renderer + injected fake
  animator + recording module stub; createNodeMock keyed by testid):
  `src/hooks/use-auto-animate.test.ts` (9, incl. RC2 options-stability),
  `src/game/loop/guess-input-animate.test.ts`
  (2: real focus→type→debounce→dropdown path), `src/game/loop/loop-screen-animate.test.ts`
  (3: real deal→tap→sheet→confirm→guess-row path; reduced-motion content
  still usable with zero animation calls). Registered in `npm test`.
- Dev deps added: `react-test-renderer`, `@types/react-test-renderer`.
- SPEC_CHECKLIST.md — plain-language owner checklist.
- Scrum review DONE 2026-10-11: APPROVE WITH REQUIRED CHANGES; both RCs
  landed (fb04a2d feature+pin, ac91359 options-stability).

## Gates (final head)

- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — 1104 pass, 0 fail (14 new)
- [x] `npx eslint` on changed files — 0 errors (3 pre-existing warnings)
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — green

## Verification (verification cell, 2026-10-11)

- [x] Black-box journeys (WAAPI assertions): typing glides rows in,
      guess submit animates row in, case close animates reveal in.
- [x] Reduced-motion journey: zero animations, fully usable.
- [x] Visual regression 390px+1280px vs main: no unintended diffs.
- [x] Red-team 6/6: typing storm, submit storm, mid-animation reload,
      reduced-motion flip, tall viewport, offline.
- [x] Screen recordings (motion-on + reduced) captured.
- [x] Existing GeoDetective E2E: 21/22 (1 contention-only flake, not a bug).
- [x] React #418 hydration + tunnel failures confirmed pre-existing on main.

## Pending (not mine)

- Independent reviewer verdict (Chitti/owner's panel) — per constitution.
- Owner merge decision — PR opened by verification cell, never merged by it.
