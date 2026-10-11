# Auto-Animate — Spec Checklist (`feat/auto-animate`)

Owner order 2026-10-11 ~07:00 CDT. Plain-language record of what was
animated, what was deliberately left alone, and the guarantees.

## What was animated (enter / exit / move only)

- [x] **GeoDetective screen container** — the confirm sheet ("Guess this
      place?") now fades/slides in and out, the win/loss case card animates
      in when a case closes, the "Your guesses" section animates in on the
      first guess, and hint/notice lines under the map fade in.
- [x] **GeoDetective guess list** — each new guess row glides in at the top
      and the existing rows shift down smoothly (instead of jumping).
- [x] **GeoDetective search suggestions** — as the kid types, matching
      place rows fade/slide in and out of the dropdown list.
- [x] **One shared hook** (`src/hooks/use-auto-animate.ts`) — everything
      above goes through the same hook, so the motion behaves identically
      everywhere and there is exactly one place to change it.
- [x] **Dependency pinned** — `@formkit/auto-animate` is now locked at
      exactly `0.10.0` (no caret), the version that passed the security
      audit. Future installs cannot drift past the audited code.

## The reduced-motion guarantee (non-negotiable)

- [x] If the device is set to **reduce motion**, the hook enables
      **nothing** — the animation library is never even called. Content
      appears instantly and is fully usable (readable, tappable) from the
      first frame.
- [x] A kid toggling the OS setting **mid-game** takes effect immediately:
      any running animation is torn down on the spot; toggling back
      re-enables it. No reload needed.
- [x] Motion is phone-cheap: short fades/slides (~200ms) that only move
      things on screen — no layout thrashing — so a 390px phone stays
      smooth.

## Deliberately NOT animated (with reasons)

- [x] **Storyteller narration + figure** (`storyteller.tsx`) — already has
      its own enter/exit motion (220ms in / 150ms out) timed to match the
      narration dismiss timers and the reduced-motion setting. A second
      animation system would double-animate and could break narration
      timing. Left exactly as is.
- [x] **Grandpa walker / tasting tour / seated scene**
      (`grandpa-coffee-run.tsx`) — the tour runs on a carefully sequenced
      beat machine with its own timing rules; the coffee-cloud ask↔gate
      swap already animates via its own reduced-motion-safe CSS. A sibling
      branch is reworking the cloud's positioning and will rebase — kept my
      hands off so that rebase stays clean.
- [x] **Grandpa figure alone** (`grandpa-mascot.tsx`) — it is a single
      button; there is no list or panel of appearing/disappearing things
      for the animator to work on. Its tap feedback (blink + squash) is its
      own thing, untouched.
- [x] **Edition cards** (`game-app.tsx`) — the State/Country/Globe cards are
      static; they already rise in with a staggered entrance that respects
      reduced motion. Nothing appears, disappears, or reorders there, and
      that screen is also grandpa's tour territory (measured positions) —
      animating it could shift the tour's stops.
- [x] **The map itself** (`LoopMap.tsx`) — the distance rings are drawn on
      the map canvas, not as page elements; nothing for the animator to do.
      Untouched.
- [x] **Clue reveals** — already animate via the existing `Rise`
      component (reduced-motion aware). Left as is; no double animation.

## Untouched on purpose (pending your rulings)

- [x] The **idle sway** vs "no idle motion" question and the
      **theatrical 5–7s vs calm** question are still open product calls.
      This work covers enter/exit/move only and does not pre-empt either —
      no idle or theatrical CSS was added, removed, or changed.

## Verification

- [x] `npx tsc --noEmit` — clean.
- [x] `npm test` — full suite green (1104 tests, 79 suites, incl. 14 new
      runtime-path tests for the hook + GeoDetective wiring).
- [x] `npx eslint` on changed files — 0 errors (3 pre-existing warnings,
      unchanged from main).
- [x] `node scripts/lint-cards.mjs` — GATE PASSED.
- [x] `npm run build:pages` — green.
- [x] New tests walk the real runtime paths (not just "does it render"):
      the hook's effect enables the animator on the container, destroys it
      on unmount and on a mid-session reduced-motion flip, and never calls
      it under reduced motion; the GeoDetective tests drive a real guess
      (tap → sheet → confirm → row appears) and a real search (focus →
      type → debounce → dropdown) and assert the animator engaged the exact
      container — and that under reduced motion everything still renders
      and works with zero animation calls.
- [x] **Black-box journeys on the built app** (real Chromium, WAAPI
      assertions, not DOM): typing glides suggestion rows in; submitting a
      guess animates the new row in; closing a case animates the reveal
      card in. All assert `document.getAnimations()` actually played.
- [x] **Reduced-motion journey**: with `prefers-reduced-motion: reduce`
      emulated, ZERO animations run and everything is fully usable (type,
      pick, submit, read clues).
- [x] **Visual regression** (390px + 1280px vs main baselines): 5/5 mobile
      screenshots byte-identical; desktop differs only in live map-canvas
      pixels (masked chrome diff = 0). No layout shifts, no overlaps.
- [x] **Red-team pass** (6 scenarios, all green): rapid typing storm,
      3-guess submit storm, mid-animation reload (state intact, guess
      persisted), reduced-motion flip mid-animation, 390×1400 tall
      viewport (no overlaps), offline (content works, zero network).
- [x] **Screen recordings** (owner's law): motion-on journey and
      reduced-motion journey captured as video — see PR.
- [x] Existing GeoDetective E2E on the rebuilt dist: 21/22 pass. The one
      failure (win-path dialog linger) reproduced only under concurrent
      `vite build` CPU contention and is a test-harness timing artifact,
      not a product bug (exit zombie is invisible/non-interactive, clears
      in <1s uncontended; 20+ clean runs).
- [x] Pre-existing issues confirmed on main (not caused by this branch):
      React #418 hydration on the `?loop-puzzle` seam, and
      ERR_TUNNEL_CONNECTION_FAILED from the VM egress proxy.
