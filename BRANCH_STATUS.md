# BRANCH_STATUS.md — fix/hint-endgame-overlap

## What this branch fixes

The owner reported on 2026-10-19, with a live-site screenshot, that the
End-game pill overlapped the hint message pill ("💡 Look toward the eastern
pa…") at bottom-right during the aim phase on short/landscape viewports.

Root cause: the hint cluster was top-anchored (`top-[28rem]`, no bottom
bound) while the End-game pill was bottom-anchored (`bottom-[6.5rem]`). On
short viewports the hint message grew downward into the button's lane; the
button is z-30 over the hint's z-20, so it covered the hint text. The
existing E2E 0px² gate covered card/score/drop-pin — never the hint message.

## The fix (builder's direction, 2026-10-19)

One bottom-right dock (`data-testid="aim-dock"`): a flex column holding the
hint cluster (offer + button + message) ABOVE the End-game button,
bottom-anchored at the End-game pill's old 6.5rem slot. Flex siblings
cannot overlap, so hint cluster vs End-game is 0px² by construction.

Correction to the earlier record: this direction was the builder's choice
for fixing the owner's reported bug. An earlier version of this file (and
the dock comment in game-app.tsx) called it "owner-approved direction" —
no owner words approve the direction, so that claim is withdrawn. What the
owner approved is recorded under "Owner decision" below, in his own words.

## Done

- Dock implemented in game-app.tsx; old top-anchored hint container
  removed; `data-testid="end-game-button"` added.
- question-bubble.test.ts source-pattern assertions updated for the dock.
- New E2E (tests/e2e/hint-button.spec.ts): hint-message vs End-game 0.0px²
  at 360x640 and 390x844. On the old layout these tests cannot pass — the
  aim-dock element does not exist there.
- 2026-10-20 documentation cure (this file, the dock comment, one test
  assertion): see "Review history".

## Gates (after the 2026-10-20 cure commit)

- `npx tsc --noEmit` — clean
- `npm test` — scripts suite 799 (790 pass / 9 skip / 0 fail);
  src suite 1358 pass / 0 fail
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green (pipeline run, 2026-10-20)
- Live E2E, hint-button spec, branch build — 10/10 across two runs
  (pipeline run, 2026-10-20); the 2 new dock tests measured 0.0px²

## Review history

- Builder's scrum review (2026-10-20): APPROVE-WITH-NITS, 0 BLOCKs.
- Full pipeline review (2026-10-20): **NOT READY — 4 BLOCKs.**
  - Three panel BLOCKs (Level Architect, Frontend Developer, UX
    Designer): with the question bubble EXPANDED and the Scout hint offer
    up, the dock/offer covers part of the bubble — measured by the
    pipeline coordinator at 5,400px² (360x640) and 20,348px² (360x568).
    At 568px height the bubble's "Hide instructions" toggle is fully
    covered, and its lane is occupied by the offer's Yes/No row. As
    originally scoped (every state), that breaches the #113 no-overlap
    rule. Disposed by the owner's re-scope decision below — no layout
    change was made.
  - One DevEx BLOCK (documentation): this file cited a screen recording
    that does not exist, stated "PR not opened" while PR #175 is open,
    and carried two contradictory pending lists. Cured by the 2026-10-20
    docs commit (below).

## Owner decision — the accepted trade (2026-10-20)

The owner re-scoped the #113 no-overlap rule to the COLLAPSED question
bubble, in his words: **"Re-scope: accept the covered toggle as a known
trade"** (2026-10-20).

In plain words: the no-overlap promise now covers the question bubble in
its normal (collapsed) state, and the hint cluster vs End-game in every
state. The one accepted exception: if a player deliberately expands the
instructions AND the Scout hint offer is on screen at the same time on a
short phone (≤568px tall), the offer card can cover the bottom of the
expanded bubble, including its "Hide instructions" toggle (measured:
5,400px² at 360x640; 20,348px² at 360x568). The toggle stays in the
accessibility tree, so keyboard and screen-reader users can still reach
it, and the offer itself can be dismissed. This is a deliberate,
owner-accepted trade — not an oversight — and future readers should not
"fix" it without the owner's word.

## The documentation cure (2026-10-20)

- The recording claim is dropped: the cited directory
  `~/workspace/your_files/meridian-hint-endgame-fix/` does not exist on
  this machine. No recording was produced for this branch; the pipeline's
  probe screenshots are the visual evidence.
- The false "NEVER MERGED. PR not opened" line is removed. PR #175 IS
  open.
- The earlier unscoped "red-team: ALL 0.0px²" claim is replaced by the
  scoped measurements above: 0.0px² holds for the states the fix targets
  (collapsed bubble; hint cluster vs End-game); the expanded-bubble ×
  offer state is the accepted exception, with its real numbers.
- The dock comment in game-app.tsx now scopes its #113 claim to the
  collapsed bubble and names the accepted trade, and no longer calls the
  fix direction owner-approved.
- One tautological assertion in question-bubble.test.ts was deleted (it
  asserted that a list built in the test contains the literal the test
  had just put in it). Real coverage of the dock's aim-phase gating
  remains via the dockGate source assertions in the same test. Test count
  unchanged: src suite still 1358.

## Open follow-ups

- Hint bulb ↔ End-game adjacency: in the dock, the hint button sits 8px
  above the End-game pill (UX Designer flagged a mis-tap risk — a stray
  tap could end the run, which has no confirmation step). The question
  was put to the owner and is unanswered. No change made; follow-up only.

## Ready to merge?

The pipeline BLOCKs are disposed — the geometry BLOCK by the owner's
re-scope decision above, the documentation BLOCK by the cure commit.
This branch is based on main @ `84ac861`; main has since advanced (PR
#176 merged 2026-10-20), so a rebase + retest is a merge-time step for
whoever lands it. What remains is the owner's merge decision on PR #175 —
nobody merges without his word.
