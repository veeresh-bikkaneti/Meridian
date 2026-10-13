SAFE TO MERGE: NO - consolidation in progress
LOCK: orchestrator 2026-10-13T18:58:00Z

# BRANCH_STATUS — claude/hopeful-darwin-dp7ket (PR #148, single working branch)

Owner merges. This branch carries all perf work; #149 and #150 are folded into it.

## Done
- Task 1 harness: `scripts/bundle-report.mjs` (+test), `scripts/perf-globe-easy.mjs`, `docs/perf-baseline.md` (baseline + Task 2 before/after).
- Task 2 (was #150): Globe places split into five fame-tier files, loaded per learning path, merged back to canonical order; canonical `globe.json` stubbed out of bundles.
- Task 5 (was #149): 34 unused dependencies removed; unit tests globbed (`src/**/*.test.ts`).
- WS-0: kill switch `globeTierSplit` (default false = full Globe pool; code commit). `public/flags.json` enabling it is a separate commit; revert that commit alone to turn the faster path off.

## Pending
- Gates on the consolidated branch; WS-0 .. WS-6 per the orchestrator brief.
- Scout fix (`feat/scout-offer-accept-sticky`, 60abd46): D6 not chosen → left alone.
