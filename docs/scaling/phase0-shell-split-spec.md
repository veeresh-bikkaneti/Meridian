# Phase 0 — Shell Split Spec (`feat/phase0-shell-split`)

**Branch:** `feat/phase0-shell-split`
**Base:** `origin/main` at `f37dea50` (Merge PR #390, journal-manifest-note)
**Status:** IN PROGRESS — slice-by-slice, behaviour-preserving extraction only
**Owner decision:** CONDITIONAL GO for definition work and Phase 0 only
(council verdict 2026-11-07). Subject feature branches are NOT GO.
**No educator sign-off exists for this work and none is claimed.**
No "approved" language appears in this spec.

## 1. Baseline measurement (measured in this worktree, 2026-11-10)

| Item | Value | How verified |
|---|---|---|
| `src/components/game-app.tsx` line count | **8,609 lines** | `wc -l` on `origin/main` HEAD `f37dea50` (HIGH — measured directly in this worktree) |
| Brief's "~8,463 lines" figure | STALE — was true at study rev `566c9557` (2026-11-07); file grew ~146 lines since | `meridian-scaling-lens-breakdown.md` §1 P2 (HIGH — source file on record) |
| "4,207 lines" figure | STALE Oct-18 checkout — never use | `meridian-scaling-work-packets.md` P2 agent context (HIGH — source file on record) |

Scope the split from the 8,609-line file, not from either stale figure.

## 2. Scope — in

- Extract per-game screens from `GameApp` into separate screen components
  behind a small shell router; the geography game must behave identically.
- Define the game-agnostic `Question` type (kind discriminator:
  place / problem / equation / lab, per-kind payloads) and `Result` type
  (per-kind evidence: distance + radius for geography; answer + working +
  error type for math; steps used for algebra) — and have the existing
  run/session/review-deck code use them for geography.
- Thin platform contract only: one passport, one streak definition, one
  badge namespace, cross-subject scoring spreadsheet — namespaces +
  definitions only, no full progression system (that waits until two real
  games exist).
- Import-boundary test proving the shell has zero static imports of game
  code and no game chunk loads before selection.
- Load-budget baselining: measure initial JS and per-game chunk sizes on
  the first build; propose CI gate numbers (starting proposal: initial JS
  ≤ 250 KB gzip, per-game chunk ≤ 500 KB gzip — PROPOSAL until measured).
- Science simulation spike (prototype only): one responsive world, one
  cause → visible effect, proving the shell contract against a second
  play surface.
- ADR governance for shared-shell changes + a versioned shell contract.
- One-app tripwire written down (revisit one-app-per-game on: different
  privacy posture, different deploy cadence, or load-budget failure after
  honest splitting).

## 3. Scope — out (hard stops)

- No behaviour change of any kind — including "improvements" found during
  the split (record them, do not ship them in this PR).
- No new game, no new content, no subject game code.
- No tiny-model code, probes, or model-shaped abstractions (P9, parked).
- No curriculum, topic map, or judging work (P1).
- No full progression system design.
- No merges, no PRs, no force-push. Merging stays the owner's word per PR
  per head.
- No educator sign-off is claimed or written anywhere ("approved" appears
  nowhere in this workstream's output).

## 4. What counts as done (acceptance criteria, from P2 packet)

1. `GameApp` split into per-game screens + a small shell router; the
   geography game plays identically.
2. `Question`/`Result` interfaces exist and the existing
   run/session/review-deck code uses them for geography.
3. Thin progression contract exists (passport/streak/badge namespaces +
   scoring spreadsheet).
4. Import-boundary test passes (zero static game imports in the shell).
5. Science simulation spike exists as a prototype and the shell contract
   is proven against it.
6. Load budget numbers measured and recorded; CI gate wired (or a
   follow-up task filed with the measured numbers).
7. **Identical E2E outcomes before and after** — same suite, same
   results. Any behaviour change in the same PR is a block, not a fix-up.

## 5. Verification block (per slice)

After each slice, in this worktree, run:

1. `npx tsc --noEmit` — must pass.
2. `npm test` — must pass.
3. `VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages`
   — must pass (Kofi URL set at build time).
4. E2E (when run): under the shared lock (`flock ~/workspace/.e2e.lock`),
   `--workers=1`,
   `PLAYWRIGHT_CHROMIUM_EXECUTABLE=$HOME/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
   `VITE_KOFI_URL` at both build and test time. Never two suites concurrently.
5. Screen recording of the built app (same journeys before/after) —
   no recording = the testing did not happen.
6. Commit + push after each green slice. Stage NAMED FILES ONLY —
   never `git add -A`.

Final tip goes to panel review; the builder never self-certifies.
Merge only on the owner's explicit per-PR word.

## 6. Verification protocol (forcing rule)

Every research/factual claim written in this workstream carries either a
live web source (URL + date accessed) or an explicit confidence level
(HIGH / MEDIUM / LOW with the evidence that earns it). A claim without
one is not done. Repo-local facts are HIGH when measured directly in
this worktree (command + output recorded); facts taken from the scaling
source files are HIGH only as "recorded in <file>" and must be re-verified
against the repo before being asserted as current.

## 7. Open owner questions (recorded, never decided here)

1. **P8 gate names v3 but the keeper is v4** — does the owner's
   listen-approval of v4 satisfy the gate? (Owner to decide.)
2. **Q14 lazy-load guardrail and Q15 passport** — no written answer from
   the owner yet. Q15 has a council resolution (thin contract in P2);
   owner confirmation is still open.
3. **Constitution-first ordering is conditional** — if a
   single-jurisdiction constitution clears audit before math, build order
   changes.
4. **Q4** (GO-evidence acceptance), **Q5** (load budget + tap-to-paint),
   **Q11** (science spike authorization), **Q13** (tripwire acceptance)
   — open owner questions blocking full P2 completion.
5. **Q6** (home order) — P2 must not hard-code a home order; P1's mockup
   answers it.

## 8. Slice log

| Slice | What | Head | Gates |
|---|---|---|---|
| 0 | Spec file (this document) | — | — |
| 1 | Pure helpers → `src/game/shell-helpers.ts` (formatting + clamp + id helpers, no React, no state) | TBD | TBD |

(Append rows as slices land.)
