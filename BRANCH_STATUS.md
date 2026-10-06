# BRANCH_STATUS.md — fix/question-bubble-scrollbar

## Active work
- [x] Remove `max-h-48 overflow-y-auto` from question bubble place name (both expanded/collapsed)
- [ ] Verify: TypeScript clean, question bubble E2E
- [ ] Open PR

## Context
Veeresh's 2026-10-06 screenshot showed native scrollbar ▲▼ arrows overlapping
the place name "Hillsborough" in the question bubble. The `overflow-y-auto`
(from the Oct 4 truncation fix) renders scrollbar chrome on browsers with
always-visible scrollbars. Fix: let the name wrap naturally (no scroll container).
The long-name PR1 (PR #76) adds the `.place-name` class but keeps the overflow;
this hotfix removes it.

## Test plan
- `npx tsc --noEmit` clean
- Question bubble E2E (question-wrap spec) green
