# Go: Phase 0a, held until PR 542 lands

Run `meridian/architecture/phase-0a-constitution-amendment.md` as written, with these release-train additions (see `meridian/architecture/release-train.md`). Where they differ, these win.

1. **Start now** on branch `docs/amend-constitution-extraction` from current `main` (cef9af3c or newer). Tier 1, cap 100k, estimate 35k-50k. State both in your first message.
2. **Open as a draft PR and hold.** Do not mark it ready while PR 542 is open.
3. **When 542 is on main:** bring the branch up to the new main (GitHub "Update branch", or a fresh branch from main plus `git cherry-pick` of your commits; no rebase, merge or force push). Fix any conflict on the branch.
4. **Rerun on the synced head:** typecheck, `npm test`, `lint:nav`, `npm run check:provenance`, and the panel's re-vote on the final tip.
5. **Touch only AGENTS.md and the files the 0a prompt names.** No code.
6. **Report (pstack:teach + i-have-adhd):** outcome line, synced head SHA (full), gates PASS/FAIL/NOT RUN, tokens used vs cap and cost (estimates), PR link. Then stop. Veeresh merges, pinned to that SHA.

Pushing to the branch is authorized. No Co-Authored-By, no AI trailers, no model, vendor or agent names.
