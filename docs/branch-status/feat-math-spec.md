# Branch status — `feat/math-spec`

| Field | Value |
|---|---|
| Task | Stage A: applied-math spec (measurement, rates and algebra, geometry and trigonometry) |
| Scope | `docs/scaling/math-spec.md`, `docs/scaling/math/applied/**`. No `src/subjects/math-applied/` |
| Status | Stage A written. Build **GATED**. Branch name awaits owner decision D5 |
| Synced | `origin/main` merged at session start (already up to date) |

## Done

- Standard §9 block added to `docs/scaling/math-spec.md` (applied-strand section).
- 35 items (PROPOSED: 11 in `7-10`, 23 in `10-18`, 1 in `18+`) as contract I2 data in `docs/scaling/math/applied/items.json`.
- Groups follow the standard's grade (`7-10` grades 2–5, `10-18` grades 5–12, `18+` beyond grade 12). High-school codes are `10-18`.
- Each item has an observable objective, a CCSS code with a live source or `UNVERIFIED`, a why-first problem, a group, `buildsOn`, and one use-it-elsewhere round.
- Number-strand skills are cited by I2 id only (from `feat/math-definition` at `9f87b717`), not copied.
- Algebra and trigonometry are `10-18` and `18+` only.
- `node --test docs/scaling/math/applied/items.test.mjs` checks the shape. No app code, so no `AGENTS.md` code gates were run.

## Open

- **D5.** Build branch name awaits owner decision: `feat/math-spec` or `feat/math-tricks`. This branch stays `feat/math-spec` until the owner picks.
- **Stage B.** Not started. Needs the build gate lifted and D5 picked. v1 candidate is a Measure-Up ramp (PROPOSED), because a trip is rates-only and cannot serve `7-10`.
- Educator sign-off: blank. Gate stays GATED.
- Number-strand ids are not on `main` yet. If `feat/math-definition` renames one, this branch updates `buildsOn`.
- `src/game/learning.ts` is not ours. No edit asked until Stage B needs a `setting` field.
