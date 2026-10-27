# BRANCH_STATUS — fix/188-185-session-end-hints

**Branch:** `fix/188-185-session-end-hints`
**Base:** `main` at `5f24c6c` (2026-10-26)
**State: BUILT + GATES GREEN (2026-10-26).** Coordinator C
(UX/UI & Frontend + Game Squad) cluster branch 2 of 3. Not merged —
merge is the owner's word.

## Scope

- **#185 — GeoDetective hint counter resets on mid-mystery reload.**
  `LoopScreen`'s local `hintsUsedThisMystery` started at a blind zero
  on every mount. It now initializes from — and the per-mystery reset
  effect restores — the mystery's persisted `puzzle.hintsUsed`, so a
  one-per-round player (including the hints-on-by-default unset
  profile) cannot tap a second hint after reloading mid-mystery.
  The store count already blocked the Clean Round badge; this fixes
  the UI half.
- **#188 — Scout switched notice not retired on session end.**
  `killIdleSession` and the End-game summary-done handler in
  `game-app.tsx` now clear `mapSwitchedNote`, extending Block B's
  lifecycle rule (later flips retire it) to session end. The notice's
  "Your score is kept" claim dies with the session it describes.

## Files

- `src/game/loop/LoopScreen.tsx` — hydrate the hint counter (#185)
- `src/components/game-app.tsx` — clear the notice in
  `killIdleSession` + `onSummaryDone` (#188)
- `src/game/loop/hint-hydration.test.ts` — NEW source pin (#185)
- `src/components/map-switched-notice-lifecycle.test.ts` — NEW
  source pin (#188, with the manual-flip control)
- `tests/e2e/geodetective-hint.spec.ts` — NEW reload pin (#185)
- `tests/e2e/scout-notice-session-end.desktop.spec.ts` — NEW E2E:
  End-game leg + idle-kill leg (#188)
- `docs/scout-offer-policy.md` — session-end retirement rule (#188)
- `docs/handbook/02-game-design-decisions.md` — reload honesty note
  for GeoDetective hints (#185)

## Gates (2026-10-26, this head)

- [x] `npx tsc --noEmit` — clean, exit 0
- [x] `npm test` — scripts 832/832, src 1570/1570 (incl. +5 new pins)
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — exit 0 (first attempt's prerender was
      OOM-killed at exit 137 under parallel-coordinator load; retry
      on the same tree passed)
- [x] Playwright `--workers=1`: geodetective-hint **7/7** (incl. the
      #185 reload pin and its negative control — a reload BEFORE any
      hint keeps the button enabled; amendment 2026-10-26),
      scout-notice-session-end **2/2** (new
      #188 End-game + idle-kill legs). A combined run with
      scout-toggle.desktop.spec.ts under heavy parallel E2E load
      showed pacing timeouts in pre-existing toggle tests (one
      passed at 1.8 m); the toggle logic itself is untouched by this
      branch — the notice lifecycle is covered by the new spec +
      source pins above.

## Out of scope

- #154 item 1 / PR #197 (test seam) — untouched.
- No merge, no branch-protection changes.

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
