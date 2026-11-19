# feat/lose-path-all-items-v2 — branch status

**Task:** L1 lose-path gate flip (authorised 2026-11-16): generalise the fair-share pilot's gate (PR #503) so EVERY question that has a solved summary gets the identical lose-path reveal — the answer-first line, then the existing act-3 summary, media unchanged. Pure L1 only: no per-band composite extras, no new clips, no new scene kinds, no new authoring. Draft PR only — the owner merges.

**REBUILT 2026-11-17 onto main `330925a9` (#535's squash).** This is PR #514's two commits (`0f55d2b1`, `81025d91`) cherry-picked onto current main as `feat/lose-path-all-items-v2` — no merge, no rebase, no push yet. The cherry-pick carried the PR's changes over verbatim. The branch's task and coverage accounting are unchanged from the first rebuild; see the archived `feat-lose-path-all-items.md` in this directory for the full 37-pair coverage derivation against the 115-question registry.

**Nothing from main was deleted.** The only pick conflict was `clue-scene.test.ts` (both sides touched the lose-reveal assertion's comment); it was resolved by keeping main's line — which already reads the #533 rename — and layering the PR's comment on top. After #533 renamed `SubjectCase`'s prop `testIdPrefix` to `subjectId`, the PR's own unit suite (`lose-path-all-items.test.ts`) still referenced the old name in three places; those were fixed to `subjectId` in a separate corrective commit. No test was deleted and no assertion was weakened.

**Done:**
- Cherry-picked `0f55d2b1` and `81025d91` onto `origin/main` (`330925a9`); conflict in `clue-scene.test.ts` resolved keeping main's tests plus the 514 cases.
- Fixed the three `testIdPrefix` → `subjectId` references the #533 rename made stale.
- Gates run on this worktree: typecheck, unit suite, `lint:nav`, and the three targeted Playwright specs (`math-lose-path-all-items.desktop`, `math-fair-share-lose-path.desktop`, `math-subject`) with `--workers=1` against the built artifact; see the PR body for the recorded numbers.
- Mockup captured: a wrong-pick state of one Math item, before (main: no solved summary) and after (this branch: the solved summary revealed), saved as untracked PNGs in the main checkout root.

**Next step:** push the branch and open the draft PR for review; the owner merges after the panel approves the final tip.

**Open questions:** (1) The lose/win reveal still has no focus move or screen-reader announcement — a follow-up for both paths, not this PR. (2) The one-hook mirror for the 62 wave-exception items outside Math remains a separate follow-on. (3) Whether the archived `feat-lose-path-all-items.md` should be superseded by this file in the graph is an integrator call when the branch merges.

**Ruled out:** No per-band composite extras, no new clips, no new scene kinds, no new authoring; no CSS changes (the reveal reuses the win path's scene and panel, so whatever #511 settled for the win path applies identically); no edits outside the PR's file list; no merge, rebase or push performed by the builder.

## Graph

- Add node: the generalised L1 lose-path gate (`showsSummaryOnWrong` as a property of the item, `src/subjects/math/scenes.ts`) — supersedes the pilot's single-item gate node from `feat/fair-share-lose-path`.
- Add edge: the gate `depends-on` the Math scene record (`MATH_CLUE_SCENES`) and the playable registry (`itemsForGroup`).
- No existing nodes or edges changed.
