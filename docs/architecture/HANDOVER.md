# Meridian architecture handover (2026-11-22)

Read this first if you are taking over the architecture cleanup or the coordinator role.
Every fact here was checked against the repo on `main` = `5930e9304bccb9eb38db7ce57bd04698c416be61` (#573) on 2026-11-22. Re-check with `git rev-parse origin/main` before relying on any number.

## 1. Goal and "done"

- Goal (owner's words): "setting solid foundations on design patterns, architecture and microfrontend, component designing all best practices and guardrails", "Clean and solid principle", "Code can scale, without breaking."
- **Done** = every architecture baseline is empty **and** Phase 5.5 is merged.
- Full plan: `docs/architecture/plan/README.md` and one file per phase in the same folder.
- Ready-to-paste prompts for every next ticket: `docs/architecture/prompts/INDEX.md` (start with `00-coordinator-resume.md`).

## 2. Baselines today (shrink-only, never raise)

| Baseline | File | Count on main | Target |
|---|---|---|---|
| noRawIo | `eslint/layer-baseline.json` | **45** (PR #571 takes it to 13) | 0 |
| noUpwardImport | `eslint/layer-baseline.json` | **129** | 0 |
| shell-ban | `eslint/shell-ban-baseline.json` | **14** | 0 |
| Entry size | build gate | ~323,280 B of 323,865 B limit | never raise the limit |

- `src/components/game-app.tsx` is **8,894 lines** (Phase 4 splits it).
- Layer rule: `eslint/layer-rule.mjs` `classify()`. Layers: content 1, domain 2 (`src/game` + `src/lib` `.ts` only), platform 3, shared-ui 4 (`src/components/ui`, `src/hooks`), feature 5, shell 6 (`src/routes`, `src/router.tsx`, may import anything). Cross-area imports at feature level also fire.
- `scripts/layer-baseline.test.mjs` fails on stale baseline rows. Remove rows you fix.

## 3. Roadmap status

### Done

| Item | PR | Merge SHA |
|---|---|---|
| Phase 0 guardrails + 0a constitution amendment | earlier | on main |
| Phase 1 Part A (platform ports) | #569 and earlier | `38468953` |
| Phase 3 content projection: all 5 subjects are validated records (social studies last) | #572 | `9b32d31a` |
| Phase 4 PR 1: game-app map (`docs/architecture/game-app-map.md`) | #570 | `b1185a25` |
| Upward imports A: noUpwardImport 154 to 129 (25 of 26 cleared) | #573 | `5930e930` |
| Phase 5.1 to 5.4 | earlier | on main |

### In progress

| Item | Where | State | Next step |
|---|---|---|---|
| Phase 1 Part B: game-app raw IO to ports | PR #571, branch `phase1/ports-part-b`, head `acf8b24d32ce88d5a3f4ccb1ae2fc0b04c17733b` | noRawIo 45 to 13, 8 files, merges cleanly with main | Full review, then merge (stop if any check fails). Its status doc `docs/branch-status/phase1-ports-part-b.md` is stale ("B1 next"); fix it in the review. |
| Phase 2 shell sweep | branch `phase2/shell-sweep` (not pushed yet) | Assigned | Mockup first, stop for owner's OK, then code. Covers 36 upward rows in Phase 2 files, site-footer 2, shell-ban 14. |
| storyteller-home ports | not reported | Assigned | 1 fetch + 2 Audio to ports. |
| Retire GitHub Pages | not up | Assigned | Remove `pages.yml`, then drop github.io links. **Keep** `build:pages` (CI gate). Live site is workers.dev only. |

### Not started (in order)

1. **Phase 4 module PRs** (after #571 and Phase 2). One module per PR, serial, 6 to 8 PRs. PR 2 adds a shrink-only size-budget test for game-app. The 21 game-app upward rows are the extraction checklist. Moving game-app to `src/routes` is the **last** PR, only once it is thin.
2. **Upward imports B = "subject contracts"** (after Phase 2). Move the shared pure types down one layer once for all subjects (registry types, `shared/answer.ts`, clue-scene types, `shared/ClueScene` + `SubjectCase`, `CelebrationSpec`), plus a ruling on the shared runtime kit. Covers 45 + 9 rows.
3. **Phase 5.5** (last). Removes the final gates once baselines are empty.

### Owner rulings still needed (from #573's 16 leftover rows)

1. Treat non-code assets (CSS, webp, json, `src/assets`; 6 rows) as the bottom layer. Lint config change.
2. Give the map crash marker (`src/lib/observability.ts` importing `../map/capability.ts`) a domain home that takes the storage port as a parameter.
3. Leave atlas-map's 9 map-engine rows for Phase 4.

## 4. Tech debt list

- #573 follow-ups: move `pack-shelf-data` to `src/lib`; delete the 9 re-export shims left at old paths.
- `contact.tsx` form-seam port wiring (credentials omit, no-referrer). The `board.tsx` side needs Phase 2.
- Phase 1 leftovers: `class-variance-authority` unused; 534 test-stub guards in production code; `use-transport.ts` unused since #565.
- Add `@storybook/react` devDependency (local tsc and `ci:required` fail on stories).
- Local validators need `npm i --no-save zod` in a fresh worktree.
- Storage slice (#563): private mode on a real device not proven.
- Crash worker: redeploy, then run smoke (owner's step).
- Test debt: detective-endings spec; grandpa-coffee-run desktop 7 tests; 1 math e2e failure; 28 lint errors; 4 browser failures on main (chunk 13-E, storyteller-audible, tap-pending R and W); flake #460. Lose-path reveal has no focus or screen-reader announce.
- Repo weight: ~14 MB screenshots in `docs/motion-verify` (#551, #547).
- Pages workflow fails every run until `pages.yml` is removed.

## 5. New-feature backlog (not architecture)

- Landmark globe: 360 spin, zoom, mouse and touch, slow loop rotation, "premium cinematic". Secular landmarks only, original models.
- Live-site fixes from the 2026-11-19 walk: coffee bubble covers 2 footer links; tour card covers Home hero sound and Contrast controls; detective pair looks flat.
- Clue films and stills: ffmpeg from stills first; blocked on GPU media download.
- Pennant port (`feat/pair-session-moments`).
- Science spec (#429) needs educator review before merge.
- Open issues: #478, #344, #319. Adult-band rows playable.

## 6. How the work runs (rules the owner set)

- **Builders are cheaper agents.** The coordinator plans, writes copy-paste prompts, reviews and verifies. Never name a model or vendor in prompts, commits or PRs (`check:provenance` enforces it); say "cheaper models".
- Every prompt: full rules pasted in, ownership fences, "Do nothing outside this task", token cap from `AGENTS.md` (tiers 25k/100k/400k) with an estimate, stop and ask before passing the cap.
- **Release chain:** any branch on an old main takes the latest main and fixes conflicts before it merges. Shared hot files (`eslint/layer-baseline.json`, `eslint/shell-ban-baseline.json`, `src/platform/storage/keys.ts`, `package.json` prebuild, `eslint.arch.config.mjs`, `docs/ops/deploy-contract.md`): take main's copy, re-apply your own lines.
- The owner's CLI blocks `git merge*`, rebase and force push. Use cherry-pick or `gh pr update-branch`.
- **Merges only on the owner's word**, naming each PR. Merge prompt template:
  ```
  gh pr ready N
  gh pr merge N --squash --admin --match-head-commit <full SHA> --delete-branch
  ```
  Stop if **any** check is not green, required or not. CI takes about 30 minutes.
- "Clean up should follow the merge": every merge deletes its branch. **Never delete** these branches without a PR: `chore/graphify-ignore`, `design/detective-moments-prototype`, `design/hero-trekker-prototype`, `design/home-rework-variants`, `feat/board-controls`, `feat/pair-session-moments`, `feat/why-learn-film-dolly`, `feat/why-learn-film-redo`, `fix/e2e-offline-preload-assertion`, `fix/endgame-editions`, `mockup/514-lose-path-reveal`, `mockup/scale-play-v2`.
- Verify a branch before suggesting to close it.
- No untested code merges. Targeted tests only, no full regression.
- Always show a working mockup before UI code. Ship progressively, not waterfall.
- Live-site claims need a real browser walk.
- Commits are authored as the repo owner with Conventional Commit messages and no AI trailers.

## 7. How to verify an agent's report

1. `git fetch origin main pull/N/head:pr-N` and `git rev-parse` both.
2. `git merge-tree --write-tree origin/main pr-N` for a clean merge.
3. `git diff --stat origin/main...pr-N` and check the files match the stated fence.
4. Count baseline rows on both sides (`node -e` over `eslint/layer-baseline.json`).
5. In a worktree: `npm i --no-save zod`, run the validators and the targeted tests the PR names.
6. Report: head SHA, file count, merge state, counts, tests run and what you could not check.

## 8. Product rules that bind every change

- Mission: show children why they learn division, multiplication, trigonometry and algebra through real use.
- Free to all, no revenue.
- Age bands 7-10, 10-18, 18+; nothing under 7; ask first, no default band.
- No biology. Subjects math, physics, chemistry linked by environmental studies (plus social studies).
- No controversial topics; religious sites as architecture only; Ram Setu named with both names, origin not narrated.
- Rich 3D and motion. Reuse the production UI (Living Atlas is the baseline).
- Audio: only one voice at a time.
- Reveal the answer on the 2nd wrong try, with "Good try, this one was tricky. Let's look at how it works."
