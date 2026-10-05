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
- [ ] **Step 2 — Port the verbatim set** from `origin/feat/meridian-loop` @ `c1dc443`: `src/game/loop/*` (8 sources + 5 tests), `src/game/geo.test.ts`, both E2E specs (structure only), `docs/geodetective.md` (content-gate paragraph updated: 387 validated sets, PR #59 merged; placeholders retired).
- [ ] **Step 3 — Two surgical hunks**: `initialBearing`/`octantOf` → `src/game/geo.ts`; `loopGuessMark`/`shareLoopText` → `src/game/share.ts`. `npx tsc --noEmit` clean before proceeding.
- [ ] **Step 4 — Split `scripts/build-loop.mjs`**: port the names-index path + `dayIndexFor` contract; gate or delete placeholder clue-file/manifest emission; prune `build-loop.test.mjs`. Do NOT copy `loop-seed.json`, placeholder clue files, or the `size:12` manifest.
- [ ] **Step 5 — Regenerate `public/loop/names.json`** via the ported builder against main's chunks + GeoNames dump. Assertions: `geonames:8556321` (La Ceiba) and `geonames:2058304` (Williamstown) present; ~119k entries; `LoopNameEntry` key shape. Never hand-patch the index.

## Next crew (steps 6–7 + full gates)

- [ ] **Step 6 — Re-pin the E2E spec**: compute `loopDayIndex(date, 387)` for pinned `?loop-date=` values against main's real clue files; rewrite expected clue text, reveal headings, share-text assertion.
- [ ] **Step 7 — GameApp wiring**: rewrite against main's current `Choose()`/`GameApp` — 4th card, `loopOpen` state, early-return `<LoopScreen/>` outside the run machine. Forward-port README GeoDetective section (387-file wording).
- [ ] **Step 8 — Quality gates**: `npx tsc --noEmit`, `npm test`, `node scripts/lint-cards.mjs`, `npm run build:pages`, Playwright E2E incl. geodetective specs (register the `geodetective` project *alongside* main's list, don't replace).
- [ ] **Step 9 — Ship incrementally** (Veeresh): wave 1 = ported mode; names.json weight mitigations are a later wave only if field data warrants.

## Rules

- Stage named files only, never `git add -A`. Check `git status` before every commit.
- Push early and often to `origin/feat/geodetective-edition`.
- Never break existing features: State/Country/Globe code untouched except the two surgical hunks.
- No game-mechanic design changes. No prompt/validator/content changes. The 387 clue files on main are read-only inputs.
