# BRANCH_STATUS — fix/undici-lockfile-floor

**Branch:** `fix/undici-lockfile-floor` · **Base:** `origin/main` at `5b43737` (2026-10-27)
**State: DRAFT, local gates done.** Tier 2: manifest signed by the Chair (opus), token
`AUTH_RUN_TDD_IMPLEMENTATION`. Rule 2 waived for fix branches (owner, 2026-10-27). Merge is the owner's word.

## What it does

Clears the 4 npm-audit findings and the matching Dependabot alerts on the root
`package-lock.json`: every lockfile copy of undici now resolves to 7.30.1 (override
`^7.30.1`). **NOT fixed:** undici 7.29.1 is still bundled inline in wrangler 4.152.0
(`wrangler-dist/cli.js`), in the plugin's nested wrangler 4.151.0, and in
`@cloudflare/vite-plugin` 1.64.0 (`dist/index.mjs`). npm audit and Dependabot cannot see
bundled code, so a closed alert does not mean these are gone. They stay until we adopt
wrangler >=4.153.0 and a vite-plugin release that bundles undici >=7.30.1 (1.65.0, latest
on 2026-10-27, does not). All affected code is dev/build/deploy tooling; nothing deployed to
the Worker contains undici. The 2 `workers/crash-report` alerts are out of scope and remain open.

Files: `package.json` (`overrides` +1 line), `package-lock.json` (npm-regenerated, +36/-20),
`scripts/undici-lockfile-floor.test.mjs` (1 test, RED before / GREEN after).

Also included, NOT a dependency change (added at the owner's direction, 2026-10-27, commit `1989c63`):
the `team-board/` Claude Code plugin, 4 files, 235 lines (`plugin.json`, `hooks.json`,
`hooks/register.js`, `README.md`). No `src/` or `tests/` touched; no council was convened for it;
`claude plugin validate ./team-board` passes, but it has never been run in a live session.

## Council rulings

- Scope X (override only). wrangler 4.153.0 is deferred (<24h old, enters the credentialed
  deploy path): own PR after >=7 days, verify with a Workers Builds preview. Owner's call.
- Forcing the plugin's nested wrangler to 4.153.0: rejected. Pin `^7.30.1`, never `>=` (8.12.3).
- Remove the override once every path resolves >=7.30.1 without it; revisit if anything asks for 8.x.
- Let the alerts auto-close on re-scan; do not dismiss them by hand.

## Gates (haiku testers, head df2122f)

- PASS: `npm ci`; `npm ls undici` only 7.30.1; `npm audit --package-lock-only` 0; wrangler 4.152.0;
  `tsc`; `npm test` (scripts 833 pass/0 fail/9 skip, src 1673/1673, new test 1/1); lint-cards
  GATE PASSED; `build:pages`; dev smoke (`npm run dev`, HTTP 200 in ~11 s).
- **DEVIATION from the manifest (full e2e): not completed.** I stopped the run at 289/743 after
  ~80 min with 40 failures (reveal/layout/long-name specs, incl. known #267). Instead: builds of
  main vs this branch with a fixed build id: 937 of 939 files byte-identical (all JS bundles); the
  other 2 differ only in prerender timestamps and source-map id order (no control build run).
- Pending: CI `build (22.x)` + `e2e` on the pushed head; owner merge word; tracking issue.

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
