# FW-11.1 PR 1 — per-module difficulty registry and storage

- **Branch:** `feat/fw-11.1-module-difficulty-primitive`
- **Base:** `origin/main` at `0b448dfa` (PR #626 merged; the pack's verified tip `35e5509e` had moved on)
- **PR:** (draft, to open)
- **Goal:** FW-11.1 — move the home-hero Easy/Medium/Hard picker into each MapTap edition, with per-module storage seeded from `meridian.difficulty`.

## Done

- New registry `src/game/module-difficulty.ts`: eight modules. `globe` / `country` / `state` show the picker on all three levels, default Medium, with the home hero's hint copy (`DIFFICULTY_HINTS`, verbatim). `geodetective` / `coldtrail` / `subjects` / `review` / `challenge` are stubs (`showsPicker: false`, `supported: []`). Unit test `module-difficulty.test.ts`.
- New storage key `meridian.difficulty.byModule` (JSON map module → choice) in `src/platform/storage/keys.ts`, pinned in `storage-keys.test.ts`. The legacy `meridian.difficulty` key is untouched and left in place.
- `src/components/use-difficulty-choice.ts`: `useDifficultyChoice` works exactly as today against the legacy key. New `readModuleDifficulty` / `writeModuleDifficulty` / `useModuleDifficulty`: first read seeds globe/country/state from the legacy value (or Medium when invalid); later writes go to the map only and never clobber another module. Tests in `use-difficulty-choice.test.ts` (migration, invalid → Medium, isolation: Globe Hard leaves State alone).
- New extracted picker `src/components/difficulty-picker.ts`: labelled group, `aria-pressed` pills, live hint, chirp only on an actual change, bound to one module via `useModuleDifficulty`. Test `difficulty-picker.test.ts` (group name, `aria-pressed`, hint, stored-choice follow). Location note: the pack suggested `src/components/ui/difficulty-picker.tsx`, but `ui/` is layer 4 (shared-ui) and cannot import the layer-5 hook `use-difficulty-choice.ts` (lint:arch `layer/no-upward-import`); the picker lives at `src/components/` (layer 5, same area as the hook) instead. Written with `createElement`, not JSX, so the node unit harness can render it (the `.tsx` extension cannot run under `node --test`).
- No change to `game-app.tsx` (still 6,397 lines, at the ceiling) and no home UI change in this PR.

## Ruled out / deferred

- Kanban card FW-11 / FW-11.1 is NOT recorded in `src/build-board/kanban.json` — it still needs an owner ruling (checker locked at 18 stories / 45 subtasks). Recorded here only.
- Picker + semantics for GeoDetective, Cold Trail, Subjects — a later FW-11.x with an owner design.
- No analytics, no URL/hash persistence, no age-band changes, no GeoDetective / Cold Trail / Subject internals.

## Fix round (siloed review, 2026-11-26)

- **Seed on write:** `writeModuleDifficulty` now seeds through the shared `seededModuleDifficultyMap()` helper (same as the read path), so a write before any read still carries the legacy choice into the other MapTap modules. Write-first test added (legacy `hard`, write `globe` to `easy`, `country`/`state` read `hard`, map has all three keys, legacy key still `hard`).
- **Picker hides stubs:** `DifficultyPicker` returns `null` when `showsPicker` is `false` (or `supported` is empty). The hook stays above the return (Rules of Hooks). Tests: `geodetective` and `coldtrail` render empty; `globe`/`country`/`state` still render.
- **Chirp guard tested:** the selection step is now `selectDifficulty(next, current, setChoice, chirp)` with the guard inside; the picker's `onClick` delegates to it. Tests drive it with a stubbed chirp: changing band chirps, re-tapping the active band does not. A mutation that always chirps now fails a test.
- **Fix note:** the pack asked for a fresh `/tmp` clone, but the clone filled the 512M `/tmp` and died (`Out of diskspace` on checkout) — the repo working tree alone is ~435M. Work ran in `~/workspace/fw-11.1-worktree`, reset to the pinned head `39afb3b6` (remote head verified unchanged via `ls-remote`).

## Open questions

- None for PR 1. PR 2 needs Veeresh's word that this seat holds the game-app lock (only one open game-app PR at a time; #626 and #627 have both merged).

## Next step

- Open draft PR 1 (`feat(game): per-module difficulty registry and storage (FW-11.1)`), then PR 2 (`feat/fw-11.1-module-difficulty-home`) once Veeresh confirms the game-app lock: remove the home picker, add the Globe start screen, RegionList pickers, per-edition wiring, tours, docs, and the retargeted e2e.

## Graph

- Nodes added: `module-difficulty` (`src/game/module-difficulty.ts`), `difficulty-picker` (`src/components/difficulty-picker.ts`), `difficultyByModule` key (`meridian.difficulty.byModule`).
- Edges: `difficulty-picker` depends-on `module-difficulty` and `use-difficulty-choice`; `use-difficulty-choice` depends-on `module-difficulty`; `difficultyByModule` supersedes (for new writes) `meridian.difficulty`.
