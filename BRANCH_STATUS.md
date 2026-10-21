# BRANCH_STATUS — claude/hopeful-darwin-dp7ket (constitution in AGENTS.md)

**Ready for review. Owner merges.** One job: record the owner's four standing rules as a "Constitution" section in `AGENTS.md`. Docs only; no code.

## Done
- `AGENTS.md`: new "Constitution" section above "Quality gates": (1) do not refactor existing working code; (2) do not create new branches or duplicate files; (3) edit only the targeted functions, in place; (4) output only unified git diffs when showing code changes.
- `AGENTS.md`: new "Agent council" section — a 3-tier table deciding when the TDD/ATDD council convenes (Tier 0 direct / Tier 1 solo TDD / Tier 2 council), plus a one-line summary of Tier 2. 16 lines; the protocol itself is not in this always-loaded file.
- `docs/ops/agent-council-protocol.md` (new): the Tier 2 protocol — four seats with model tiers, four phases, the Signed Consensus Manifest, and the post-token execution loop. §3 rules 4-5 separate the two levers the draft conflated: seat models cut cost per token, while the tier gate / narrow context / delegation cut the token count — and a council below Tier 2 costs more than doing the work directly, whatever model the seats run.

## Where the council protocol departs from the owner's draft
Each is reversible; say the word and it goes back.
1. **Split in two.** The draft was ~150 lines. Pasted into `AGENTS.md` it would load on every task, including a typo fix — against its own §3 token-economy rule. `AGENTS.md` gets a 16-line trigger table; the protocol lives in `docs/ops/`.
2. **Added a tier threshold.** The draft has no "when does this apply", so a 4-seat council would convene for a one-line doc change. Added Tier 0/1/2 with "unsure → Tier 2".
3. **Graphify replaced.** It appears nowhere in this repo or in the session's tools. The clause now names `Grep`, `Glob` and the `Explore` agent, and says to prefer a graph plugin if one is ever installed.
4. **Web-search mandate scoped.** Kept for external library/API facts; repo facts are read from the repo; place data stays under card rule 5 (curated notes or the verified pipeline — a web search is not a source for it).
5. **Duplicates folded.** The draft's directives 3 and 4 restated Constitution rules 1 and 4; they now cross-reference instead of restating.
6. **Deadlock cap.** "Unanimous?" with a seat whose job is to object has no exit. Two challenge rounds, then the Chair decides and records the unresolved objection verbatim in the manifest.
7. **"Execution abort" made actionable.** Nothing in the harness aborts; it now reads "revert the file and restart at Phase 1".
8. **Model tiers made concrete.** Chair `opus`, councilors `sonnet`/`haiku` — real `Agent` tool values.
9. **Gates named.** The manifest and execution loop cite this repo's actual gates instead of generic RED/GREEN.
10. **Repo-specific protected paths** added as manifest defaults: `src/game/data/**`, `package-lock.json`, `.scratch/`, other branches' worktrees.

## Owner decisions to confirm in review
- **Rule 2 vs. the branch workflow.** `main` is protected (feature branch -> PR -> merge) and every feature branch carries this file. I read rule 2 as "no extra branches: use the assigned or checked-out branch, and ship it as a PR". The section says so in one sentence. Delete that sentence if you meant something stricter.
- **Rule 4** is written to apply to showing code changes, not to status reports or PR descriptions.
- **Added line (mine, not yours):** "If a task cannot be done within these rules, stop and ask first."

## Unpushed-work check (2026-10-21)
- Everything from this session's tasks is pushed and merged: #155, #161, #163, #164, #146.
- The only local branch with no upstream, `docs/perf-summary`, is the same commit (`62895ea`) as the head of merged PR #150; its files are on `main`.
- Local branches marked `[gone]` had their remotes deleted after merge.

## Not verified
- No code changed, so no build or test was run. `build (22.x)` passed green on the Constitution commit (`f131c33`) and re-runs on this one.
- The council protocol has never been executed end-to-end. It is a written process, not a tested one.
