# TD-05.4 — end-of-flow Home owner (EndOfFlowHome)

Branch: `feat/td-05.4-end-of-flow-home`
Base: origin/main `da516bee` (TD-06.11, #625)
PR: draft, cure LoopScreen + SubjectCase rows (PR 1 of 2)
Goal: TD-05.4 — clear the 3 homeButtonImport shell-ban rows via a shared end-of-flow Home owner (EndOfFlowHome); shell-ban 6 → 4 (PR 1) → 3 (PR 2).

## Done

- New shared owner `src/components/ui/end-of-flow-home.ts` (plain `.ts` with
  `createElement`, same harness reason as `home-button.ts`). It forwards
  exactly `onHome`, `variant`, `className`, `testId` to `HomeButton`, so the
  rendered HTML is byte-identical (pinned per call site in
  `end-of-flow-home.test.ts`, including the game-app PR 2 prop shapes). It
  does not re-export `HomeButton` or `BrandHomeButton`.
- `eslint/shell-ban-rule.mjs`: `HOME_CONTROL_OWNERS` gains
  `src/components/ui/end-of-flow-home.ts`; header comment and the rule
  message name both owners (SiteHeader = header control, EndOfFlowHome =
  end-of-flow / HUD Home).
- `src/game/loop/LoopScreen.tsx:24,2242`: import + render swap to
  `EndOfFlowHome` (`onLeave` callback flow unchanged, `home-button-end` kept).
- `src/subjects/shared/SubjectCase.tsx:106,582,613`: import + both result-card
  renders swapped (`onExit` flow unchanged, `home-button-end` + `secondary`
  kept).
- `eslint/shell-ban-baseline.json`: the two cured rows removed
  (`homeButtonImport` now only `src/components/game-app.tsx`); comment records
  TD-05.4.
- `src/components/ui/shared-shell.test.ts`: frozen baseline shrunk, owners
  never-baselined list gains `end-of-flow-home`, plus a cure assertion for
  both screens.
- `scripts/test-regression-wave.mjs`: `LIMITS.shellBan` 10 → 4 (header
  comment updated). `scripts/test-regression-wave.test.mjs`: cap assertions
  moved to 4/5.
- `eslint.nav.config.mjs`: comment-only (owners named).

## Ruled out / deferred

- passing HomeButton into hosts as a slot (GeoDetectiveHost etc.): moves the
  import into an unbaselined file and fails lint:nav — rejected by design.
- touching `game-app.tsx` here: that is PR 2, gated on PR 1 merged + Edge's
  open game-app PR merged + Veeresh granting the game-app lock. PR 1 does not
  edit `game-app.tsx` at all.

## Open questions

- none blocking PR 1. Kanban: the TD-05.4 card still needs adding by whoever
  owns `src/build-board` (owner ruling) — the board validator pins 45
  subtasks and the packs forbid pack edits here. Flagged in the PR body.

## Next step

PR 2 (`feat/td-05.4-end-of-flow-home-game-app`): swap game-app.tsx's five
HomeButton uses (menu, ReviewComplete, ChallengeComplete `challenge-done`,
PlayLoaded HUD) to `EndOfFlowHome` until shell-ban is 3. Start only after PR 1
is merged, Edge's open game-app PR has merged, and Veeresh says this seat
holds the game-app lock. If Lane 5 has extracted ChallengeComplete /
ReviewComplete / PlayLoaded into new files by then, swap those files too.

## Graph

TD-05 (shell-ban story) → TD-05.1 bank years · TD-05.2 boot splash ·
TD-05.3 ContentNav · **TD-05.4 EndOfFlowHome (this seat)**. PR 1 cures
LoopScreen + SubjectCase (6 → 4); PR 2 cures game-app.tsx (4 → 3) behind the
game-app lock. TD-06.x untouched.
