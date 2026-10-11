# Place-Card Collapse Redesign — Spec Checklist

Owner order 2026-10-11 ~13:19 CDT (direction updated ~13:25): *"Hide place
card we design it differently so it doesnt take whole screen. Use ux and ui
skills along with motion animation to get this fixed."*

The problem, from the owner's phone (390px): the question card filled most
of the viewport and covered the map. Tapping "Hide place name" hid only
the text — the card kept its footprint. The "End game" pill overlapped the
card's X close button.

## What changed

1. **The card is compact by default on mobile.** On viewports ≤640px the
   card opens in its `collapsed` state: meta band (eyebrow + difficulty
   chip + X) + place name + "Show instructions" toggle. The name region is
   capped at `min(24dvh, 12rem)`, so the card can never fill the screen.
   Desktop (>640px) still opens the full card with instructions.
   - `game-app.tsx`: new `defaultBubbleView()` helper feeds the state
     initializer, the per-place reset, and replay — one source of truth.
2. **The name never folds away.** The place name IS the question, so it
   stays visible in every card state. Only the *instructions* (the gesture
   hint) fold behind the toggle. The toggle was renamed to say what it
   does: "Show instructions" / "Hide instructions" (the old "Hide place
   name" label was the owner's exact complaint — it hid text, not card).
3. **End game docks bottom-right.** It used to sit at the bottom of the
   top-right score stack, where its y-position depended on the conditional
   streak flame — at 390px it overlapped the card's X. It now docks
   bottom-right, above the drop-pin lane (`bottom: max(6.5rem,
   safe-area + 5.5rem)`), min-height 44px, and only renders during the aim
   phase so it never floats over the result sheet. E2E asserts 0px² overlap
   with the X via bounding-box geometry.
4. **Motion:** the toggle transition is the hint paragraph's own
   snap-settle reveal (250ms) + the chevron (snap-settle opening,
   `--ease-accel-exit` closing), transform/opacity only. The curves are
   vendored as `.pcard`-scoped custom properties because
   `motion-tokens.css` is not on main yet (PR #133 open) — no dependency on
   it. The card shell deliberately does NOT remount on toggle: a remount
   detaches the scroll-region div and freezes the "more below" cue
   (spec §8.1). `prefers-reduced-motion` = instant, zero animation (CSS
   guard zeroes the chevron transition; the component keeps its
   opacity-only reduced path). One rAF effect per transition — no chained
   timers.
5. **Contracts kept:** `BubbleViewState` ("open"|"collapsed"|"dismissed")
   is unchanged; drop-pin flow, map taps, keyboard (Escape toggles,
   `aria-expanded`, named scroll region, `tabindex="0"`), and screen-reader
   behavior are intact. Game logic untouched — presentation only.

## Persona decisions

- **UX Researcher** — The old toggle lied: "Hide place name" hid the text
  but kept the footprint. The fix inverts the model: the name (the
  question) is sacred and always visible; the *instructions* are the
  foldable extra. The toggle label now names its consequence.
- **UX Architect** — Three states were already the right model; no new
  state was invented. Default-per-viewport (`collapsed` ≤640px, `open`
  above) instead of a one-size default: the phone gets the map back, the
  desktop keeps the full briefing. End game leaves the crowded top-right
  stack for a bottom-right dock — the collision was structural (the stack's
  height varies with the streak flame), so no fixed offset could fix it
  robustly.
- **UI Designer** — Frosted game chrome, pinned meta band, and the locked
  difficulty chip are untouched (spec §6.4). Compact cap `min(24dvh,
  12rem)` ≈ ≤35% of an 844px viewport; typical compact card ≈ 18%. The
  single scroll region stays mounted across expand/collapse so the
  "more below" cue never goes stale; the scrollbar stays hidden (PR #77).
  All tap targets ≥44px (X was already 44px; End game was bumped from ~30px
  to 44px).
- **UI Finish-Gate Reviewer** — Verified: zero-ellipsis contract holds on
  the name in both states (no truncate/nowrap/line-clamp); focus ring
  contract intact; reduced-motion path instant; the compact region's
  `min-height: 0` correctly overrides the open region's `max(120px, 20%)`
  floor; End game docks bottom-right during aim so it can't cover the
  question card's X, and keeps its pre-redesign top-right score-stack slot
  during story/done (the X is gone there, so it never overlapped) — never
  over the result sheet.

## Verification

- `npx tsc --noEmit` — clean
- `npm test` — full unit suite green (46/46 in question-bubble.test.ts,
  incl. new compact/motion/dock contract tests)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green
- E2E (built artifact, 390×844): `tests/e2e/place-card-redesign.mobile.spec.ts`
  (6 tests: compact footprint, expand, collapse-frees-map, X×End-game 0px²,
  story/done End-game score-stack visibility, drop-pin flow — all green,
  with screen recordings in
  `/home/hatch/workspace/meridian-review/evidence/`) + updated
  `longname-wrap`, `longname-scroll-a11y`, `question-card-header`,
  `question-wrap` specs for the new toggle labels.

## Deliberate deviations / notes

- **End game visibility narrowed** from `phase !== "summary"` to
  `phase === "aim"`. The button's action is untouched; it now renders only
  while aiming so the bottom-right dock never floats over the result sheet
  during reveal. All existing E2E uses it during aim only.
- **Dismissed → "Show question" restores to `open`** (unchanged): an
  explicit user restore means "show me the question."
- **auto-animate not used**: the remount-reveal (opacity + transform)
  already satisfies the transform/opacity-only constraint; auto-animate
  would animate layout height.
- The old `.scroll-cue-wrap[hidden]` CSS rule is now unused by the bubble
  but kept (harmless, defensive).
