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
- [ ] Builder: repro + BEFORE captures.
- [ ] Builder: fixes + tests + AFTER captures.
- [ ] Builder: gates + draft PR.
- [ ] Clean-context review seat.
- [ ] Coordinator verification + report.

## Graph

No graph.json changes on this branch (integrator-only file). No new nodes
proposed: both fixes live inside existing components.

## Ruled out

- Removing Grandpa from non-Home pages or reverting PR 534 — the owner
  ruled "let him talk" (2026-11-18): he stays in every footer.
- Per-page positioning hacks for the tour card — the fix is shared.
