# Phase 0 — Shell Split Spec (`feat/phase0-shell-split`)

**Branch:** `feat/phase0-shell-split`
**Base:** `origin/main` at `f37dea50` (Merge PR #390, journal-manifest-note)
**Status:** IN PROGRESS — slice 2 (contract I1 registry) landed in this worktree; behaviour-preserving only
**Owner decision:** CONDITIONAL GO for definition work and Phase 0 only
(council verdict 2026-11-07). Subject feature branches are NOT GO.
**No educator sign-off exists for this work and none is claimed.**
No sign-off language appears in this spec.
**Synced:** `origin/main` at `b8ab5bfe` (docs #392) merged before this slice.

## 1. Baseline measurement (measured in this worktree, 2026-11-10)

| Item | Value | How verified |
|---|---|---|
| `src/components/game-app.tsx` line count | **8,609 lines** | `wc -l` on `origin/main` HEAD `f37dea50` (HIGH — measured directly in this worktree) |
| Brief's "~8,463 lines" figure | STALE — was true at study rev `566c9557` (2026-11-07); file grew ~146 lines since | `meridian-scaling-lens-breakdown.md` §1 P2 (HIGH — source file on record) |
| "4,207 lines" figure | STALE Oct-18 checkout — never use | `meridian-scaling-work-packets.md` P2 agent context (HIGH — source file on record) |

Scope the split from the 8,609-line file, not from either stale figure.

## 1b. Load-budget baseline (measured 2026-11-10, this worktree)

Parent commit `384ea735`. Build: `VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages`. Gzip is zlib level 9 from `node scripts/bundle-report.mjs` (HIGH — that command's JSON in this worktree). `listReleasedSubjects` does not appear under `dist/client` (HIGH — search of the built JS). The registry is not on the geography graph, so these numbers are the game as it ships.

There is no tap-to-first-paint probe in this repo. The numbers below are the milestones `scripts/perf-globe-easy.mjs` actually prints. Profile: CPU throttle 4, Slow 4G (150 ms, 1.6 Mbit/s down, 750 kbit/s up), viewport 390×844, Chromium 156.0.8078.4, median of 3, `PERF_CHROMIUM` set to the sandbox headless shell. This is not the CI e2e lane (SwiftShader renderer + 6× CPU, no paint timer). Workflow files are outside this branch's ownership, so no CI gate was added.

| Metric | Value |
|---|---|
| Initial entry JS gzip | **323,865 B** (raw 1,041,404 B, 11 files) |
| Initial entry CSS gzip | 27,117 B (raw 137,598 B) |
| Home ready ("Play the globe" usable) | 3,282 ms |
| Tap Play → interactive question | 14,732 ms |
| Question text on screen | 13,986 ms |
| First interactive question (text + map canvas) | **19,102 ms** |
| JS bytes on the wire for that journey | 1,546,897 B |

Per-run first interactive question: 19,102 / 19,065 / 19,140 ms.

Largest JS chunks, gzip level 9 (lazy, not the entry set):

| file | gzip bytes |
|---|---:|
| `assets/globe-t3-gFrZJa_X.js` | 565,969 |
| `assets/globe-t4-DO5u8UWL.js` | 550,975 |
| `assets/globe-t5-C_2zmM7o.js` | 358,587 |
| `assets/globe-t2-dcrshPy3.js` | 314,027 |
| `assets/ne-50m-admin-1-CVW17bIX.js` | 283,726 |
| `assets/maplibre-gl-eszYLo7z.js` | 274,879 |
| `assets/three.module-C6U0hPWR.js` | 166,063 |

`three.module` is not in the entry set. The Easy globe journey still requested it (wire 166,815 B) through the existing home-globe dynamic import. This slice does not move that import. No `src/subjects/*/index.ts` exists, so there is no per-subject chunk yet.

**Starting budgets (PROPOSED ceilings = this measurement, not a wired gate):** initial entry JS gzip ≤ 323,865 B. The §2 sketch (initial JS ≤ 250 KB gzip, per-game chunk ≤ 500 KB gzip) stays a sketch. It is not met: entry JS is already 323,865 B, and `globe-t3` alone is 565,969 B gzip.

Councilor C asked to leave these figures out of the slice. The 2026-11-10 task says to record them. They are recorded. No educator sign-off is implied.

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
- No merges, no force-push. Merging stays the owner's word per PR
  per head. The 2026-11-10 plan asks this stream to open a draft PR;
  that supersedes the earlier "no PRs" line for this stream only.
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
| 0 | Spec file (this document) | 34297527 | — |
| 1 | Pure helpers → `src/game/shell-helpers.ts` (164 lines): `isReviewRun`, `isChallengeRun`, `trailDate`, `DiscardedNotice` + `discardedNoticeText`, `runResultsTotals`, `boundsFor`, `isEdition`, `isPhase`, `isPlaceResult`, `isScoredPlace`, `isDrop`, `Drop` type — moved verbatim from `game-app.tsx` (8,609 → 8,472 lines). `Drop` + `isChallengeRun` re-exported from `game-app.tsx` so `result-card.tsx` and any external import keep working. One source-pinning test updated as a mechanical consequence: `game-app-lazy-boundary.test.ts` segment end marker `export type Drop = {` → `type ModelAvailability = "available"` (the pinned behaviour — fallback role="status" + spinner — is unchanged). | 2f0578e9 | tsc PASS; `npm test` 2,323 pass / 0 fail; `test:worker` PASS; `lint-cards.mjs` GATE PASSED; `build:pages` PASS; E2E smoke (hydration-boot + geodetective-boot-home, 4 tests) PASS |
| 2 | Contract I1: `src/subjects/registry.ts` discovers `./<id>/index.ts` with a lazy `import.meta.glob("./*/index.ts")` (same in-function pattern as `src/lib/flag-registry.ts`) and `selectReleased` lists only `released === true` modules whose `id` equals the folder. `load()` is not called. `game-app.tsx` does not import the registry. No subject folder exists yet, so the live list is empty and the geography game is unchanged. Types for I1/I2 sit in this file (a `contracts.local.ts` copy is not in the owned path list). Baseline is §1b. | 5f73b05d | tsc PASS; `npm test` scripts 1,160 pass / 11 skipped / 0 fail, src 2,363 pass / 0 fail; `test:worker` 145 pass; `lint-cards.mjs` GATE PASSED; `build:pages` PASS; Playwright smoke 24 pass / 1 fail (contact full-stack sink, not an owned file; Home and GeoDetective boot passed); full e2e suite NOT RUN |

## 9. Repo-rule conflict recorded (not decided here)

The repo's `AGENTS.md` Constitution rule 1 says "Do not refactor existing
working code" and rule 3 says "Edit only the targeted functions, in
place." This workstream's assigned task — the Phase 0 shell split,
authorised by the owner's CONDITIONAL GO (council verdict 2026-11-07) —
is a refactor by definition. The split proceeds on the assigned task's
authority, on the narrow, behaviour-preserving reading only (verbatim
moves, no behaviour change, gates after every slice). The conflict is
recorded here for the owner/panel; this workstream does not amend the
repo rule and does not claim an exemption beyond the assigned task.

Rule 2 ("edit existing files in place") is the same kind of tension for
`src/subjects/registry.ts`: the 2026-11-10 assignment names that file, and
it did not exist. Slice 1 already added `shell-helpers.ts` on that reading.
This is not a Chair-lift. The lift cannot cover rule 2. The new file is the
named deliverable, not a copy of a module that already exists.

(Append rows as slices land.)
