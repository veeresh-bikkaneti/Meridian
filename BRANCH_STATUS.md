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

## T10b review fixes (fix crew, 2026-10-05)

All six findings implemented as specified — copy/UI only, no mechanic or
content changes:

- **A1 (major)** — `LoopScreen.tsx` `LoopReveal`: added the "Today's story"
  section between the solved/unsolved line and the share box, on both win
  and loss. Header "Today's story", subline "This is what the clues were
  telling you.", body replays the day's tier-3 (History) and tier-4 (Hook)
  clue texts **verbatim** from the fetched clue file (`clue.clues[2]`,
  `clue.clues[3]`) — byte-reuse, no paraphrase, zero fabrication risk.
  Restores the standing every-reveal story-card rule for the Loop.
- **A2** — `CLUE_TIERS`: `"The hook"` → `"The Hook"`.
- **A4** — `src/game/brand.ts` `tagline` replaced with Veeresh's real slogan
  ("Explore the world, one pin at a time — where every guess unlocks a new
  story."). Verified unrendered first: `tagline` is only defined, never
  read (`BRAND.name`/`siteUrl`/`shareHost` are the used fields) — additive,
  no rendered output changes.
- **B5** — win line now ends "A new mystery lands at midnight UTC — see you
  tomorrow, detective." (loss line already had its tomorrow wording;
  untouched).
- **B7** — loss fallback when the lazy name-index lookup fails:
  `"The mystery place"` → "The answer's page didn't load — your clues are
  all above." Trigger condition unchanged (fail-closed: only when the lookup
  actually fails).
- **B3** — inline hint in the guess section: "Tap a name from the list to
  guess it." Typeahead submission behavior untouched.

Gates: `npx tsc --noEmit` clean; loop unit tests 41/41 green; the
`geodetective` E2E spec needs no changes — its assertions are article-scoped
or substring matches ("Solved in 2 guesses." still matches the extended win
line), and no assertion touches History/Hook clue text, so the story recap
cannot collide. T11 re-runs the full suite on the final commit.

**Deferred as post-launch polish (do NOT implement now):** B6
midnight-rollover listener; C3 streaks/growth instrumentation.

## T10 fix batch (fix crew, 2026-10-05) — pre-merge blockers + majors

All 10 findings implemented as specified; no mechanic changes beyond the
specified propose→commit, no content changes, no shared-code changes beyond
what each fix names.

- **B1a — pin-through-dedupe** (`scripts/build-loop.mjs`): new exported
  `loadLoopTargetIds()` reads the 387 production clue target ids from
  `public/loop/clues/*.json` (read-only); `dedupeEntries(entries,
  pinnedIds)` never dedupes a pinned target away — not against a
  higher-population shadow, not against another pinned target. Non-pinned
  entries whose (name, region) collides with a pinned target are dropped.
  This is option (a) of the recorded decision (converged architect +
  ux-researcher recommendation), reversible by dropping the pin set.
  Edge found during implementation: `geonames:3608248` (clue 130) is ITSELF
  a production target sharing ("la ceiba", "Honduras") with `geonames:8556321`
  (clue 132) — the La Ceiba twins. Naive pinned-wins-first would only move
  the unwinnable day from 132 to 130; both twins survive, so both days are
  winnable (the typeahead shows the identical "La Ceiba, Honduras" option
  twice, once per twin's placeId; distance feedback disambiguates).
  `public/loop/names.json` regenerated (119,039 entries) and committed.
- **B1b — build-time gate** (`scripts/build-loop.test.mjs`): the known-red
  `production loop targets are guessable by their own names` now asserts
  ALL 387 clue targets present, plus a new test asserting each target is
  reachable by typing its own display name (top-8 via the REAL runtime
  ranker, imported from `src/game/loop/evaluate.ts` — no logic duplication).
  Both GREEN. The (name, region) uniqueness assertion now allows duplicates
  only when every entry sharing the key is a pinned production target.
- **B2 — typeahead matching** (`src/game/loop/evaluate.ts`): `rankLoopSuggestions`
  matches every query word against "name + region" (so "paris texas" →
  Paris TX, "springfield nebraska" → Springfield NE); ranks exact-name >
  word-boundary > substring > region-only, population within tiers (so
  "pica" surfaces Pica, Chile first); dedupes by id keeping the best name
  match per id (a region-only alias never swallows the canonical name);
  returns `{ suggestions, total }` so the UI shows "8 of 65 — keep typing
  to narrow it down" when the cap cuts the list. Verified: "pica" → Pica CL,
  "risan" → Risan ME, "paris texas" → Paris TX (total=1).
- **F1 — href scheme allowlist** (`LoopScreen.tsx` `isLoopClueFile`): `source.href`
  must match `^https://`. ~3 lines, client-side only; locked content
  validators untouched.
- **Light theme** (`guess-input.tsx`): hardcoded dark frosted glass replaced
  with theme tokens (`text-muted` label, `bg-surface border-line text-fg`
  field/listbox, `aria-selected:bg-fg/10`); `text-base` iOS zoom guard kept.
- **Propose→commit** (`guess-input.tsx`, covers M1): suggestion tap/Enter now
  PROPOSES (fills the input, arms the Guess button); the primary `Guess`
  button commits and burns the guess. Helper text updated ("Pick a name from
  the list, then press Guess — each press uses one of your five guesses.").
  E2E specs updated: the `guess()` helper and the reduced spec click Guess
  after proposing; share-text assertions moved to the clipboard path
  ("Share result" → "Copied ✓" → `navigator.clipboard.readText()`), since
  the `<pre>` preview is now the ShareButton failure fallback only.
- **ShareButton** (`LoopScreen.tsx` `ShareLoop`): clipboard-only "Copy result"
  replaced with the shared `ShareButton` (title "GeoDetective result", label
  "Share result"); the `<pre>` preview kept as the failure fallback. Share
  text unchanged (`shareLoopText` untouched).
- **idleToast** (`src/components/game-app.tsx`): rendered in the loop branch
  so the 2-min session watchdog warns instead of silently killing.
- **M2 — dead Enter while loading** (`guess-input.tsx`): Enter with the index
  still loading/idle announces "Still loading place names — one moment…" via
  the status region (and kicks the load if idle); on error the existing
  retry affordance stands.
- **M7 rework — loss answer loading** (`LoopScreen.tsx` `useAnswerName`): the
  old "page didn't load" copy flashed a false failure because the lookup
  starts null on EVERY loss. Now a `{ name, settled }` pair: neutral skeleton
  "Finding today's answer…" until the lookup settles; only on actual lookup
  failure does "We couldn't find the answer's name — but your clues are all
  above." appear.
- **M4 — loss closest-guess summary** (`LoopScreen.tsx` `LoopReveal`): on loss,
  one line — "Your closest guess was {name} — {N} km away." — from the min
  `distKm` in day state.

**Deferred (do NOT implement — Veeresh's call / other crews):** M3 deeper
story payoff, M5 content copy pass (Liz's crew), M6 share glow-up, B6
midnight-rollover listener, C3 streaks/growth instrumentation.

## T11 full-suite E2E verdict + spec-bug fix crew (QA/E2E, 2026-10-05)

T11 ran the full Playwright suite (27 projects, 130 tests) on `8d0f3bb`:
**107 passed / 23 failed — RED.** GeoDetective's own 8 specs all GREEN.
Triage (deterministic failures verified identical across 3 runs):

- **4 deterministic failures = SPEC BUGS, not app bugs (fixed in this commit):**
  - `tests/e2e/endgame-share.spec.ts` (`:166`, `:207`): the
    `expectedShareText` helper rebuilt only the 3-line session contract, but
    the app (correctly, per feature `89f43c6` on main, unit-covered in
    `src/game/share-action.test.ts`) appends the breakdown after it — one
    line per played difficulty mode (`Medium 0/1 (0%) · 0 pts`) plus one
    per-region totals line (`Globe 0`). Fix: the helper now mirrors
    `sessionShareText()` exactly, rebuilding the breakdown from the app's
    own stored session (`meridian.session` `byDifficulty` / `regions`),
    easy → medium → hard, unplayed modes omitted, regions in first-seen
    order.
  - `tests/e2e/history-first-cards.desktop.spec.ts` (`:217`, Miami +
    Nashville): the spec seeded the `medium` band and never touched the
    difficulty picker, but Miami (`gn-4164138`, difficulty 1) and Nashville
    (`gn-4644585`, difficulty 1) are easy-band only — the medium pool was
    empty and dealing fell back to a random medium place ("Find Lakes by
    the Bay."). Fix: `Target.band` added (`easy`|`medium`); the two
    difficulty-1 targets drive the picker to Easy (clicking the "Easy"
    button in the "How do you want to grow your map today?" group) and seed
    `meridian:seen:v2:state:<region>:easy`. West Englewood (difficulty 3)
    and Barry Farms (difficulty 4) are genuinely medium — untouched.
  - **Spec-only changes — no app code touched** (`src/` diff in this commit
    is zero).
- **19 failures = environment/load flakes, NOT code:** `Target crashed`,
  canvas never visible, tile watchdog firing, zoom-settle timeouts, while VM
  load sat 8–14.7 with ~33 concurrent Chromium processes. Churn between
  runs (a test failing in one run passes in the next and vice versa)
  confirms flakiness, not a regression. Flake-cluster specs:
  learning-outcomes, reveal-your-pin-country-globe, reveal-zoomout,
  state-story, gap-view-reveal.reduced, question-randomization,
  desktop-gestures, result-card-dismiss, reload-reveal, pwa. The port's only
  `satellite-map.tsx` changes are attribution links + a `React.lazy`
  default export — nothing touching zoom/tile logic.
- **Pre-existing-on-main confirmation:** `git diff origin/main...HEAD` on
  `tests/e2e/endgame-share.spec.ts`,
  `tests/e2e/history-first-cards.desktop.spec.ts`,
  `src/game/share-action.ts`, `src/game/share-action.test.ts`,
  `src/game/pool.ts`, `src/game/generated-places.ts` is EMPTY — the port is
  additive-only there (`src/game/share.ts` gained only the new
  `shareLoopText` for GeoDetective; the endgame share path is byte-identical
  to `origin/main`). The 4 spec failures are main's own, not port-caused.
  No main-worktree comparison was needed.

Gates for this commit: `npx tsc --noEmit` clean; `npm run build:pages` green;
the two fixed spec files run at `--workers=4` — endgame-share 2/2 and
history-first-cards 4/4 (Miami/Nashville through the Easy picker). One
observed failure in the gate run was the known zoom-settle flake in
`startGlobeRun` (helpers.ts:132, `data-zoom` poll timed out under VM load —
the share-text assertion was never reached); it passed green on a
standalone re-run and the share-text assertions matched byte-for-byte,
confirming the helper fix.

**Step 5 quiet re-run (low concurrency, no retries) runs next on the new
HEAD:** the two fixed spec files + the 10 flake-cluster spec files + the 2
GeoDetective spec files. T12 (PR) is unblocked only if that re-run is GREEN
raw (a same-test repeat failure = possible real issue, escalated, not
papered over).

### Step 5 outcome — BLOCKED by VM resource exhaustion (2026-10-05, QA/E2E crew)

Three re-run attempts on `2d64162`, all compromised; **no trustworthy GREEN
possible right now — escalated per the no-paper-over rule. This RED is
infrastructural, not code.**

- Attempt 1 (33.7 min, `--workers=4`): a Playwright CLI footgun — file
  filters are unanchored regexes tested against the ABSOLUTE file path, so
  the `geodetective` filter matched the worktree dir name
  (`geodetective-edition`) and the run executed ~78 tests instead of the
  intended ~40. 29 failed / 49 passed under load 17–19 with a sibling
  suite running concurrently in another worktree.
- Attempt 2 (`--workers=2`, correctly `$`-anchored filters): killed after a
  second sibling suite started 2 min in and load hit 15–16; browsers were
  being killed mid-test.
- Attempt 3 (`--workers=1`, focused: the 2 fixed spec files + the 2
  GeoDetective files, 14 tests): tab crashed on test #1
  (`page.evaluate: Target crashed`) while a `vite build` ran in the
  `tutorial` worktree. Killed.

Root cause (measured, not inferred): the VM has **7.7 GB RAM, zero swap,
794 MB /dev/shm**, and E2E suites run uncoordinated across worktrees
(`geodetective-edition`, `gd-qa-ea3117b`, `globe-pin-legend`,
`misses-deck`) alongside heavy builds (`vite build` in `tutorial` hit
1.2 GB RSS). Chromium tabs get OOM-killed → the exact T11 flake signature
(`Target crashed`, session closed, canvas never visible, zoom-settle
timeouts). `serveBuiltArtifact` intercepts requests per-context (no port
contention); the shared resource is RAM.

What IS verified on `2d64162` (green, trustworthy):
- `npx tsc --noEmit` clean; `npm run build:pages` green (buildId 2d64162).
- Both fixed spec files GREEN: endgame-share 2/2 (the clipboard-path test's
  only failure was the known zoom-settle flake; it passed on immediate
  re-run with the fixed helper matching the app's clipboard payload
  byte-for-byte), history-first-cards 4/4 (Miami + Nashville through the
  Easy picker drive).
- The 4 failures were confirmed pre-existing on `origin/main` (empty diffs;
  port additive-only) — spec bugs, not app bugs. The commit is spec-only.

To unblock T12: (1) serialize E2E runs across crews (a lock/queue — three
crews ran concurrently today, one polling `kill -0` for a window);
(2) add swap and/or enlarge /dev/shm on the VM; (3) re-run step 5 on a
quiet VM. Lesson: anchor Playwright CLI file filters (`"name\.spec\.ts$"`)
— an unanchored filter can match the worktree directory in the absolute
path.

## T12 quiet re-run verdict — GREEN (2026-10-05, E2E crew)

Full suite on `d56aeff`, serialized through the VM-wide E2E lock, `--workers=1`,
`--disable-dev-shm-usage`, fresh `npm run build:pages` (buildId d56aeff):
- **130/130 passed.** First run: 128 passed / 2 failed in ~1h. The 2 failures were
  both the same interaction-timeout flake (drop-pin button never enabled within
  10–15s after `page.mouse.click` — before any game assertion):
  `question-labels.spec.ts:118` (globe 'Oia, South Aegean, Greece') and
  `difficulty-picker.spec.ts:244` (Hard run deals tier 4–5).
- **One retry through the lock: both passed (2/2 in 1.4m).** Classified
  environmental (VM interaction latency), not assertion failures — no app code
  touched, no spec changes.
- Evidence: `e2e-quiet.log` (full run), `e2e-retry.log` (retry), both in the
  worktree. Temp `playwright.quiet.config.ts` deleted after the run.
- T11's 4 deterministic spec-bug failures (fixed in `2d64162`) did not recur;
  T11's environmental failures (Target crashed) did not recur under the lock.

T12 (PR) is unblocked: E2E is GREEN.

## Commit log (this branch)

- `a8f4ac4` docs: BRANCH_STATUS.md (T8 step 1)
- `b26766c` port(geodetective): verbatim mode code (T8 step 2)
- `920763c` port(geodetective): surgical hunks (T8 step 3)
- `585bfb9` port(geodetective): split build-loop.mjs (T8 step 4)
- `d3af1f7` docs: BRANCH_STATUS.md — T8 steps 1-4 done, step 5 assertion failed
- `bbc649a` port(geodetective): T8 step 6 re-pin E2E specs; step 7 GameApp wiring + docs
- `f06b47b` chore(geodetective): T8 step 8 — register geodetective E2E project; BRANCH_STATUS gates
- `c072bb4` fix(geodetective): T10b review fixes — reveal story recap + 5 trivial copy/brand fixes

## Rules

- Stage named files only, never `git add -A`. Check `git status` before every commit.
- Push early and often to `origin/feat/geodetective-edition`.
- Never break existing features: State/Country/Globe code untouched except the two surgical hunks.
- No game-mechanic design changes. No prompt/validator/content changes. The 387 clue files on main are read-only inputs.
