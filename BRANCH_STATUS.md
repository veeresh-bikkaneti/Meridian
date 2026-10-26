# BRANCH_STATUS — fix/154-item6-manual-full-tile-failure

**Branch:** `fix/154-item6-manual-full-tile-failure`
**Base:** `main` at `5f24c6c` (2026-10-26)
**State: CORRECTED + BUILT (2026-10-26).** Coordinator C
(UX/UI & Frontend + Game Squad) cluster branch 3 of 3. Not merged —
merge is the owner's word.

> **Correction (2026-10-26, after the first push):** this branch
> originally added a new WS-4 E2E leg for item 6. A deeper
> verification pass then found the scenario ALREADY pinned on main
> (see item 6 below) — the added leg was substantially duplicative
> and has been **withdrawn** (the ws4 spec is byte-identical to
> main again). What remains is the one genuinely open remainder:
> item 5's stale comment, in its mutated form. The branch name is
> kept (renaming would orphan the PR); its content is now item 5.

## Scope: #154 items 2–7 (item 1 is PR #197 — untouched)

Three verification passes against current `main`, file/line
evidence. Final verdicts:

| Item | Status on main | Evidence |
| :--- | :--- | :--- |
| 2. Stale decay comment | FIXED | The filed comment is gone; game-app boot comments (L1274-1286) and capability.ts L181-183 state the post-#151 rule |
| 3. `planBootMapMode` dead `stored` param | FIXED | Signature is `planBootMapMode(decision)` (capability.ts:322); docstring L299-305 explicitly records the item-3 resolution; unit pins cover both branches |
| 4. Offer dialog `aria-describedby` | SUPERSEDED | `scout-boot-offer.tsx` returns 404 on main — the dialog was removed by the 2026-10-20 silent-auto-switch ruling; capability.test.ts pins that it must not come back |
| 5. motionmaxxing stale comment | **STILL OPEN (mutated) — FIXED BY THIS BRANCH** | See below |
| 6. Declined-offer + WS-4 coverage gap | **ALREADY FIXED on main** | `scout-capability-offer.desktop.spec.ts`: "settled manual full → WS-4 tile failure: visit switches to scout, manual record untouched" — seeds manual full, aborts tiles, pins the Try-again card, the session-only switch, the untouched record, and the switch note; its header cites the #154 item-6 lineage. (An earlier pass missed this test; the duplicate leg added for it was withdrawn — see the correction note.) |
| 7. No unit test for accept→`accepted=true` | SUPERSEDED | The accept path no longer exists at all; its successor pin is capability.test.ts "game-app wiring: boot applies the plan's persistSource as an auto record", plus auto-record-no-accepted-flag and legacy-accepted-never-decays tests |

## Item 5, mutated form (what this branch changes)

The filed phrase ("the VM boots in scout map mode") is gone, but
its replacement comment in `tests/e2e/motionmaxxing.spec.ts`
(L180-185) is itself stale post-2026-10-20: it says the failed
WebGL probe "raises the Scout Map choice dialog instead of booting
into scout silently; the session starts in full mode either way."
There is no dialog anymore, and unpinned this VM would now boot
into Scout SILENTLY. The helper it describes (`forceFullMapMode`)
is still correct — only its explanation was wrong. This branch
rewrites that one comment to describe the silent auto-switch
ruling and why the manual pin is still needed. Comment-only;
no behavior change.

**Diff (whole branch vs main):**
`tests/e2e/motionmaxxing.spec.ts` (one comment) + this file.

## Gates

- [x] On the pre-correction head: tsc clean, npm test green
      (scripts 832/0/9, src 1633/1633), lint-cards PASSED,
      build:pages exit 0, ws4-tile-fallback 4/4 — that head is
      superseded; the corrected head changes no production code
      and one E2E comment.
- [x] Corrected head: `npx tsc --noEmit` clean. motionmaxxing
      spec: **5/6 passed** — including M5, the test that uses
      `forceFullMapMode` (the helper whose comment changed). The
      one failure is the "tap storm" test: 90 s test-timeout on
      this contended VM, reproduced on a solo re-run; it never
      calls the helper, the branch diff is comment-only (zero
      runtime surface), and tap-storm pacing is a known
      test-budget problem (tracked as #191). Not a regression
      this branch can cause — flagged here rather than hidden.

## Out of scope

- #154 item 1 / PR #197 (production test seam) — untouched.
- Closing #154 itself: the issue stays open on item 1 (PR #197)
  regardless of this branch; noted in the PR body.
- No merge, no branch-protection changes.
