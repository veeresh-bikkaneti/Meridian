# fix/grandpa-once-per-visit — branch status

Base: origin/main `ea1af3da` (PR 537 merged; PR 538 NOT in this base).
Tier 1 (owner-set). Cap 100k tokens shared; lane estimate 45–65k.
Deliverable: DRAFT PR, stopped at the owner's merge word.

## Task capsule

1. **Walk once per visit.** `GrandpaCoffeeRun` (inside `SiteFooter` on every
   page since PR 534) remounts on every route change and replays the walk +
   trail lines each time. Fix in `src/components/grandpa-coffee-run.tsx`:
   - A sessionStorage flag (via the file's existing `readStorage` /
     `writeStorage` helpers) records that this session has had its walk.
   - Any later mount in the same session, on any page, starts seated with
     no trail lines. A new session walks again.
   - The flag is set when a walk begins, so leaving mid-walk does not earn
     a replay on the next page.
   - Inside one walk, the quip effect must not reset the quip index when
     the beat returns kettle → walking: the rotation carries on from the
     next line, never back to line 0.
   - `prefers-reduced-motion` behaviour is unchanged (settled scene only).
2. **Tour card clears the hero toggles.** The floating tutorial banner
   (`FloatingBanner` in `src/components/tutorial-overlay.tsx`, default
   `top-16`) can cover the Home hero sound toggle and Contrast pill on a
   first visit. Fix the shared positioning in `tutorial-overlay.tsx` so
   the card never covers either toggle at any width and stays inside the
   viewport at 320 px. No Home-only hack.
3. **Test-stub guard (opportunistic).** The `typeof window.setInterval`
   guard in the quip effect exists for other screens' unit-test window
   stubs. Move it into test setup only if that is one small, safe change;
   otherwise leave it and record it here as Phase 1 debt.

## Acceptance

- Unit: second mount in the same session starts seated and plays no trail
  line; quip index does not reset on kettle → walking.
- E2E (one new spec): Home → first trail caption appears → /credits → back
  Home → "These hills…" caption never appears again that session; on a
  first visit with the tour card showing, the sound toggle is visible and
  clickable at 1280 and 390 px.
- Mockup first for the tour-card move: before/after captures at 1280, 768,
  390, 320 px in `~/workspace/grandpa-once-evidence/`, referenced in the PR
  body before code review.
- Gates: typecheck, `npm test`, `test:worker`, `lint:nav`, `lint-cards`,
  `check:entry-size`, `check:provenance`, `build:pages`, the new e2e +
  `footer-links-visible.desktop.spec.ts` (hermetic recipe). Full e2e suite
  is CI's job.

## State

- [x] Worktree + branch created off `ea1af3da`; capsule written.
- [x] Builder: repro + BEFORE captures.
- [x] Builder: fixes + tests + AFTER captures.
- [x] Builder: gates + draft PR.
- [ ] Clean-context review seat.
- [ ] Coordinator verification + report.

## Builder notes (2026-11-19)

- Session key: `meridian.grandpa.walkedSession` (sessionStorage, via the
  file's `readStorage`/`writeStorage` helpers). Written in a mount effect
  when the initial mode is "strip" or "tour"; the mode initializer
  returns "seated" when it is set. Quip guard: a `quipStartedRef` lets
  only the first entry into "walking" reset `quipRef` / play line 0;
  kettle → walking re-entry continues the rotation.
- Tour card: `FloatingBanner` default offset `top-16` → `top-32` in
  `tutorial-overlay.tsx` only. Beat 1 (`bottom-24`) left as-is.
- BEFORE measurements (fresh profile, tour beat 2, hermetic captures in
  `~/workspace/grandpa-once-evidence/`): the sound toggle and Contrast
  pill were NOT intersected at any width on this base (card top 64px,
  toggle bottoms 46–56px — an ~8px gap at phone widths), but at 390px
  the card DID overlap the run screen's top-right End game pill
  (2,632 px²), and beat 1's card covers the hint and End game buttons
  in the aim dock at 768/390/320px (pointer-transparent, so taps pass
  through; the buttons are visually covered). AFTER: card top 128px —
  no intersection with sound/Contrast at 1280/768/390/320, centres hit
  the toggles themselves, End game cluster clear, card fully inside a
  320×568 viewport (x 12–308, y 128–326).
- Test-stub guard: LEFT in place — Phase 1 debt. There is no shared
  vitest/node-test setup file; window stubs are per-file (e.g.
  `home-journal-wiring.test.ts` builds its own timer host), so there is
  no one small safe place to move the guard to.
- Pre-existing e2e failures (A/B proven): `grandpa-coffee-run.desktop`
  fails 7 tests (2 pass) IDENTICALLY on unmodified `ea1af3da` in this
  environment — a missed "kettle" beat sample and `page.url()` gaining
  a `#home` hash the spec does not expect. Not caused by this branch;
  the same 2 pass / 7 fail split occurs with these fixes applied.
- Unit tests: `src/components/grandpa-once-per-visit.test.ts` (2 tests,
  real component via esbuild bundle + react-test-renderer,
  `./grandpa-ask.ts` stubbed to observe `playTrail`).
- E2E: `tests/e2e/grandpa-once-per-visit.desktop.spec.ts` (3 tests:
  once-per-session route change, toggle clearance at 1280 + 390) —
  all pass. `tutorial.spec.ts` 4/4 pass; `footer-links-visible` pass.

## Graph

No graph.json changes on this branch (integrator-only file). No new nodes
proposed: both fixes live inside existing components.

## Ruled out

- Removing Grandpa from non-Home pages or reverting PR 534 — the owner
  ruled "let him talk" (2026-11-18): he stays in every footer.
- Per-page positioning hacks for the tour card — the fix is shared.
