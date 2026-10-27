# Branch status — fix/e2e-191-214

Issues: #191 (tap-storm test un-passable by construction) + #214 (E2E pin for the greeting path on keyboard / screen-reader). Both are E2E-only; no production code changes.

## #191 — tap storm budget arithmetic
- [x] Verified first-hand: 12 + 10 catch-and-continue clicks at a 5s per-click timeout ≈ 110s of worst-case timeout burn vs the 90s budget in `playwright.config.ts`. Pure harness arithmetic — the panel's failure snapshot showed a healthy page; no production bug is masked by this fix.
- [x] Per-click timeout 5,000 → **1,000ms** on both loops, counts kept at 12 + 10. No assertion weakened: click results were always discarded; every real assertion sits after the loops with its own timeout. Worst-case burn is now ~21s ( ~66s+ of headroom). Why not 500ms: it buys nothing needed and risks the one click that must succeed (the first State click) on this serialized, RAM-tight VM.
- [x] Figure loop also gains `force: true`: the figure's breathing animation defeats Playwright's stability check, so the 10 clicks were timing out *undelivered* and the loop proved nothing. The sibling home-visual-layout pin force-clicks the figure for the same reason. Named in a comment in the spec.
- [x] Inline comments in the spec carry the arithmetic and the honest scope note (delivered storm = 1 State click + 10 figure taps).

## #214 — keyboard / screen-reader greeting pin
- [x] New spec `tests/e2e/home-greeting-keyboard.desktop.spec.ts` (desktop project, no config change). Fresh first-visit profile, sound seeded off for a deterministic text-phase bubble, assets-manifest response awaited before the first keypress, Tab counts never hard-coded (`tabUntil` walks with a focus trail).
- [x] Test A: Tab to the figure (asserts `:focus-visible`), Enter dismisses the invite + starts the greeting; bubble is role=status with a non-empty caption, inside the viewport; dismiss is announced as "Dismiss the storyteller's greeting", measures 44×44px, is Tab-reachable; Enter dismisses it and focus returns to the first edition control (asserted on `document.activeElement`); no trap afterwards.
- [x] Test B: the invite's own "Not now" button via Space releases the greeting; Space-dismissal + focus return pinned the same way.
- [x] Honest limits documented in the spec header: `viaKeyboard` is hard-coded `true` in the dismiss onClick (focus return also fires for pointer dismissal — the pin proves the keyboard outcome, not a modality split), and there is no Escape-to-dismiss for the home bubble.
- [x] `home-visual-layout.desktop.spec.ts` header: the "pointer only" limit line now points at the new pin.

## Gates (on this branch's head)
- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — exit 0: scripts 832 pass / 0 fail / 9 skipped; src 1633 pass / 0 fail (baseline counts; this branch changes no unit-tested code)
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — exit 0
- [x] E2E (sequential, `--workers=1`, via the VM-wide flock, against this branch's build): **21/21 passed** — home-greeting-keyboard 2/2 (32.2s, 31.1s), home-visual-layout 13/13 (no regression), motionmaxxing 6/6 with **tap storm at 36.9s** (previously a deterministic 90s timeout).

## Pending
- [ ] PR opened (no merge — owner merges)

## Notes
- **No test budget change**: the 90s global budget in `playwright.config.ts` is untouched; the fix is inside the test's own arithmetic.
- Coordinator D (QA & Performance + Narrative squad); #193 = PR #256, #200 = PR #257, #199 = PR #259.

---

# BRANCH_STATUS — fix/154-item6-manual-full-tile-failure

**Branch:** `fix/154-item6-manual-full-tile-failure`
**Base:** `origin/main` at `9345b4c` (2026-10-27, synced with PR #263 and PR #197 / #154 item 1 merged on `main`)
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

## Scope: #154 items 1–7 (item 1 is now merged on `main` via PR #197 / `16ec9b3`)

Verification against `origin/main` (`16ec9b3`), file/line
evidence. Final verdicts:

| Item | Status on main | Evidence |
| :--- | :--- | :--- |
| 1. Production test seam (`__meridianSuppressScoutOffer`) | FIXED (`16ec9b3`, PR #197) | Seam removed from `src/components/game-app.tsx`; harness spoofs device signals in `tests/e2e/helpers.ts`; inverted pin in `src/map/capability.test.ts` (L456-465) and E2E pin in `tests/e2e/scout-harness-suppression.desktop.spec.ts` |
| 2. Stale decay comment | FIXED | The filed comment is gone; game-app boot comments (L1281-1305) and capability.ts L181-183 state the post-#151 / post-2026-10-20 rule |
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

## Gates (synced with `origin/main` `16ec9b3`)

- [x] `npx tsc --noEmit && npm run typecheck:worker` — clean (exit 0)
- [x] `npm test && npm run test:worker` — scripts 832 pass / 9 skip / 0 fail (841 total), src 1670 pass / 0 fail, worker 85 pass / 0 fail
- [x] `node scripts/lint-cards.mjs` — `lint-cards: GATE PASSED`
- [x] `VITE_KOFI_URL=https://ko-fi.com/meridian npm run build:pages` — exit 0
- [x] Playwright E2E against built artifact:
      - `scout-capability-offer.desktop.spec.ts`: **13/13 passed** (including #154 item 6 test)
      - `scout-harness-suppression.desktop.spec.ts`: **2/2 passed** (#154 item 1 test)
      - `ws4-tile-fallback.desktop.spec.ts`: **3/3 passed**
      - `grownups-privacy-contact.desktop.spec.ts`: **3/3 passed**
      - `hydration-boot.desktop.spec.ts`: **1/1 passed**
      - `observability.spec.ts`: **3/3 passed**
      - `motionmaxxing.reduced.spec.ts`: **6/6 passed**
      - `motionmaxxing.spec.ts`: **5/6 passed** — including M5, the test that uses `forceFullMapMode` (the helper whose comment changed). The one failure is the pre-existing "tap storm" test: 90 s test-timeout on this contended VM; it never calls the helper, the branch diff is comment-only (zero runtime surface), and tap-storm pacing is a known test-budget problem (tracked as #191).

## Out of scope

- #154 item 1 / PR #197 (production test seam) — now merged on `main` as `16ec9b3`.
- No merge, no branch-protection changes.
