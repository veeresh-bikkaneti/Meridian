# BRANCH_STATUS — feat/phase0-shell-split

**Branch:** `feat/phase0-shell-split`
**Base:** `origin/main` at `f37dea50` (Merge PR #390)
**Scope:** P2 — Phase 0 shell split, behaviour-preserving extraction only.
No behaviour change, no new features, no subject game code. No merges, no
PRs, no force-push — merging stays the owner's word per PR per head.

## Done

- [x] Slice 0 — spec file `docs/scaling/phase0-shell-split-spec.md` (head `34297527`, pushed).
- [x] Slice 1 — pure helpers moved verbatim from `src/components/game-app.tsx`
      into `src/game/shell-helpers.ts` (164 lines); game-app.tsx 8,609 → 8,472 lines.
      `Drop` + `isChallengeRun` re-exported from game-app.tsx.
      One source-pinning test marker updated as a mechanical consequence
      (`game-app-lazy-boundary.test.ts`).
      Gates: tsc PASS; `npm test` 2,323 pass / 0 fail; `test:worker` PASS;
      `lint-cards.mjs` GATE PASSED; `build:pages` PASS;
      E2E smoke 4/4 pass (hydration-boot + geodetective-boot-home).

## Pending (the rest of P2 — not in this session)

- [ ] Further slices: storage helpers, prefetch helpers, then per-game
      screen components behind a small shell router.
- [ ] `Question` / `Result` interfaces in use for geography.
- [ ] Thin progression contract (passport/streak/badge namespaces + scoring spreadsheet).
- [ ] Import-boundary test (zero static game imports in the shell).
- [ ] Load-budget baselining + CI gate numbers.
- [ ] Science simulation spike (prototype).
- [ ] ADR governance + versioned shell contract + one-app tripwire.
- [ ] Full E2E suite identical before/after + screen recording.
- [ ] Panel review of the final tip.

## Open owner questions (not settled here)

- P8 gate names v3 but the keeper is v4 — does the owner's listen-approval of v4 satisfy the gate?
- Q14 lazy-load guardrail and Q15 passport have no written owner answer.
- Q4, Q5, Q11, Q13 open; Q6 home order answered by P1's mockup, not P2.
- Constitution-first ordering is conditional.

## Blocked by

- Nothing for slice 1. Full P2 completion is blocked by the open owner
  questions above and by panel review (builder cannot self-certify).

---
