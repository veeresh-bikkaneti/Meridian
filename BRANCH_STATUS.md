# BRANCH_STATUS.md — feat/geodetective-edition (GeoDetective mode port)

**Branch:** `feat/geodetective-edition` · **Base:** `origin/main` @ `fab222e` (PR #59 merged, the 387-file GeoDetective clue merge)
**Worktree:** `~/workspace/meridian-worktrees/geodetective-edition`
**Mission:** Port the GeoDetective daily-guessing mode from `origin/feat/meridian-loop` onto a fresh branch off main. No rebase, no merge of the old branch — port the additive payload (per T7 gap analysis). This branch NEVER touches `public/loop/clues/**` or `public/loop/manifest.json` (the 387 production sets stand as-is).

## T7 decisions (from `~/workspace/geodetective-t7-gap-analysis.md`)

- **Fresh branch + port, NOT a rebase.** The old branch's mode code is complete and portable as additive units; its framework files (GameApp, package.json, playwright.config.ts, placeholder clue files) are the conflict surface and stay behind. Rebase risks three silent-revert classes: ancient GameApp resurrected, test-list truncation, production clue content clobbered by `size:12` placeholders.
- **Loader scales unchanged (12 → 387).** `loopDayIndex` is pool-size-parametric by construction; lazy per-day fetch keeps future answers out of the bundle. names.json is 11.49 MB raw / 3.24 MB gz — ship unchanged (lazy, user-initiated, once per session), monitor. T8 must not redesign the loader.
- **ADR-007: GeoDetective ships as a parallel mode, not a fourth `Edition`.** The closed `Edition` union ("state" | "country" | "globe") has 18 consumers whose invariants (region-scoped dealing, seen stores, scored runs banked into sessions) don't fit the day-indexed, non-dealt loop domain. `LoopScreen` mounts outside the run machine. Any future session/learning integration should be an *adapter*, not union membership.

## T8 work order status (T8 crew: steps 1–5)

- [x] **Step 1 — Branch + BRANCH_STATUS.md** (this file; committed + pushed first).
- [x] **Step 2 — Port the verbatim set** (commit `b26766c`): `src/game/loop/*` (8 sources + 5 tests), `src/game/geo.test.ts`, both E2E specs (structure only), `docs/geodetective.md` (content-gate paragraph updated: 387 validated sets, PR #59 merged; placeholders retired).
- [x] **Step 3 — Two surgical hunks** (commit `920763c`): `initialBearing`/`octantOf` → `src/game/geo.ts`; `loopGuessMark`/`shareLoopText` → `src/game/share.ts`. Byte-identical to the branch versions; anchors verified on main's unchanged context. `npx tsc --noEmit` clean.
- [x] **Step 4 — Split `scripts/build-loop.mjs`** (commit `585bfb9`): placeholder clue-file/manifest emission DELETED (kept functions byte-identical: normalizeName, countryName, regionLabel, dayIndexFor, loadChunkPlaces, loadPopulations, entryFor, dedupeEntries, resolveAliasTarget, buildNamesIndex). `build-loop.test.mjs` pruned 19 → 11 tests; package.json registers the 6 ported loop/geo test files. Loop unit tests 48/48 green.
- [ ] **Step 5 — Regenerate `public/loop/names.json`: MECHANICAL ASSERTION FAILED** — see "Step 5 failure" below. The regenerated index (119,038 entries, `LoopNameEntry` key shape ✓) is in the working tree UNCOMMITTED pending the decision. Production content untouched (manifest md5 `b0ea4b3c…`, 387 clue files intact).

## Step 5 failure — 2 of 387 clue targets shadowed by dedupe (2026-10-05, T8 crew)

**What ran:** `node scripts/build-loop.mjs` against main's chunks (124,690 places)
+ GeoNames dump — `places=124690 populations=124690 missingPop=0`,
`names.json entries=119038` (the 7-entry delta vs the branch's 119,045 is
exactly the 7 dropped placeholder-era aliases).

**Assertion results:**
- `geonames:8556321` (La Ceiba) present — **FAIL (absent)**
- `geonames:2058304` (Williamstown) present — **FAIL (absent)**
- ~119k entries — **PASS (119,038)**
- `LoopNameEntry` key shape `{n,id,lon,lat,r,p}` — **PASS (all 119,038)**

**Root cause (verified, not a port bug):** the ported `dedupeEntries` keeps
the highest-population entry per (normalized name, region) — byte-identical
branch behavior. GeoNames carries duplicate records that collide:
- `la ceiba||Honduras`: keeps `geonames:3608248` (pop 222,055) over the clue
  target `geonames:8556321` (pop 215,973)
- `williamstown||Australia`: keeps `geonames:2143561` (Victoria, pop 14,407)
  over the clue target `geonames:2058304` (South Australia, pop 2,689)

T7 assumed `entryFor`'s `gn-<id>` → `geonames:<id>` mapping survives; it does
not survive dedupe for these two. Full scan: exactly 2/387 clue targets are
missing from the index (the same two T7 named).

**Gameplay consequence:** `submitGuess` wins only on exact `placeId` match, so
on the La Ceiba day (`clues/132.json`) and the Williamstown day
(`clues/370.json`) the player cannot win by picking the place's name from the
typeahead — 2 unwinnable days. (La Ceiba's shadow is ~5.6 km from the target,
so the distance feedback would read "almost there" while the day stays
unwinnable.)

**Not fixed because:** hand-patching is forbidden; changing dedupe to pin
target ids, changing the win condition to distance-based, or re-targeting the
two clue files are all design/content decisions — out of T8 scope, Veeresh's
call. The regression test `production loop targets are guessable by their
own names` in `scripts/build-loop.test.mjs` encodes the required invariant
and stays red until the decision lands. The regenerated `names.json` is left
UNCOMMITTED in the working tree as the baseline for the follow-up.

## Next crew (steps 6–7 + full gates)

- [x] **Step 6 — Re-pin the E2E spec** (commit `bbc649a`): pinned `?loop-date=`
  values re-indexed under `% 387` against main's real clue files —
  2026-10-03 → clue 218 → Ankara (`geonames:323786`), 2026-10-04 → clue 219
  → Tarija (`geonames:3903320`). Expected clue text, reveal headings, and
  share-text emoji strips recomputed from the clue files + names index
  (Paris→Ankara 2,598 km → red; all five loss-path guesses >2,000 km from
  Tarija → all red). `?loop-date=` seam still rejects malformed/rollover
  dates (unit-covered in `day.test.ts`). `geodetective.reduced.spec.ts`
  needed no changes (target-independent assertions).
- [x] **Step 7 — GameApp wiring** (commit `bbc649a`): rewritten against
  main's current `Choose()`/`GameApp` — 4th edition card (GeoDetective,
  "Solve today's mystery"), `loopOpen` state via `readLoopOpen`/
  `writeLoopOpen`, early-return `<LoopScreen/>` placed after the run return
  and before chunk-loading (an in-progress run takes precedence; otherwise
  the flag wins), all outside the run machine. Card grid `md:grid-cols-3` →
  `sm:grid-cols-2 lg:grid-cols-4` so the 4th card sits balanced (2×2 below
  lg). Regression: purely additive — imports, one state var, one flag-guarded
  early return, one new Choose prop/card; State/Country/Globe paths flow
  identically when `loopOpen` is false. README GeoDetective section
  forward-ported with 387-file wording; `docs/geodetective.md` file map
  corrected (11 pipeline tests, 119,038-entry index from `build-loop.mjs`).
- [x] **Step 8 — Quality gates** (commit `f06b47b`, 2026-10-05):
  - `npx tsc --noEmit` — clean.
  - `npm test` — src suite 632/632 green; scripts suite 462/463 with the
    **1 known-red**: `production loop targets are guessable by their own
    names` (`AssertionError: La Ceiba missing from names.json`) — the step-5
    dedupe shadowing, Veeresh's decision pending. All else green.
  - `node scripts/lint-cards.mjs` — GATE PASSED (124,690 records:
    8,797 hooked / 115,893 hook-missing / 0 legacy).
  - `npm run build:pages` — green; `dist/client/loop/` ships manifest
    `size:387`, 387 clue files, `names.json` (buildId `bbc649a`).
  - Playwright E2E vs the built artifact — `geodetective` project registered
    **alongside** main's 26 projects (regex routing verified:
    `geodetective.spec.ts` → geodetective, `geodetective.reduced.spec.ts` →
    existing `reduced`): 7/7 geodetective tests green (win path, loss path,
    reload-restore, explicit-leave, namespacing, seam header, no-match),
    4/4 reduced-project tests green (incl. the geodetective reduced-motion
    spec + 3 pre-existing reduced specs, still passing — existing features
    unaffected).
- [ ] **Step 9 — Ship incrementally** (Veeresh): wave 1 = ported mode; names.json weight mitigations are a later wave only if field data warrants.

## Commit log (this branch)

- `a8f4ac4` docs: BRANCH_STATUS.md (T8 step 1)
- `b26766c` port(geodetective): verbatim mode code (T8 step 2)
- `920763c` port(geodetective): surgical hunks (T8 step 3)
- `585bfb9` port(geodetective): split build-loop.mjs (T8 step 4)
- `d3af1f7` docs: BRANCH_STATUS.md — T8 steps 1-4 done, step 5 assertion failed
- `bbc649a` port(geodetective): T8 step 6 re-pin E2E specs; step 7 GameApp wiring + docs
- `f06b47b` chore(geodetective): T8 step 8 — register geodetective E2E project; BRANCH_STATUS gates

## Rules

- Stage named files only, never `git add -A`. Check `git status` before every commit.
- Push early and often to `origin/feat/geodetective-edition`.
- Never break existing features: State/Country/Globe code untouched except the two surgical hunks.
- No game-mechanic design changes. No prompt/validator/content changes. The 387 clue files on main are read-only inputs.
