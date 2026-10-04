# BRANCH_STATUS.md — fix/result-card-edition-header

Follow-up to PR #56 (question-card fix). The crew fixed the question bubble's header (`bubbleHeaderText`: "Country · United States") but the reveal/result card still rendered the bare region name.

## Done
- [x] `src/components/result-card.tsx`: both header sites now use `bubbleHeaderText(run.edition, run.regionName)` — matches the question bubble exactly
- [x] Gates: `tsc --noEmit` clean; result-card + question-label unit tests 48/48

## Pending
- [ ] PR → merge → live verification
