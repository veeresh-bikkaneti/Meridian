# BRANCH_STATUS.md — feat/geodetective-clues (GeoDetective clue-set production)

**Branch:** `feat/geodetective-clues` · **Base:** `origin/main` @ `3c32085`
**Worktree:** `~/workspace/meridian-worktrees/geodetective-clues`
**Mission:** Produce ≥365 validated 5-tier clue sets for GeoDetective's curated famous-place pool — content pipeline only. Deliverable = this branch: clue JSONs in `public/loop/clues/`, composer + validator scripts with tests, and a validation report. No merge, no PR — Veeresh decides. The human-reviewed gate stays Veeresh's (expect sampling review).

## Verified 2026-10-03 (first-hand, parent agent)

- [x] PR #34 confirmed: draft, `feat/meridian-loop` → main, "DO NOT MERGE: blocked on 365-clue content gate". GeoDetective mode code is Chitti's crew's — this branch never touches game/mode code.
- [x] The 12 seed clue sets exist ONLY on `origin/feat/meridian-loop` (`public/loop/clues/0.json`–`11.json`, manifest size 12). `public/loop/` does NOT exist on main. Seed schema: `{v, placeId, target{lon,lat}, clues[5 strings], source{label,href}}` — no per-clue source fields, no difficulty, no aliases.
- [x] `docs/geodetective.md` (on feat/meridian-loop) confirms the ladder Geography → Climate → History → Hook → Giveaway (positional), climate non-redundant vs geography, tier 5 = giveaway not summary, clue file never contains the place name, ≥365 validated-set gate.
- [x] Wikipedia crawl complete on `feat/wikipedia-crawl` (remote `a9c8bb9`): 124,312 unique cached IDs, 71,957 matched extracts, 9,129 hook candidates. Chitti's merge of that data is NOT on main yet (main still `3c32085`, verified 2026-10-03 16:22 CDT).

## Open spec items (do not redesign around these)

- [ ] **Design record** `meridian-loop-brainstorm/synthesis.md` — lives on Chitti's VM; not on this VM. Requested.
- [ ] **Content team's rewritten 5-tier generation prompt** — not on this VM, not in the repo on any branch. Per the brief it is adopted **verbatim** and nothing is generated until it is adopted. The composer therefore loads the prompt from `scripts/clues/generation-prompt.md` (to be dropped in verbatim on arrival); the build proceeds around that socket. Production generation stays gated on adoption.

## Plan

- [ ] **Phase 1 (in progress, Liz go-ahead 2026-10-03):** composer + hardened validator built to the brief's validation bar (name-leak ban incl. aliases, per-clue source fields present and traceable to the source extract, rejection path exercised, kid-appropriate reading level, difficulty + aliases recorded; climate non-redundant vs geography; tier 5 is a giveaway). Proven on the 12 seed places (read from `origin/feat/meridian-loop` as reference input — that branch is never modified). Scripts + tests + a seed-proof validation report on this branch.
- [ ] **Phase 2 (blocked on Chitti's signal):** full production pass against the **merged** dataset on main (History/Hook tiers draw on the real merged hooks — never generate the 365 from the pre-merge dataset). Output: ≥365 validator-passing sets in `public/loop/clues/*.json` + validation report (generated / accepted / rejected with reasons).
- [ ] Veeresh's human review + merge decision.

## Rules

- Content pipeline only: clue composer/validator scripts + `public/loop/clues/*.json`. No `src/game`, no `src/components`.
- Never invent facts; every clue traces to its source extract; fail closed (reject rather than guess).
- Stage named files only, never `git add -A`. Push early and often.
- No merge to main, no PR without Veeresh. Never run the Wikipedia `merge` step from this branch.
