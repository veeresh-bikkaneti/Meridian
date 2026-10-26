# BRANCH_STATUS — fix/154-item6-manual-full-tile-failure

**Branch:** `fix/154-item6-manual-full-tile-failure`
**Base:** `main` at `5f24c6c` (2026-10-26)
**State: BUILT + GATES GREEN (2026-10-26).** Coordinator C
(UX/UI & Frontend + Game Squad) cluster branch 3 of 3. Not merged —
merge is the owner's word.

## Scope: #154 items 2–7 (item 1 is PR #197 — untouched)

Every remaining item was verified against current `main` first
(two independent squad passes, file/line evidence). Verdict: items
2, 3, 4, 5, 7 are **already fixed or superseded** — fixing them
again would be duplicate work. Only item 6 has a live remainder,
in a superseded form. This branch carries exactly that remainder.

| Item | Status on main | Evidence |
| :--- | :--- | :--- |
| 2. Stale decay comment | FIXED | The "accept writes an auto scout that decays" comment is gone; current comments state the post-#151 rule (game-app boot effect, capability.ts StoredMapMode docs) |
| 3. `planBootMapMode` dead `stored` param | FIXED | Signature is now `planBootMapMode(decision)`; its docstring explicitly records the #154 item-3 resolution; unit pins cover both branches |
| 4. Offer dialog `aria-describedby` | SUPERSEDED | `scout-boot-offer.tsx` no longer exists — the dialog was removed by the owner's 2026-10-20 silent-auto-switch ruling; no dialog, no missing description |
| 5. motionmaxxing stale comment | FIXED | The "boots in scout map mode" comment was replaced by an accurate `forceFullMapMode` comment (manual localStorage override, never decays) |
| 6. Declined-offer + WS-4 coverage gap | **OPEN (superseded form) — THIS BRANCH** | See below |
| 7. No unit test for accept→`accepted=true` | SUPERSEDED | The accept write path no longer exists (dialog removed); the surviving contract — auto records carry NO `accepted` flag; legacy accepted records never decay — is pinned in capability.test.ts and E2E |

## Item 6, modern form (what this branch adds)

As filed, item 6 wanted: a *declined capability offer* (manual full)
followed by a WS-4 tile failure. The decline action no longer
exists, but its product — a standing **manual full record** — does,
and the combination was still untested: every WS-4 golden seeds a
capable device with **no record**, and every manual-record golden
never fails tiles.

New E2E leg in `tests/e2e/ws4-tile-fallback.desktop.spec.ts`:
seed manual full → boot stands on the record (full, no rewrite, no
offer) → tiles aborted → one "Try again" → session-only Scout
switch + switch note → **stored record byte-identical** (raw string
compared; any rewrite would move `setAt`) → reload honors the
record again (full map, card returns).

No production code changes. No other #154 item is touched.

## Gates (2026-10-26, this head)

- [x] `npx tsc --noEmit` — clean, exit 0
- [x] `npm test` — scripts 832 pass / 0 fail / 9 skipped;
      src 1633/1633 pass (test-only branch; counts = main baseline)
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — exit 0
- [x] Playwright `--workers=1`: ws4-tile-fallback **4/4** — the
      three pre-existing goldens plus the new #154 item-6 leg
      (46.2 s)

## Out of scope

- #154 item 1 / PR #197 (production test seam) — untouched.
- Closing #154 itself: the issue stays open on item 1 (PR #197)
  regardless of this branch; noted in the PR body.
- No merge, no branch-protection changes.
