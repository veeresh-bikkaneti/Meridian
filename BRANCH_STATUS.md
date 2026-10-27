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

# Branch status — fix/199-storyteller-guard

Issue: #199 — storyteller audio follow-ups (per-family CI guard test + stale `storyteller-lines.ts` header).

## Done
- [x] Read issue #199 in full. Measured all 14 shipped clips first-hand (ffmpeg 8.1.2, 2026-10-26): every clip is MP3, 24,000 Hz, mono; integrated loudness −16.5…−17.4 LUFS — exactly the accepted profile in the issue.
- [x] New CI guard: `scripts/storyteller-audio-guard.test.mjs` (runs under `npm test`, so it is in the Node CI job). Per family (greetings greet-01…06, pokes poke-01…05, narration reveal/hook/summary):
  - Tier 1 (always, plain Node, no tools): exact 14-file set present; every clip's first MP3 frame header parses as 24 kHz / mono / Layer III.
  - Tier 2 (ffmpeg on PATH): ebur128 integrated loudness must sit in −17.9…−16.0 LUFS (measured band ± 0.5 dB measurement slack). Without ffmpeg this tier is an explicit skip, never a silent pass; Tier 1 still runs.
  - Honest limit, stated in the test header: a file probe cannot prove which voice is speaking; format + loudness are the measurable fingerprint of the accepted renders.
  - Negative control: a Comet clip (44.1 kHz stereo, −26.4 LUFS) and a Grandpa clip (−22.4 LUFS) both fall outside the guard, so it discriminates.
  - Guard result on this branch: 6/6 pass, loudness tier executed (not skipped) on this machine.
- [x] Header cure: `src/components/storyteller-lines.ts` now states the post-#174 truth — Grok-generated Santa voice accepted 2026-10-21, all 14 clips, DO NOT regenerate via the Kokoro scripts (superseded `am_fenrir`), with a pointer to the guard test. A test in the guard file pins this wording so the header cannot quietly go stale again.

## Gates (on this branch's head)
- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — exit 0: scripts 838 pass / 0 fail / 9 skipped (832 baseline + 6 new guard tests, loudness tier executed not skipped); src 1633 pass / 0 fail
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — exit 0
- E2E: not applicable — unit-level guard + comment header; no E2E surface changes.

## Pending
- [ ] PR opened (no merge — owner merges)

## Notes
- Coordinator D (QA & Performance + Narrative squad); #193 = PR #256, #200 = PR #257, #191/#214 on a sibling branch.

---

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

# Branch status — fix/200-journal-src-parser

Issue: #200 — journal dataset generator: one-line `src()` parser gotcha.

## Done
- [x] Read issue #200 in full; verified the trap first-hand: the `source:` regex in `parseCatalog()` had no `\s*` after `src(`, before the comma, or before `)`, so a formatter-wrapped call parsed as `source: null` and the place was silently excluded.
- [x] Parser hardened: the regex now tolerates line breaks at every whitespace point inside `src(...)` (after `src(`, around the comma, before `)`). One-line calls parse exactly as before.
- [x] Loud fail: a present-but-unparseable `src(` call throws, naming the place, instead of degrading to a silent exclusion. A genuinely missing `source:` field still parses as `null` and is excluded/reported per spec §1 (existing tests pin this).
- [x] Tests: 6 new cases in `scripts/build-journal-dataset.test.mjs` — wrapped after `src(`, wrapped before `)`, wrapped before the comma, wrapped after the comma (regression pin — that shape already parsed), the fully wrapped Prettier shape, and the loud-fail case. File total 27/27.
- [x] Docs: the gotcha + fix documented in the generator's header comment, in the `parseCatalog` doc comment, and in `docs/journal-spec.md` §1.
- [x] Real regeneration is byte-stable: `node scripts/build-journal-dataset.mjs` on the real catalog reports 106 notes included (Chimney Rock among them) and leaves `src/components/home-journal.data.ts` unchanged.

## Gates (on this branch's head)
- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — exit 0: scripts 838 pass / 0 fail / 9 skipped (832 baseline + 6 new #200 tests); src 1633 pass / 0 fail
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — exit 0
- E2E: not applicable — generator/parser change, covered by unit tests + byte-stable real regeneration above.

## Pending
- [ ] PR opened (no merge — owner merges)

## Notes
- Coordinator D (QA & Performance + Narrative squad); #193 shipped as PR #256, #191/#199/#214 on sibling branches.

---

# Branch status — fix/193-card-compose-header

Issue: #193 — stale header in `scripts/card-compose.mjs`.

## Done
- [x] Read issue #193 in full; verified against merged code: `scripts/facts-ladder.mjs` exists on `main` (the facts ladder merged in PR #104), so the header's "on the facts-ladder branch" is stale.
- [x] Header cure (comment only, no code change): the `fact` field now reads "(scripts/facts-ladder.mjs)." with no branch reference.

## Gates (on this branch's head)
- [x] `node --test scripts/card-compose.test.mjs` — 15/15
- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — scripts 832 pass / 0 fail / 9 skipped; src 1633 pass / 0 fail (same counts as the `main` baseline)
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — exit 0
- E2E: not applicable — comment-only change, no spec covers the header text.

## Pending
- [ ] PR opened (no merge — owner merges)

## Notes
- Comment-only change. No behaviour changes.
- This file replaced the previous branch's status file, which shipped on `main` with PR #250 (repo convention: one status file per active branch).
- Coordinator D (QA & Performance + Narrative squad); #191/#199/#200/#214 are handled on sibling branches.

---

# BRANCH_STATUS — fix/234-crash-worker-dev-boot

**State: in progress (Coordinator B, SecOps & DevOps cluster, 2026-10-26). Owner merges only — do not merge.**
Base: `origin/main dbb83a3` (#225).

## What this branch does (#234)

`npx wrangler dev -c wrangler.toml` in `workers/crash-report` could
not boot: workerd validates every named export of the entry module
as a handler, and `src/index.ts` exports plain constants
(`ANOMALY_MIN_COUNT = 3`, plus seven more primitives and several
arrays) alongside the handler for its unit tests — the boot died on
the alphabetically first one. De-exporting them one by one would be
whack-a-mole and would break the tests that import four of them.

Fix (structural, local-dev only):

- New `workers/crash-report/src/dev-entry.ts`: a thin wrapper that
  re-exports only the default handler.
- `wrangler.toml`: `main` now points at `src/dev-entry.ts`, with a
  comment explaining why. Production never reads this file — a
  release bundles `src/index.ts` directly and uploads it through
  the API (README, "The release, step by step"), so production is
  untouched.
- README Files section documents the wrapper.

## Files

- `workers/crash-report/src/dev-entry.ts` (new)
- `workers/crash-report/wrangler.toml` (`main` + comment)
- `workers/crash-report/README.md` (Files section)
- `BRANCH_STATUS.md` (this file)

## Gates

- `npm run test:worker` — 42/42 pass.
- `npm run typecheck:worker` — clean.
- Boot proof (pinned wrangler from the worker's own `npm install`):
  `npx wrangler dev -c wrangler.toml` → "Ready on
  http://localhost:8787", `GET /health` → `{"ok":true}`,
  `POST /ingest` (README's example) → `{"ok":true,...}`; zero
  ANOMALY / "Incorrect type" errors in the log.
- Full root gates recorded in the PR / coordinator report.

## Pending

- Panel re-vote on the final tip, then the owner's merge call.

---

# BRANCH_STATUS — feat/233-ssr-build-shape

**State: in progress (Coordinator B, SecOps & DevOps cluster, 2026-10-26). Owner merges only — do not merge.**
Base: `origin/main dbb83a3` (#225).

## What this branch does (#233)

Adds `scripts/ssr-build-shape.test.mjs`, a post-build assertion that
fails loudly if a production build ever stops producing the
custom-entry SSR shape from PR #232:

- the emitted `node_modules/.nitro/vite/services/ssr/wrangler.json`
  must have `main: "index.js"`, `no_bundle: true`, and a `configPath`
  that resolves to the repo-root `wrangler.jsonc` (resolved path is
  compared, never a hardcoded absolute path — it embeds the checkout
  directory);
- the SSR bundle (`index.js` in the same directory) must still
  contain the server-fn guard literals that survive minification
  (`/_serverFn/`, `not found`, `method not allowed`, `no-store`).
  Identifiers are not asserted — minifiers rename them. No single
  literal proves the guard; the pin is the combination.

Design choice — artifact absence: on a fresh checkout with no build,
the tests skip with an explicit reason (precedent:
`scripts/share-card-built.test.mjs`). CI builds before it tests, so
the pin is live there; present-but-wrong fails loudly.

The issue's cheaper companion (vite.config.ts plugin-order assertion)
already exists in `scripts/grok-pwa-plugin.test.mjs` from the #232
cure round — not rebuilt here.

## Files

- `scripts/ssr-build-shape.test.mjs` (new)
- `BRANCH_STATUS.md` (this file)

## Gates

- No build present: 2 skipped with reason (by design).
- After `npm run build` (exit 0): 2/2 pass against the real artifact.
- Mutation check: flipping `no_bundle` to false in the emitted
  wrangler.json turns the suite red; restored, green.
- Full gates recorded in the PR / coordinator report.

## Pending

- Panel re-vote on the final tip, then the owner's merge call.

---

# BRANCH_STATUS — feat/213-headers-simulation

**State: in progress (Coordinator B, SecOps & DevOps cluster, 2026-10-26). Owner merges only — do not merge.**
Base: `origin/main dbb83a3` (#225).

## What this branch does (#213)

Until now the only guard on `public/_headers` was a live post-merge
probe, plus literal pins that key rules by pattern and cannot prove
what a browser actually receives. This branch adds a parse-and-simulate
pin to `scripts/security-headers.test.mjs`:

- An order-preserving parser + a simulator of Cloudflare's documented
  semantics (every matching rule applies, in file order; detachments
  before sets within a rule; first set replaces, later sets append).
- Pins the single effective `Cache-Control` for every path class:
  hashed `/assets/*` = immutable; the 3 carved files = one
  `public, max-age=0, must-revalidate` value (the detach+set proof —
  a missing detach would comma-join and fail); `/sw.js`, `/flags.json`,
  `/build-meta.json`, `/manifest.webmanifest` = `no-cache`; `/` and
  `/index.html` = the `s-maxage=60` value; `/offline`, `/offline.html`,
  `/_shell.html` = the revalidate value; and **no rule at all** for
  `/audio/*` and other unlisted paths (they take the platform default
  and must never become immutable).
- Note vs the issue text: the unioned file's values win — `/flags.json`
  is `no-cache` (not the pre-union revalidate line) and `/` carries
  `s-maxage=60`; the pins follow the file on main.
- Docs: the `/_shell.html` Acceptance wording is now conjunctive and
  lives in the `_headers` comment itself (404 AND no ETag AND no
  CF-Cache-Status = expected-inert; an asset-served header-less 200 =
  FAIL) — the old pointer to an Acceptance definition in
  BRANCH_STATUS.md dangled. `docs/security-headers.md` gains the
  missing `/offline*` / `/_shell.html` and no-rule rows.

## Files

- `scripts/security-headers.test.mjs`
- `public/_headers` (comment only — no rule changes)
- `docs/security-headers.md`
- `BRANCH_STATUS.md` (this file)

## Gates

- `node --test scripts/security-headers.test.mjs` — 9/9 pass.
- Mutation check: deleting a detach line turns the suite red (2 fails);
  restored, green again.
- Full gates recorded in the PR / coordinator report.

## Pending

- Panel re-vote on the final tip, then the owner's merge call.

---

# BRANCH_STATUS — fix/223-watchdog-byte-budget

**State: in progress (Coordinator B, SecOps & DevOps cluster, 2026-10-26). Owner merges only — do not merge.**
Base: `origin/main dbb83a3` (#225).

## What this branch does (#223)

The crash watchdog's 5120-byte budget was silently broken in
production: the budget test's fixture build id was 10 chars (rendered
exactly 5120), but production ids are 12 chars in CI (5122 bytes) and
14 for the timestamp fallback (5124). Fix, keeping the 5120 budget
(raising it was rejected — the shave is free and the budget guards
bytes inlined into every shell load):

- `scripts/crash-watchdog.mjs`: the embedded-source RENAME map now
  also renames `crashWatchdogMain` → `M` and `CSS` → `G` in the
  shipped output (neither is an object key or property, so this is
  semantics-preserving; `buildId` was deliberately NOT renamed — it
  is a payload key). Measured after: 7-char 5097, 10-char 5100,
  12-char 5102, 14-char 5104 bytes.
- `scripts/crash-watchdog.test.mjs`: the budget test now renders all
  four real build-id lengths instead of only the 10-char fixture.
- `docs/reviews/2026-10-21-remaining.md`: the stale "5118 bytes" line
  corrected to the measured values, with the reasoning recorded.

## Files

- `scripts/crash-watchdog.mjs`
- `scripts/crash-watchdog.test.mjs`
- `docs/reviews/2026-10-21-remaining.md`
- `BRANCH_STATUS.md` (this file)

## Gates

- `node --test scripts/crash-watchdog.test.mjs` — 42/42 pass.
- Full gates recorded in the PR / coordinator report.

## Pending

- Panel re-vote on the final tip, then the owner's merge call.

---

# BRANCH_STATUS — docs/221-194-observability-sync

**State: in progress (Coordinator B, SecOps & DevOps cluster, 2026-10-26). Owner merges only — do not merge.**
Base: `origin/main dbb83a3` (#225).

## What this branch does

- **#221 (residual only):** most of the stale Phase-1 passages named in
  the issue were already cured on main. This branch fixes what was
  left: the Files-section description of `wrangler.toml` in
  `workers/crash-report/README.md` (it still claimed a commented-out
  KV block "awaiting merge" — the uncommented block with the real
  namespace id is on main via PR #204), two leftover `cf.py`
  references (the current helper is `cf-version.py` and secrets ride
  with a version upload), and the same stale `cf.py` wording in the
  `wrangler.toml` header comment.
- **#221 rider:** handbook ch07 §4 now carries the caveat that
  `smoke:crash` check 4 is a known open failure on the workers.dev
  root, so "(4/4)" is not fully green.
- **#194:** event-type lists synced to the source of truth.
  `docs/observability.md` gains the missing `boot_failure` and
  `tile_failed` rows; handbook ch07 gains `boot_failure`. Both places
  now say plainly: the worker accepts 7 types, the client type lists
  13 (adding `storyteller_shown` and the `narration_*` types), and
  the extra 6 stay client-side.

## Files

- `workers/crash-report/README.md`
- `workers/crash-report/wrangler.toml` (header comment only)
- `docs/observability.md`
- `docs/handbook/07-engineering-and-ops.md`
- `BRANCH_STATUS.md` (this file)

## Gates

- Docs-only change; gate results recorded in the PR / coordinator report.

## Pending

- Panel re-vote on the final tip, then the owner's merge call.

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