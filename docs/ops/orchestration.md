Read this whenever a task uses helper agents. It adds to AGENTS.md sections 4 to 6 and reference sections I and J. AGENTS.md wins if they differ.

## 1. Roles

| Role     | Tier                           | Job                                                                                                |
| :------- | :----------------------------- | :------------------------------------------------------------------------------------------------- |
| Lead     | Strongest affordable           | Splits the work, writes briefs, runs the gate, integrates, reports. Never writes the bulk.         |
| Worker   | Cheaper capable                | Builds, writes, searches, tests. Never reviews its own work, merges, or pushes outside its branch. |
| Reviewer | Cheaper capable, clean context | ACCEPT or REJECT against written pass/fail lines. Never rewrites.                                  |

Council seats are in AGENTS.md section 5. Do not copy them here.

## 2. Size the effort

Tiers map to AGENTS.md section 3. Inside a tier:

- tiny (1 file, under 20 lines): 1 worker, the gate, then 1 reviewer.
- normal: 2 to 4 workers on separate files, the gate, then 1 reviewer.
- risky (security, privacy, data, `src/game/data/`): Tier 2 council.
- Do not spawn helpers when one call answers it.

## 3. Briefs

Every brief carries the 9 fields in reference section J. Add only:

- `path:line` pointers instead of pasted files.
- The exact verify command.

## 4. Token rules

- The cap is the AGENTS.md section 4 tier cap, shared by the lead and every helper. Nobody raises it except Veeresh.
- After each helper returns, the lead adds the helper's reported usage to a running total. At 80 percent, the lead spawns nothing more and asks Veeresh.
- A helper that overran gets a smaller brief next time, never a bigger cap.
- Helpers return 150 words or fewer, plus paths and the SHA. No pasted files or logs.
- The reviewer's evidence pack is only the diff, the gate output and the spec section. Pay for facts once (section 4).
- Escalate a worker one model tier only after it fails the same gate twice.

## 5. Gates before review

The section 9 gates, `npm run lint:subjects` and `npm run check:provenance` pass before any reviewer sees the work. Test narrowly per section 4, "Testing on a budget".

## 6. Review rounds

At most 2. A second REJECT stops the run and goes to Veeresh. This sits inside section 6's debate cap.

## 7. Quality floor

Never weaken a check or an assertion. The lead re-runs the gate itself before it says done.

## 8. Report

Per tier: tokens (estimated if no meter) and the verdict.
