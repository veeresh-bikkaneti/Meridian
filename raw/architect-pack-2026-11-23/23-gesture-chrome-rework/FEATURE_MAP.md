# Meridian feature map — device-feedback round + question pool

Base: `origin/main` @ `c740932` (PR #9, endless game flow). Updated 2026-09-30.
Owner of this file: Chitti. The crew updates the Status column as tracks move; nothing
merges without the standard gates (typecheck, unit, build, targeted E2E, 4-role reviews).

## Tracks

| #   | Feature | Branch | Depends on | Status | Notes |
|-----|---------|--------|------------|--------|-------|
| F1 | Pinch zoom / zoom-out repair (all modes × projections) | `fix/pinch-zoom` | — | merged | Root cause: CDP synthesizePinchGesture dispatches wheel, never touch — old probe measured scrollZoom, not pinch. MapLibre's pinch path verified correct in all modes with real TouchEvents; NO production code changed. 12-test E2E regression spec (real TouchEvents, 390×844 touch viewport) green on fresh build; 4-role reviews approved with notes, all addressed. MERGED 2026-09-30 as PR #11 (merge conflict in playwright.config.ts resolved: kept both projects). Remote + local branches deleted. Known risk: synthetic events bypass the real touch pipeline — physical-device sanity check on Veeresh's phone still open |
| F2 | Region boundary highlight clarity + progressive zoom-band boundary reveal | `fix/region-highlight` | — | merged | Unmistakable stroke/fill for quiz region; progressive boundary reveal in zoom bands (continents → countries → states/provinces), NO text labels at any zoom; boundaries subtle, never competing with quiz highlight. FIXED 2026-09-30: reduced-motion H2 root cause was `"*-transition": undefined` failing MapLibre style-spec validation — `addLayer` silently drops such layers. Fix omits the keys when instant. H1+H2 green (11.3k gold px, stillness diff 0); 12/12 units; typecheck clean; 4-role review APPROVE. MERGED 2026-09-30 as PR #10 — first in queue, fixes Veeresh's live bug (state/country borders not highlighted on live c740932). `tests/e2e/helpers.ts` committed on the branch, also fixing the latent main break. Remote + local branches deleted; live bundle fingerprinted with `region-highlight-fill` |
| F3 | Globe spin speed | `fix/globe-spin` | `50d3d7a` | merged | SPIN_SPEED_DPS 6 → 30 (intro rotates 36° over 1200 ms = one revolution per 12 s). Typecheck, 113/113 units, build, 4-role review green. MERGED 2026-09-30 as PR #12. Remote + local branches deleted. Physical-device feel still unverified |
| F4 | Question randomization: per-session shuffle, per-cycle reseed, persistent no-repeat history | `feat/question-randomization` | — | merged | Kills the 5-restarts-same-first-question symptom; daily-challenge mode (if separate) may stay deterministic. MERGED 2026-09-30 as PR #13 (conflicts resolved: .gitignore kept main's `*.tmp.mjs`; playwright.config.ts kept all 3 projects; helpers.ts = main's newer version + F4's path-traversal clamp, dismissTileOverlayIfPresent, generous timeouts). Ships with resume behavior — Veeresh never answered resume-vs-fresh. Remote + local branches deleted; live bundle fingerprinted with `meridian:seen:v1:` |
| F5 | Tap preview/lock-in verification + visual distinction | `fix/tap-verify` | — | merged | Semantics kept (single-tap preview, double-tap locks); touch E2E green (4 runs); hollow preview pin vs solid committed pin; all 4 role reviews done, notes addressed. MERGED 2026-09-30 as PR #14. Remote + local branches deleted. Physical-device touch still unverified |
| F6a | Place-dataset groundwork | — | — | complete | APPROVED by Veeresh 2026-09-30; BUILT the same day. Natural Earth 10m populated places (7,342 features, 19.4 MB raw, public domain, one-time download from Kelso mirror) → `data/generated-places.json` (0.85 MB): 3,468 generated places + 327 curated refs. Hyderabad gate in pipeline (leave-one-out country boxes from source geometry + 15° corroboration): 0 rejections, 46 warnings (hand-verified), 3 curated-dedup drops. Independent verify gate: 100% pass through real F7 `validateGeneratedPlace`. Negative test (Badville/Goodville) proves the gate end-to-end. All 4 review roles APPROVE-WITH-NOTES, findings addressed. Deliverables in `~/workspace/meridian-place-dataset/` (scratch only — nothing committed/pushed; dataset + `scripts/build-places.mjs` land on `feat/place-dataset` after F4 merges) |
| F6b | Place-dataset implementation | `feat/place-dataset` | F8 merged ✓ | PR-ready | REBASED 2026-09-30 onto F8's main `f80d5ff` (was `5cef8a8`): 10 commits on `feat/place-dataset` (worktree `~/workspace/meridian-worktrees/f6b-review-fix`, shared clone untouched). Dealing merge per F8's documented F6b contract: `placesFor()` now routes the merged catalog (`fullCatalog()`: curated STARTERS + all generated) through F8's fail-closed `buildRegionPool`; picker `poolSize` counts the merged catalog leniently. Approach C (curated-first): 327 curated starters keep priority/full stories, 3,468 generated places add depth with factual blurbs; F4 shuffle/history contract preserved. F7 gate: `prebuild`/`prebuild:pages`/`prebuild:dev` run `check-generated-places.mjs` — 3,468/3,468 validated, 0 violations, mismatches fail the build loudly (proven with negative tests). Gates on rebased tree: tsc clean, 201/201 game/map units (incl. F8 pool + F6b dataset tests), 396 scripts pass / 16 pre-existing .grok failures only, build:pages passes, question-randomization 3/3 on built artifact (pre-rebase tree). 4-role review: all APPROVE-WITH-NOTES, findings fixed. E2E on rebased tree: 9/9 green (3 question-randomization + 6 drilldown) on the built Pages artifact. Branch is merge-clean onto `f80d5ff`. Needs Veeresh's go-ahead + fresh PAT to push/PR |
| F7 | Place-data integrity — the Hyderabad rule | `fix/place-data-integrity` | — | merged | URGENT (Veeresh 2026-09-30): every place's coordinates must match its claimed location. One-time audits: 106-place catalog — ZERO mismatches; 327-place starters pool — ZERO mismatches (3 initial flags were box errors, corrected). Permanent gate: `src/game/validate-places.ts` + `validate-places.test.ts` (10/10, locks all 433 places in); `validateGeneratedPlace` ready for the F6b import pipeline. Typecheck clean; 4-role review APPROVE. MERGED 2026-09-30 as PR #15 (package.json test script = union of all three new spec files). Remote + local branches deleted |
| F8 | Hierarchical edition drill-down + strong dealing policy | `feat/edition-drilldown` | 6cca562..e473adf (4 commits) | merged | Veeresh 2026-09-30: no more USA assumption on "State" — drill-down picker (Choose → Country list → US State list, each level playable) + fail-closed `buildRegionPool` dealing policy. BLOCKED 2026-09-30 ~13:07 CDT: second attempt's implementer was ALSO stopped by a spurious safety refusal on benign game UI work — per policy not retried, rephrased, or routed around. Branch `feat/edition-drilldown` exists from origin/main (5cef8a8) with a clean tree — no implementation landed. Subagent swarm confirmed unable (2 refusals); built DIRECTLY by the main agent 2026-09-30 ~13:15 CDT, step by step: ADMIN1_BY_COUNTRY in regions.ts, fail-closed buildRegionPool + 5 unit tests, drill-down picker in game-app.tsx (Choose: Globe/Country; Country list: 13 playable countries, USA drills to states; US State list: Play-entire-US + 50 states), 6 E2E on built artifact. Gates: typecheck clean, units 193/193 game-map-lib pass + 179 pass/16 known .grok scaffold failures on scripts half, build passes, E2E 6/6. 4-role self-review done (no swarm per Veeresh). PRE-EXISTING ISSUE FIXED 2026-09-30 ~13:30 CDT (commit bd7d9b3, per Veeresh's order): `npm test` `&&` short-circuited — the 16 failing .grok scaffold tests in scripts/** prevented the game/map unit half from ever running (baseline "179 passed" was scripts-only). The script now runs both halves and fails if either fails: 195 scripts tests (179 pass, 16 known .grok failures, zero new) + 193 game/map/lib tests (193 pass, 0 fail). MERGED 2026-09-30 ~13:40 CDT on Veeresh's order: `main` = `f80d5ff` (merge PR #17); remote + local branches deleted; live site redeploys from main |

## Dependency graph

```
F1 ─┐
F2 ─┤
F3 ─├──► each PRs to main independently when green
F5 ─┘
F4 ─────► merges first, then F6b branches from main
F6a (dataset build, complete) ──► F6b (wires dataset into dealing)
```

## Shipping record (2026-09-30 ~12:45 CDT — Veeresh: "Ship everything reviewed")

All six PRs merged to `main` (`5cef8a8`) via the PR flow with a fresh one-time PAT (used once, shredded after), remote branches deleted:

1. **#10 F2** `fix/region-highlight` — Veeresh's live border-highlight bug
2. **#11 F1** `fix/pinch-zoom` — conflict in playwright.config.ts resolved (kept both projects)
3. **#12 F3** `fix/globe-spin`
4. **#13 F4** `feat/question-randomization` — conflicts resolved (.gitignore kept main's `*.tmp.mjs`; playwright.config.ts kept all 3 projects; helpers.ts = main's newer version + F4's extras)
5. **#14 F5** `fix/tap-verify`
6. **#15 F7** `fix/place-data-integrity` — package.json test script = union of all three new spec files

Post-merge gates on `5cef8a8`: typecheck clean, build passes, units 179 pass / 16 fail (known pre-existing `.grok` scaffold failures, zero new). Pages workflow succeeded; live bundle fingerprinted with F2 (`region-highlight-fill`) and F4 (`meridian:seen:v1:`) markers — the new code is serving.

Local cleanup done: all six worktrees removed, local branches deleted, `~/workspace/meridian-build` main reset to `5cef8a8`, `feat/place-dataset` cut from `5cef8a8` (local). F6b wiring awaits Veeresh's go-ahead.

## Rules

- One feature branch per track, cut from `origin/main`. No batch branches.
- Independent tracks run in parallel via subagents; a blocked track never stalls the others.
- Each feature gets its own PR when green; PR needs Veeresh's go-ahead + fresh PAT (repo ruleset blocks direct push to main).
- Atomic commits on the feature branch; stage named files only.
- The abandoned `feat/device-feedback` branch (zero commits) is deleted locally to avoid confusion.
- Keep this file's Status column current: pending → in_progress → in_review → merged.
