# BRANCH_STATUS — claude/hopeful-darwin-dp7ket (constitution in AGENTS.md)

**Ready for review. Owner merges.** One job: record the owner's four standing rules as a "Constitution" section in `AGENTS.md`. Docs only; no code.

## Done
- `AGENTS.md`: new "Constitution" section above "Quality gates": (1) do not refactor existing working code; (2) do not create new branches or duplicate files; (3) edit only the targeted functions, in place; (4) output only unified git diffs when showing code changes.

## Owner decisions to confirm in review
- **Rule 2 vs. the branch workflow.** `main` is protected (feature branch -> PR -> merge) and every feature branch carries this file. I read rule 2 as "no extra branches: use the assigned or checked-out branch, and ship it as a PR". The section says so in one sentence. Delete that sentence if you meant something stricter.
- **Rule 4** is written to apply to showing code changes, not to status reports or PR descriptions.
- **Added line (mine, not yours):** "If a task cannot be done within these rules, stop and ask first."

## Unpushed-work check (2026-10-21)
- Everything from this session's tasks is pushed and merged: #155, #161, #163, #164, #146.
- The only local branch with no upstream, `docs/perf-summary`, is the same commit (`62895ea`) as the head of merged PR #150; its files are on `main`.
- Local branches marked `[gone]` had their remotes deleted after merge.

## Not verified
- No code changed, so no build or test was run. CI on this PR runs `build (22.x)`.
