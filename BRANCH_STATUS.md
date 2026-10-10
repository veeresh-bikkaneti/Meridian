# BRANCH_STATUS — feat/age-profile-followups

**Branch:** `feat/age-profile-followups`
**Base:** origin/main@044befc (2026-10-09; rebased, zero conflicts)
**Spec:** `~/workspace/specs/age-profile-followups.md` (+ office-hours/eng/devex reviews)
**Goal:** goal_b3eb80f458ba
**Status:** GAUNTLET COMPLETE — merge-ready pending owner merge call (DO NOT MERGE standing)

## Merge-readiness gates (all green on final head)
- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — 1054/1054 pass
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — green
- [x] Playwright — all specs green (27+ tests, bounding-box assertions at 360×740 AND 390×844)
- [x] Zero conflicts vs origin/main
- [x] All 6 squads approve (Design, Eng, Devex, QA, Office-hours, Security)

## Owner decisions (all confirmed 2026-10-09 — implement exactly)
- **B1** run-config injection: `getBandConfig(band)` snapshotted once at run start; unset == today's production values (unit-gated per loop)
- **B2** DELETE mid-run grown-ups staging entirely: remove `pending-change` (3 statuses → 2), delete timeout + footer "updating…" chip + picker pending note; save writes immediately; in-memory deferredBand applies at next boundary
- **B3** uniform ghost speaker icon (same slot as 8–10, 44px, no label) + kid-set onboarding preference (Always/Sometimes/Never, asked once, never nags)
- **B4** "Clean Round" badge for no-hint runs — cosmetic ONLY, never points

## Invariants (non-negotiable)
- Scoring identical across bands · band changes at next boundary, never mid-run · band invisible to child · no age numbers / easy-hard copy on child surfaces · locked copy verbatim (≤140-char band descriptions in bands.ts)

## Work split
- **Dev A:** B1 (getBandConfig + run snapshot) + B2 (store simplification) — `src/game/age-profile/*`, loop run constructors, AgePicker/AgeProfileSettings staging hunks
- **Dev B:** B3 (read-aloud + onboarding pref) + B4 (Clean Round badge) — ReadAloudButton, story cards, passport badges
- **Tester** (after devs): full gates (tsc, lint-cards, build:pages, npm test) + relevant Playwright + mobile 390×844 QA + zero console errors

## Gates (on final head, before PR)
- [ ] `npx tsc --noEmit` clean
- [ ] `node scripts/lint-cards.mjs` GATE PASSED
- [ ] `npm run build:pages` green
- [ ] full `npm test` green
- [ ] relevant Playwright green
- [ ] mobile 390×844 QA + zero console errors

## Rules
- Named files only staged, never `git add -A`
- Open PR, NEVER merge (owner merges)

## Log
- 2026-10-09: branch created off 64c82d6; worktree ~/workspace/meridian-agefollow; Dev A + Dev B dispatched in parallel
- 2026-10-09: Dev B done (B3 uniform ghost speaker + kid pref + B4 Clean Round badge); Dev A done (B1 getBandConfig + run snapshot + B2 staging deleted); coordinator integrated (footer chip deleted, Clean Round round-end hookup in LoopScreen, ReadAloudPrefPrompt mounted on home); tsc clean
- 2026-10-09: tester verdict PR-READY — tsc/lint-cards/build green, npm test 1020/1020, Playwright age-profile 1/1 + mobile 390×844 2/2 + desktop 1/1 (zero console errors); 2 geodetective tap-precision flakes are pre-existing env issues
- 2026-10-09: PR #113 opened — https://github.com/veeresh-bikkaneti/Meridian/pull/113 — NEVER merge (owner merges)
- 2026-10-09 (Dev B): B3 + B4 done, working tree only — ReadAloudButton uniform ghost icon (8-10 ≡ 11-13), read-aloud-pref.ts (key meridian.readAloudPref.v1), ReadAloudPrefPrompt.tsx, src/game/passport/badges.ts (Clean Round, cosmetic-only), age-profile.css hunks; 27 new tests green; tsc clean on own files (2 pre-existing errors in Dev A's in-progress run.ts/game-app.tsx); result-card.tsx comment hunk only

## Fix pass — PR #113 review BLOCKs (2026-10-09)
Review: 10/12 approve, 2 BLOCKs both on B4 Clean Round badge. Fix agent worktree: ~/workspace/meridian-fix113.
- **BLOCK 1 (live-band award bug):** award read live `resolveBand()` at round-end. Fixed: `BandRunConfig` now carries `band` (the deal-time effective band, set in `getBandConfig()`); `isBandRunConfig` validates it; the LoopScreen round-end hook passes `progressed.dealBandConfig?.band` (fail-closed on undefined). Added unit test: snapshot records deal-time band.
- **BLOCK 2 (invisible + fires on losses):** (a) award is now win-only — `CleanRoundSummary.won` added, `awardCleanRoundBadge` returns null unless won; (b) visible surface — the just-earned badge renders as a celebratory chip (`data-testid="clean-round-badge"`, role=status) in the win reveal, threaded LoopScreen → LoopGame → LoopReveal; cleared on next deal.
- Badge stays cosmetic-only (no score APIs), band-invisible copy unchanged, locked band descriptions verified byte-identical vs origin/main.
- New Playwright project `clean-round-badge` (tests/e2e/clean-round-badge.spec.ts): 11-13 no-hint win earns + shows badge; loss earns nothing; mid-run 8-10→11-13 flip cannot mis-award. 3/3 green.
- Gates on fix head: tsc clean · lint-cards GATE PASSED · build:pages green · npm test 1024/1024 · Playwright clean-round-badge 3/3 + age-profile-gate 1/1 green.

## Rebase onto main@f4f92ad (2026-10-09, rebase agent)
- Base moved 64c82d6 → f4f92ad (#111 Ko-fi cloud visible on mobile merged). 3 commits replayed clean; 1 docs-only conflict in BRANCH_STATUS.md (kept this branch's doc).
- Badge-fix survival verified: award reads `progressed.dealBandConfig?.band` (snapshot, never live `resolveBand()`); `data-testid="clean-round-badge"` win-only surface intact; clean-round-badge.spec.ts present.
- Locked copy verified byte-identical vs origin/main: Ko-fi 3 strings (2/2/1), `bands.ts` diff-empty, `storyteller-lines.ts` diff-empty.
- Gates on rebased head: tsc clean · lint-cards GATE PASSED · build:pages green (real, `_shell.html` emitted) · npm test 1024/1024 · Playwright clean-round-badge 3/3 green.
- Note: an earlier badge-e2e failure in this worktree was a broken local build (copied cross-worktree node_modules → duplicate React in SSR prerender); fixed with a clean `npm ci`. Not a code issue.

## 2026-10-09 — rebase onto main@df3f46c (#116 dismiss-overlap fix merged)
- Remote verified unchanged at f706bd8 before push (force-with-lease).
- 1 docs-only conflict in BRANCH_STATUS.md (kept this branch's doc); 4 commits replayed clean.
- Badge-fix survival verified: `progressed.dealBandConfig?.band` (snapshot) at LoopScreen.tsx:444, win-only `data-testid="clean-round-badge"`, clean-round-badge.spec.ts present.
- Locked copy byte-identical vs origin/main: Ko-fi 3 strings (2/2/1 occurrences), bands.ts diff-empty, storyteller files diff-empty.
- Gates on final head: tsc clean · lint-cards GATE PASSED · build:pages green (dist/client/_shell.html emitted) · npm test 1040/1040 · Playwright clean-round-badge 3/3.

## 2026-10-09 — B1 pin-tolerance snapshot fix (scrum review BLOCK)
- Root cause: the two `pinToleranceKm()` call sites in `PlayLoaded` (game-app.tsx:2897, :2926) read the LIVE `ageBand` instead of the run's immutable `bandConfig` snapshot — a mid-run band change would re-tune the pin hit radius mid-run (same class as the B4 award bug).
- Fix: `pinToleranceKm(run.bandConfig?.band ?? ageBand, …)` at both sites. `Run.bandConfig` is the deal-time snapshot (optional only for pre-snapshot backfill; `?? ageBand` is the legacy fallback).
- Consumer grep: `pinToleranceKm` has exactly 2 callers, both fixed. Remaining `resolveBand()` reads are deal-time snapshot creation only (`store.ts:214` dealBandConfig, `LoopScreen.tsx:279/286` deal-config capture) — no live reads in any run/deal path.
- Gates on fix head: tsc clean · npm test 1040/1040.

## 2026-10-09 — Hint button UI (owner decision: hints are a REAL feature)
- Wired the B1 hint policies to a real surface (was dead code — built, tested, zero UI callers).
- New `src/components/hint-panel.tsx`: policy-aware button (44px, Lightbulb icon).
  - 5-7 ("free"): always visible + enabled; mascot offer ("Stuck? Want a hint?" opt-in Yes/No) after 2 run misses; offer dismissal resets per run.
  - 8-10 ("one-per-round"): visible; disables after one use per place, re-enables on next place.
  - 11-13 ("none"): no button rendered at all (Clean Round stays earnable).
- New `src/components/hint-logic.ts`: mechanical directional hint (place lon/lat vs region bounds quadrant — pure geometry, no fabrication, never pinpoints). Globe edition falls back to world bounds.
- Wired in `PlayLoaded` (game-app.tsx): policy from `run.bandConfig?.hintPolicy` (deal-time snapshot, defaults "none"); `hintsUsed` incremented on the run via `onRun`; per-place usage resets on `place?.id` change; hint NEVER touches points/scoring.
- Positioned top-right below chrome (mirrors bubble offset) — no overlap with question bubble or chrome.
- Tests: 7 new unit tests (hint-panel.test.ts, added to npm test list); 4 new E2E (hint-button.spec.ts, new "hint-button" Playwright project @390px): 5-7 free hint, 8-10 disable-after-use, 11-13 hidden, mascot offer after 2 misses.
- Gates: tsc clean · lint-cards GATE PASSED · build:pages green · npm test 1047/1047 · Playwright hint-button 4/4 · zero console errors · locked copy byte-identical (Ko-fi 3 strings, bands.ts untouched).

## Rebase onto origin/main@722a51f (2026-10-09, phase-1 rebase agent)
- Remote moved mid-task: origin/feat/age-profile-followups went 04a9835 → 1d62be6
  (another agent landed the pin-tolerance fix 566c57c + hint-button UI 1d62be6).
  Per stand-down rule the rebased head was NOT pushed — this tmp branch holds the
  rebase of the true remote head 1d62be6 onto main@722a51f for the coordinator.
- Rebased commits (7): 71be7e9→713a6cd (age-profile feat), f7c1d7c→a669fb5 (docs),
  089faae→6141453 (badge BLOCK fix), fe3e89b→723738d + 1590757→b2871f9 (rebase records),
  566c57c→77c3d99 (pin tolerance), 1d62be6→240ed14 (hint button UI). New head: 240ed14.
- Conflicts: 1 — BRANCH_STATUS.md on 71be7e9 (kept the branch's live document;
  main's copy was the stale fix/live-site-issues record). package.json test-script
  union + game-app.tsx auto-merged.
- Survival checks on 240ed14: B4 badge intact (progressed.dealBandConfig?.band,
  win-only, data-testid="clean-round-badge", tests/e2e/clean-round-badge.spec.ts) ·
  pin tolerance BOTH call sites read pinToleranceKm(run.bandConfig?.band ?? ageBand, …) ·
  hint-panel.tsx + hint-logic.ts present, imported + <HintPanel/> rendered in game-app.tsx ·
  locked copy byte-identical to main@722a51f (3 Ko-fi strings, bands.ts, 5 storyteller files).
- Smoke: `npx tsc --noEmit` clean (fresh npm ci in this worktree).
## 2026-10-09 — Hint-cluster overlap BLOCK fix + mechanical deletions (overlap-fix agent)
- **BLOCK:** the hint cluster (game-app.tsx hint wrapper) sat at the same 6rem top offset as the open question bubble — at 360px/390px the full-width `pointer-events-auto` HintPanel root swallowed the bubble's "Hide question" taps (#114 dismiss-overlap class).
- Fix (src/components/hint-panel.tsx): root → `pointer-events-none` + `items-end` (children hug the right edge); `pointer-events-auto` ONLY on the hint button and the two offer dialog buttons — taps pass through everywhere else.
- Fix (src/components/game-app.tsx): cluster moved to `top-[max(28rem,env(safe-area-inset-top))]` — below the bubble shell's max extent (6rem top + min(38dvh,20rem) cap = 416px max bottom @844h); stale "mirrors the bubble offset" comment corrected.
- New Playwright gate (tests/e2e/hint-button.spec.ts): 4 overlap tests asserting 0px² bounding-box intersection (`.bubble-shell` vs button / message / offer) at 360×740 AND 390×844, dismiss-overlap pattern. Measured: 0.0px² in all 6 state×width combos.
- Test-note: the 2-miss click point is now viewport-parameterized — (50,700) lands on the bottom-left attribution pill at 740px height; 360px tests click (50,600).
- Mechanical deletions (AGENTS.md rules 6/7, no behavior change): dead `hasPendingChange` (store.ts) + index.ts facade re-export — store.test.ts assertions reworked to observe the deferred boundary event instead; `cleanRoundEligible` (run-config.ts, zero callers — awardCleanRoundBadge encodes eligibility inline) + index.ts re-export + 4 test lines; orphaned `.agep-pending-chip` CSS block.
- Gates on fix head: tsc clean · npm test 1046/1046 (was 1047 — one test block deleted with cleanRoundEligible) · lint-cards GATE PASSED · build:pages green · Playwright hint-button 8/8 · clean-round-badge 3/3 · locked copy byte-identical (3 Ko-fi strings vs origin/main).
- Worktree: ~/workspace/worktrees/overlap-fix-113 (isolated; shared ~/workspace/meridian tree untouched).
## 2026-10-09 — #113 follow-ups: "Always" read-aloud + GeoDetective hint UI (build agent)
- **Item A — Honor "Always" across ALL bands + reliable mute.**
  - `src/game/age-profile/read-aloud-pref.ts`: `shouldAutoPlayReadAloud("always", …)` → `return soundOn` (was `bandAutoplay && soundOn`, which silently broke the promise for 8-10/11-13). Unset keeps today's band default.
  - `src/components/age-profile/ReadAloudButton.tsx`: auto-play effect no longer gated on `mode === "auto"` (5-7 only); the kid's preference decides via `shouldAutoPlayReadAloud(pref, mode==="auto"&&autoplay, soundOn)`. Added `meridian:sound-off` listener to reset the playing state on external mute.
  - `src/game/audio/sfx.ts`: `setSoundEnabled(false)` now also `speechSynthesis.cancel()`s (narration isn't in the loop registry) + dispatches `meridian:sound-off`.
  - Tests: read-aloud-pref.test.ts "always" cases reworked (8-10/11-13 → true); new sfx.test.ts mute-cancels-speech test; new tests/e2e/read-aloud-always.spec.ts (4 tests: Always on 11-13, Always on 8-10, mute cancels, Sometimes stays silent) — speechSynthesis stubbed, hit flow via commitHit (phase "story") at desktop viewport.
- **Item B — GeoDetective hint UI (policy-driven).**
  - Finding: GeoDetective is LOCKED for 5-7 (bands.ts `startingClues: null`) — a literal "5-7 only" UI would be unreachable dead code. Implemented via the deal-time band snapshot instead: `LoopScreen` captures `dealBand` alongside `captureDealConfig()`, passes it to `LoopGame`; hint policy = `getBandConfig(dealBand ?? resolveBand()).hintPolicy`.
  - 8-10 ("one-per-round"): hint button in the "Detective's map" section (after the Guess N of M status, before the map), one hint per mystery, world-bounds `directionalHint` quadrant nudge; 11-13 ("none"): HintPanel renders nothing; 5-7 path exists via policy but is unreachable by design.
  - State resets per mystery (`${cycle}:${index}`); hints never touch points; no band-revealing copy. Needs owner confirmation that 8-10-serving (not 5-7) matches intent.
- Gates on follow-up head: tsc clean · lint-cards GATE PASSED · build:pages green · npm test 1047/1047 · Playwright geodetective-hint 3/3 + read-aloud-always 4/4 · 390×844 bounding-box overlap 0px² (hint button vs map) · zero console errors · locked copy byte-identical (3 Ko-fi strings, bands.ts untouched).
- Worktree: ~/workspace/meridian-f113ab (isolated; shared ~/workspace/meridian tree untouched).
## 2026-10-09 — #113 follow-ups: badges on home card + read-aloud settings (build agent)
- **Item 1 — Earned badges on the home page card (owner: no Passport page).**
  - New `src/components/passport/EarnedBadgeRow.tsx`: reads device-local `meridian.passport.badges.v1`, renders earned badges as chips (🏅 name, blurb as title) on the GeoDetective dossier card (where Clean Round is earned). Renders nothing when empty. Band-invisible: no ages, no easy/hard. Home remounts after loops → always fresh.
  - CSS: `.atlas-badges` / `.atlas-badge-chip` in age-profile.css.
- **Item 2 — Read-aloud preference settings surface (owner: changeable after first tap).**
  - New `src/components/age-profile/ReadAloudPrefSettings.tsx`: kid-reachable toggle in the home footer ("🔊 Stories: Always") opening the Always / Sometimes / Never options; writes via setReadAloudPref immediately. Sits NEXT TO the grown-ups gate — never parent-gated (standing UX rule). Hidden while pref unset (onboarding prompt owns first choice).
  - CSS: `.agep-readaloud-settings` / `.agep-readaloud-toggle` / `.agep-readaloud-options` in age-profile.css (reuses `.agep-pref-option`).
- Wiring (src/components/game-app.tsx): imports + `<EarnedBadgeRow />` on the GeoDetective card after the streak line; `<ReadAloudPrefSettings />` in the footer before the grown-ups button.
- Tests: 7 new unit (EarnedBadgeRow.test.ts 3, read-aloud-settings.test.ts 4); new tests/e2e/home-badges-readaloud.spec.ts + `home-badges-readaloud` Playwright project (4 tests: badge on card, empty→nothing, change via footer, kid-reachable not gated). Test-note: addInitScript re-seeds on reload — persistence asserted via direct localStorage read.
- Gates on follow-up head: tsc clean · npm test 1054/1054 · lint-cards GATE PASSED · build:pages green · Playwright home-badges-readaloud 4/4 · locked copy byte-identical (Ko-fi 3 strings 2/2/1 vs origin/main; bands.ts untouched).
- Worktree: ~/workspace/meridian-f113ab (isolated; shared ~/workspace/meridian tree untouched).
## 2026-10-09 — #113 owner-review BLOCKs (4): fix agent
- **BLOCK 1 — Clean Round panel re-fired on every 11-13 win.** Root cause: `awardCleanRoundBadge` returned the badge definition even when already earned (`awardPassportBadge` is storage-idempotent but still returns the badge) → LoopScreen set state → panel showed on every qualifying win. Fix (`src/game/passport/badges.ts`): return null when already earned; panel fires once at earn. New unit test: re-award returns null, storage stays idempotent.
- **BLOCK 2a — Mascot offer had no visual.** Fix (`src/components/hint-panel.tsx`): added `CometEmblem` (lightweight static SVG, aria-hidden, no tracking) beside the offer copy.
- **BLOCK 2b — Badge blurb in hover-only tooltip (touch-unreachable).** Fix (`src/components/passport/EarnedBadgeRow.tsx`): chip is now a tappable button toggling the blurb as visible text; `title` attribute removed. Updated unit test; fixed home-badges-readaloud E2E selector (CTA is `button.atlas-btn-brass`, not `button.first()`).
- **BLOCK 3 — Vacuous guess-input test.** Root cause: `[data-testid="loop-guess-input"]` didn't exist — filtered out silently. Fix: added the testid to `GuessInput` root (`src/game/loop/guess-input.tsx`); test now asserts both map AND guess input present + non-overlapping at 360×740 and 390×844.
- **BLOCK 4 — hintsUsed never committed to the store.** Root cause: `onUseGeoHint` incremented local state only; badge reads `progressed.hintsUsed` from the store (always 0). Fix: new `onHintUsed(count)` prop on `LoopGame`; parent `LoopScreen` commits via `commitStore`.
- Gates on fix head: tsc clean · npm test 1055/1055 · lint-cards GATE PASSED · build:pages green · Playwright geodetective-hint + home-badges-readaloud + clean-round-badge + hint-button + read-aloud-always green (28 passed) · locked copy byte-identical (Ko-fi 2/2/1 vs origin/main).
- Worktree: ~/workspace/meridian-f113fix (isolated; shared ~/workspace/meridian tree untouched).
