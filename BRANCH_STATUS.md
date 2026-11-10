# BRANCH_STATUS — feat/humanities-definitions

**Branch:** `feat/humanities-definitions` · **Base:** `origin/main` @ `f37dea50`
(verified 2026-11-10)
**Task:** Workstream 4 of the Meridian scaling-plan push — Humanities + GK
definitions, cross-cutting definitions, and stale-doc fixes. Docs/briefs
only — NO code, NO game build, NO PR, NO merge.
**Status:** spec skeleton pushed (c5569641); §1 P5 + §2 P8 briefs landed;
§3 P10 + §4 P11 + §5 P12 briefs landed (d52a93d6); §6 cross-cutting +
§7 open questions landed (aacf0f0b); §8 stale-doc correction record +
in-place workspace fixes landed (18923ad7); §2 P8 extended 2026-11-10 —
owner's 7-category list added alongside the 2026-11-07 list, plus the
106-coverage verdict and the add-only-what-is-missing rule (575742d7).
**Workstream complete — all five briefs, cross-cutting definitions, the
12-flag correction record, and the P8 category/coverage update are on
the branch.**
**Update 2026-11-10 (owner: remove religion completely):** §2 P8 stripped
of religion — 2026-11-07 religious list struck, pilgrimage category
removed, sensitivity review narrowed to a tone review for historical
content, P8 gaps five → four. The religions-epics and pilgrimage spec
branches were deleted (both gone from remote, verified 2026-11-10).
Mythology stays (separate category).
**Blocked (not by this branch):** every brief is PREPARED — AWAITING
EDUCATOR SIGN-OFF (educator seat UNSTAFFED, no signer exists). P8: owner
question — does the v4 listen-approval satisfy the v3 gate? P11: owner
ruling (a) override vs (b) reframe + school-GK per band + staleness
period, all open. Q14/Q15: no written owner answer (decided-by-direction /
council resolution, confirmation open). Constitution-first ordering is
conditional, not a plan.

---

# BRANCH_STATUS — fix/journal-manifest-note

**Branch:** `fix/journal-manifest-note` · **Base:** main `9cf9e64f` (#388 + #389 merged)
**Task:** Remove the stale top-level `note` from `public/videos/journal-manifest.json`
("No player loads this file yet…" — written 2026-11-08 when no player existed;
the #388 player merged 2026-11-10 loads the manifest on tap). Owner order on
voice call 2026-11-10: "Remove it then."
**Scope (synchronized, one change):** manifest JSON (drop the `note` key;
106 per-entry `note` fields untouched) + `scripts/validate-journal-manifest.mjs`
(top-level keys now exactly { baseUrl, movies, version }; top-level `note`
check removed; per-entry `note` validation unchanged) +
`scripts/journal-manifest.test.mjs` (case 21 rewritten: note-less manifest
validates clean; new case 21b: a top-level note is now an extra key; old
21b/21c removed; suite 133 → 132). The 30-minute / one-entry rotation (B8)
is already live on main — verified in `src/components/home-journal.ts`
(`JOURNAL_WINDOW_MS = 1_800_000`, singleton sets, 106 × 30 min = 53-hour
cycle, wall-clock derivation, no server state); no rotation change in this PR.
**Status:** edits landed; gates running. No panel verdict on this tip yet
(not self-certified). Merge: owner's word only.
**Assumption recorded:** no branch was assigned for this fix; this branch
was cut from main `9cf9e64f` to carry it, and the PR is opened under the
owner's standing "complete the work, open the PR, never merge" policy.

# BRANCH_STATUS — feat/journal-prefetch

**Branch:** `feat/journal-prefetch` · **Base:** current main `10e8121d` (PR #369 merged; was frozen main `f2bbf1a2`; stacked on player `feat/journal-player` @ `af7ec7c1`, which is a separate live branch)
**Task:** Meridian lazy-load scenario 2 — background prefetch of journal movies WHILE the user is playing the game. Tap-to-load stays the primary path.
**Status:** Rebased onto current main `10e8121d` (clean, 48 commits, zero conflicts; tip `72b5569f` before the fix commit); Option 1 spec filter implemented (endgame-share `expectCleanConsole` also filters `net::ERR_TUNNEL_CONNECTION_FAILED` only, Dinesh's explicit approval 2026-11-09 ~20:49 CT); gates + E2E re-run on the fix tip — see "Rebase + Option 1 fix" section. No PR, no merge.
**Rebased:** 2026-11-09 — onto current main `10e8121d`; zero conflicts. The unanimous APPROVE on `c19f8dfc` does NOT transfer to the new head. The Edge verdict NO (endgame-share 0/2) on `0a08007e` does NOT transfer either — this is a new tip; panel (GATE/Chitti) re-verifies.

## Rebase + Option 1 fix — onto current main 10e8121d, this run (2026-11-09 evening)

- Plain `git rebase origin/main` (48 commits, zero conflicts). The branch is stacked on the player branch (`feat/journal-player` @ `af7ec7c1`, separate live branch), so the delta vs main is 163 files — the player feature + the prefetch feature. The prefetch commits alone cannot rebase onto main: they modify `journal-player.tsx` / `journal-movies.ts`, which do not exist on main. The validator/wiring from #369 (on main) and the prefetch changes are both present in the rebased tree (verified: `scripts/validate-journal-manifest.mjs` + `src/components/journal-prefetch.ts` both present; `package.json` prebuild runs the validator; manifest has 106 movies).
- Option 1 (Dinesh's pick, 2026-11-09 ~20:49 CT — explicit approval + recorded rationale for weakening the endgame-share gate): `tests/e2e/endgame-share.spec.ts` `expectCleanConsole` now also filters `net::ERR_TUNNEL_CONNECTION_FAILED` only, with a comment citing the prefetch failure contract (`journal-prefetch.ts:35-36`) and the `globe-promotion-offline` precedent (`:180-186`). Touch ONLY that spec file (+ this file). No src changes, no other spec changes.
- Gates + E2E on the fix tip `d6c5985c` (builder-side evidence; panel re-verifies): tsc exit 0 clean; `npm test` exit 0 (scripts 1161 pass / 11 skipped / 0 fail of 1172; src 2322 pass / 0 fail); `test:worker` 145 pass / 0 fail; lint-cards GATE PASSED; `npm run build:pages` exit 0, buildId `d6c5985c`; `endgame-share` **2/2 pass** (the Option 1 filter cures the Edge NO); targeted E2E **34/34 pass** (prefetch 12/12, boot-home 3/3, footer-close 1/1, geodetective 18/18). Logs: `~/workspace/journal-prefetch-fix/{npm-ci,tsc,npm-test,test-worker,lint-cards,build-pages,e2e-endgame-share,e2e-targeted}.log`.
- This commit adds only this BRANCH_STATUS.md text on top of the fix tip. Pushed head = this commit.

## Rebase verification — onto player head af7ec7c1 (movies 84fa3a0a, frozen main f2bbf1a2), this run (2026-11-09)

- Plain `git rebase af7ec7c1` replayed already-applied movies/player commits, so the rebase used `--onto af7ec7c1 86624dde` (26 prefetch-only commits). Every conflict was this file only (docs-only), resolved by keeping both sides' records.
- Content check: same 47 files in the prefetch delta; all 46 non-status files byte-identical diffs vs the old head. B7/B8/share verified in code at the new head (boot `useState<boolean>(false)`; `journalSetCount()` = 106 singletons, window 30 min; `WORKERS_ORIGIN` = `https://meridian.knowledgetest.workers.dev/`).
- Gates + E2E + recording as in Status. Logs: `~/workspace/journal-prefetch-r3-{tsc,npmtest,worker,lintcards,build,e2e-union,mux}.log`. Recording: `~/workspace/journal-prefetch-record/prefetch-desktop.mp4` (take 3, entry giza; prefetch warmed giza + cn-tower before the tap).
- mux.sh probe windows [35,45]/[0,34] are take-2 geometry; take 3 was probed at the correct windows [25,33] (playing, −19.5 dB) / [0,24] (pre-play, −91 dB).
- The unanimous APPROVE on `c19f8dfc` does NOT transfer. Re-check by the three blocking seats pending on this head.

## Base record — feat/journal-player (rebased onto movies head 84fa3a0a, frozen main f2bbf1a2)


**Branch:** `feat/journal-player` · **Base:** `feat/journal-movies` @ `84fa3a0a` (stacked on frozen main `f2bbf1a2` #370)
**Rebased:** 2026-11-09 — onto movies head `84fa3a0a`; only conflict was this file (docs-only). Historian-block clearance on `86624dde` does NOT transfer to the new head.

## Rebase verification — onto movies head 84fa3a0a (frozen main f2bbf1a2), this run (2026-11-09)

- Gates ran on `576e1e06` (rebase-record commit); this commit adds only this
  BRANCH_STATUS.md text on top. Pushed head = this commit.
- Gates on `576e1e06`: `npx tsc --noEmit` exit 0; `npm test` exit 0 (scripts
  1161 pass / 11 skipped / 0 fail of 1172; src 2302 pass / 0 fail);
  lint-cards GATE PASSED; `npm run build:pages` exit 0, buildId `576e1e06`.
  No workers/ changes, so no test:worker. Logs:
  `~/workspace/gjm-player-r2-{tsc,npmtest,lintcards,build}.log`.
- Docs-only: `git diff 84fa3a0a..HEAD --stat` = BRANCH_STATUS.md + the 136
  player files; no other files. All 136 branch files byte-identical to old
  head `86624dde` (`git diff 86624dde HEAD -- <files>` empty). 5 corrected
  Historian facts verified intact in `public/videos/journal-transcripts.json`
  and the VTT files (alamo 1718, cadillac winter-only, joslyn IN Omaha,
  niagara New York meets Canada, homestead 1862 law); old wordings absent.
- Historian-block clearance on `86624dde` does NOT transfer. This head is
  ready for Firefox (testing prompt:
  `~/workspace/journal-testing-prompts-duckduck-firefox-edge.md`). No E2E /
  panel / recording in this run (gates only, per the split).
**Owner order:** 2026-11-07 — "Build all journals" (Old Faithful pilot approved)
**Status:** 106/106 clips BUILT and HOSTED (incl. pilot) — not "all
verified". All 12 batches delivered (batch 08 is 8/8 new + pilot); nothing
unbuilt. What is actually established (detail: `docs/journal-movies.md` →
"Verification actually done"):
- Verified: 106-id mapping to `JOURNAL_NOTES`, URLs serve 200 and match
  meridian-media `08c8308`, ffprobe format + full decode on all 106.
- Sampled still frames and automated video descriptions exist (8 original
  clips in an earlier automated watch; then all 106, 26 full-quality + 80
  compressed). They do not establish full visual/factual clearance.
- Reliable narration verification across 106 remains incomplete: automated
  tools were inconsistent about audio access, so trusted listening is 0/106.
  No scripts/transcripts kept. Owner's listen is the final check.
- Manifest notes are self-reported. A wording heuristic (note opens with
  Clean/Cleanest/Best clip) splits them 26 / 80; the 80 is NOT a verified
  defect count. Known fallbacks: haymarket, university-place (still +
  narration). Shipping is the owner's call.
- Not built: no app code reads the manifest; no movie plays in the app.
"Done" items below mean the coordinator's per-batch check ran — not that a
clip passed every recipe gate.
Next: see Pending. PR #369 is open; never merge without the owner's word,
per PR, per head.

## Done
- [x] Step 0a — CORS gate: `curl` on old-faithful.mp4 shows `Access-Control-Allow-Origin: *` (plus `Cache-Control: max-age=600`, ETag, `Accept-Ranges: bytes`). Prefetch can work.
- [x] Step 0b — Cache-reuse experiment (real-server probe, `~/workspace/journal-prefetch-probe/`, driver `probe-production-clip.mjs`, log `exp4-production-clip.log`): production clip `southpointe.mp4` (3,623,177 bytes) fetched via CORS + drain, then a `<video preload="none">` tap — server-side clip hits stayed at 1 before AND after the tap (1→1, zero additional transfers); video played (paused=false, currentTime 2.04). Hidden-`<video preload="auto">` warm scored the same 1→1; fetch wins on simplicity. Route interception CANNOT observe cache reuse (fulfilled responses bypass the cache) — E2E under interception asserts prefetch requests happen, reuse is proven by the probe.
- [x] Step 1 — `src/components/journal-prefetch.ts` (gating, entry selection, bounded runner ≤2 concurrent, per-fetch AbortController, never rejects) + 17 unit tests (16 + the B1 manifest-retry test); GameApp wiring (`run !== null || loopOpen` trigger, stops on round end / tab hidden / unmount) with the follow-up fixes: skip warming when the tab is already hidden at round start, warmed ids keyed per journal set (a set rotation gets a fresh set), manifest cache reset on null so a transient failure cannot poison the tap path (B1), and the manifest baseUrl re-pinned to the validator's pinned value; tsc clean.
- [x] Step 2 — Loading spinner on the player's loading state (decorative, aria-hidden, keeps the text; the loading text carries `role="status"`; never renders under reduced motion) + CSS + 2 unit tests.
- [x] Step 3 — E2E `tests/e2e/journal-prefetch.desktop.spec.ts`: (i)–(xi), 12 tests. First run (`~/workspace/journal-prefetch-e2e1.log`) 7 passed / 2 failed — (vii) and (viii-a) both timed out waiting for the movie element, because the manifest-delay helper's `route.continue()` goes to the real network, not to serveBuiltArtifact's route; fixed by fulfilling the manifest from the built file after the delay, and the re-run of the 2 (`~/workspace/journal-prefetch-e2e2.log`) passed 2/2.
- [x] Step 3 (final pass, code head `05b8f506`) — E2E regression union, sequential (`--workers=1`, `flock ~/workspace/.e2e.lock`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE=$HOME/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`, `VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy` at build + test time), log `~/workspace/journal-prefetch-final-e2e.log`: **87 passed / 1 failed (25.9 m)**. Per spec: journal-prefetch.desktop 12/12, journal.spec 5/5, journal-player.desktop 4/4, journal-player.mobile 1/1, journal-player.reduced 1/1, captions.desktop 4/4, captions.mobile 2/2, fixes.desktop 8/8, fixes.mobile 2/2, journal-art.desktop 1/1, geodetective-boot-home.desktop 3/3, geodetective.spec 17 passed / 1 failed, geodetective-hint.spec 7/7, pack-deal-fallback.desktop 3/3, reset-history.desktop 6/6, scout-toggle.desktop 11/11.
- [x] Step 3 — ONE FAILURE, deterministic, pre-existing (not a B1–B8 regression): `tests/e2e/geodetective.spec.ts:199` "win path: seam deal…" fails at line 256 — expects the share text to contain `https://meridian.knowledgetest.workers.dev/`, but the app produced `https://veeresh-bikkaneti.github.io/Meridian/`. Isolated re-run (`~/workspace/journal-prefetch-final-e2e-rerun.log`) fails identically (exit 1, same assertion, same received text). Root cause: `build:pages` bakes `BASE_URL=/Meridian/`, so `shareOrigin()` (`src/lib/og/share-meta.ts`) returns the Pages origin; #128 changed `BRAND.siteUrl` + the test expectation to workers.dev but left `shareOrigin`'s Pages branch intact. B1–B8 changed nothing in `src/game/share.ts`, `src/lib/og/share-meta.ts`, `src/game/brand.ts`, or `vite.config.ts` (zero diff `86624dde..HEAD`), and B7's edit to this spec touched only the reload tests — the share assertion is untouched. No prior branch log shows this test passing under a `build:pages` artifact. **FIXED by owner ruling 2026-11-09 — see "Share-URL fix" below; :199 passes, union is 88/88.**
- [x] Step 4 — Full gates on the final CODE head `05b8f506` (final pass, logs `~/workspace/journal-prefetch-final-*.log`): `npx tsc --noEmit` exit 0 (clean); `npm test` exit 0 — scripts 1154 pass / 11 skipped / 0 fail (1165 tests, 55 suites), src 2322 pass / 0 fail / 0 skipped (171 suites); `npm run test:worker` exit 0 — 145 pass / 0 fail; `node scripts/lint-cards.mjs` exit 0 — GATE PASSED; `npm run build:pages` exit 0 — buildId `05b8f506`. (Previous full-gates green was `f4b1639d`: scripts 1154 pass / 11 skipped / 0 fail; src 2320 pass / 0 fail — the +2 src tests are the B7/B8 additions.)
- [x] B7 — Boot always lands on Home, never auto-opens GeoDetective (owner ruling, 2026-11-09; fix `b81ae06d`, E2E `78038be1` + `b247057a` + `cb128987`): a saved loop (`loopOpen` flag + saved mystery) resumes only on tap-in ("GeoDetective: Resume your case" / "Solve a mystery"), same clue/guess state, no re-deal; a finished-but-unacknowledged reveal re-renders. Recorded in the Handbook, `docs/handbook/02-game-design-decisions.md` §2 (final pass — the B7 agent had flagged it as missing). The B4 law question is MOOTED by B7: reload lands on Home, so no restored loop warms and there is no reload-time prefetch question. Cold Trail restore left alone as intentional per PR #203 (its persisted open flag restores its screen on reload — see the comment at the Cold Trail render branch in `src/components/game-app.tsx`).
- [x] B8 — One entry per 30-minute window (fix `cb66339f`, unit `2dd98b52`, E2E `05b8f506`): 106 entries × 30 min = a 53-hour cycle; footer reads "Entry X of 106"; prefetch warms the current + next window's entries. The old set-boundary straddle (a set spanning two windows) no longer exists. `docs/handbook/06-design-and-ux-decisions.md` already updated for the journal by B8 — not duplicated here.
- [x] B5 (Reality Checker) — "89 → 88 on player close" in the take-2 video: NOT an app bug — a Playwright screencast-capture artifact, proven, no code change. The DOM never renders 88: a `MutationObserver` over the whole record journey (body-scoped, so it survives the Home unmount/remount round-trip) logged exactly 3 footer-text states — `Entry 89 of 106` at load, `<none>` while Home is unmounted during the round, `Entry 89 of 106` on return — and zero further changes through close + 3 s; a 100 ms DOM poll across the close likewise read 89 at every sample (logs `~/workspace/journal-prefetch-observer2.log`, `~/workspace/journal-prefetch-videoprobe.log`, `~/workspace/journal-prefetch-shot.log`). The same instant, captured two other ways, reads 89: `page.screenshot` (`test-results/footer-after-close.png`, "ENTRY 89 OF 106") vs the screencast frame at the same wall-clock moment ("ENTRY 88"). The video's 88 is real pixels in the capture (pixel-diff vs the 89/88 reference strips: d88 ≈ 1.5–1.8, d89 ≈ 36; present even in an intra-coded keyframe at 40.96 s in take 5, so it is in the screencast source frames, not VP8 interframe prediction) — but the app cannot produce it: note and footer come from the one `journalEntry` object (`src/components/game-app.tsx:4603-4604`, footer `:5193-5195`), and giza is index 88 (display 89) while index 87 is sagrada (`node --experimental-strip-types` import of `home-journal.ts`), so a genuine 88 would show Sagrada Família as the note — the video still shows Giza. The mocked clock cannot explain it either (`journalSetIndexAt(2026-10-16T12:00Z)` = 88; the take never leaves that window; the real-clock index at record time is 83, not 87). Boundary: screencast-only, post-close only (video→poster transition), in 4 takes (take 2 delivered mp4 + raw, re-runs take 3/4/5/6); no DOM, screenshot, or unit observation ever shows it, and production has no screencast — a real user sees 89. Regression guard: `tests/e2e/journal-footer-close.desktop.spec.ts` asserts the DOM footer is identical before open and after close on the same entry. Standing lesson: video frames are not a reliable oracle for footer text — DOM/screenshot win on disagreement. Fix-pass verification on code+test head `76b8c16c` (logs `~/workspace/journal-prefetch-b5-*.log`): `npx tsc --noEmit` exit 0; `npm test` exit 0 — scripts 1154 pass / 11 skipped / 0 fail, src 2322 pass / 0 fail; `npm run test:worker` exit 0 — 145 pass / 0 fail; `node scripts/lint-cards.mjs` exit 0 — GATE PASSED; `npm run build:pages` exit 0 — buildId `76b8c16c`; E2E journal family 41 passed / 0 failed (7.6 m): footer-close 1/1, journal-prefetch.desktop 12/12, journal.spec 5/5, journal-player.desktop 4/4, journal-player.mobile 1/1, journal-player.reduced 1/1, captions.desktop 4/4, captions.mobile 2/2, fixes.desktop 8/8, fixes.mobile 2/2, journal-art.desktop 1/1.
- [x] B6 (Reality Checker) — BRANCH_STATUS head lines: the tip was `2b196516` (docs-only over code head `05b8f506`), not `05b8f506`. Status + Head lines corrected in this pass; the Step 3/4/5 lines still cite `05b8f506` deliberately — that is the code head the gates / E2E / record actually ran on, not the tip. Audio figure corrected in the same pass (see Step 5 final-pass line): take-2 [35, 45] is −19.1 dB (re-probed 2026-11-09 by the B5/B6 fix pass and re-verified by mux.sh's own probe + atrim cross-check; −25.6 dB is the whole-file mean, not the segment figure).
- [x] Share-URL fix (owner ruling, 2026-11-09; fix `0cf449d7`): the share text must point at workers.dev, not the Pages origin. **Scope check first:** `shareOrigin()` served four consumers; the share path is `src/game/share.ts:53` (`shareText`) and `:117` (`shareLoopText`) — the share text (ruling target) — plus `src/game/share-action.ts:120` (`SHARE_URL`, the `url` of the `navigator.share` payload); `src/routes/__root.tsx:127` is OG meta (`og:url`/`og:image`), where the Pages origin is CORRECT as the canonical URL of the served page. So `shareOrigin()` itself and `__root.tsx` are UNTOUCHED; only the share path changed — `shareText`/`shareLoopText` now use `WORKERS_ORIGIN` (`src/game/share.ts:53`, `:117`) and `SHARE_URL = WORKERS_ORIGIN` (`src/game/share-action.ts:120`), superseding the Wave 1 P0 Item 4E/4F build-aware share for shares only. The `baseUrl` params are retained for call-site compatibility (the updated Pages-input unit tests still prove Pages input → workers.dev output). **Tests updated to the ruling (named, not silent):** `src/game/share.test.ts:153` — "Pages build share carries the Workers link (owner ruling 2026-11-09)" and `:189` — "Pages build geodetective share carries the Workers link (owner ruling 2026-11-09)"; `src/game/share-action.test.ts:202` — "Pages build share carries the Workers link (owner ruling 2026-11-09)" (sessionShareText) plus `:191` — the SHARE_URL test, "SHARE_URL is the single canonical workers.dev URL (owner ruling 2026-11-09)" (assertions unchanged); `tests/e2e/endgame-share.spec.ts:42` — `SITE_URL` github.io → workers.dev (its text assertion `:240` and `url:` assertion `:313` follow from it). `src/lib/og/share-meta.test.ts` unchanged (`shareOrigin` + OG behaviour intact). **Verification on `0cf449d7`** (logs `~/workspace/journal-prefetch-sharefix-*.log`): `npx tsc --noEmit` exit 0; `npm test` exit 0 — scripts 1154 pass / 11 skipped / 0 fail, src 2322 pass / 0 fail; `npm run test:worker` exit 0 — 145 pass / 0 fail; `node scripts/lint-cards.mjs` exit 0 — GATE PASSED; `npm run build:pages` exit 0 (VITE_KOFI_URL set at build + test time). E2E geodetective spec first (`~/workspace/journal-prefetch-sharefix-e2e-geodetective.log`): **18/18 passed (4.4 m), :199 win path passes**. Full union (`~/workspace/journal-prefetch-sharefix-e2e-union.log`, sequential `--workers=1`, `flock ~/workspace/.e2e.lock`, same 16 specs): **88 passed / 0 failed (20.9 m)** — geodetective.spec 18/18 (was 17/1), all other per-spec counts identical to the 87/1 run. No screen recording: the share flow's user-visible surface (the share-text line) is asserted by the E2E specs above; no record-spec coverage exists for it.

## Design corrections vs the brief (verified from code, not re-litigated)
- The effect lives in **GameApp**, not in Choose/home: GameApp returns early with `<Play>`/`<LoopScreen>` while a round is active, so Choose is unmounted during gameplay and no effect inside it could run. The set is derived from the wall clock (same derivation Choose initialises from).
- The effect keys on the round-active **boolean**, not on `run` itself: `run` is a new object on every pin drop / phase change, so keying on it would abort and restart the warm mid-round.

## History — feat/journal-player Part 3 (restored)

The player-branch history below was deleted from this file; restored from `feat/journal-player`'s `BRANCH_STATUS.md` (`86624dde`) and its git log — no facts invented. Part 3: 5 Historian-blocked facts corrected (text + audio) at head `a7191e3e` (verified `86624dde`): cue 2 only, in `public/videos/captions/<id>.vtt` + `public/videos/journal-transcripts.json` (VTT↔JSON 0 mismatches, 20 cues) — alamo "An old mission, from 1718." (was "from 1836"), cadillac "In winter, it catches the first sunrise!" (was "It catches the first sunrise in the country!"), joslyn "Joslyn's museum stands right in Omaha." (was "...stands north of Omaha."), niagara "They drop where New York meets Canada!" (was "They drop over a cliff in New York."), homestead "One of the first claims, under the 1862 law." (was "One of the first claims, back in 1862."); manifest untouched. The audio fix lives on meridian-media `fix/journal-facts-5` @ `70b2e95` (separate repo, NOT merged — the live site still serves the old clips). Verification: E2E facts specs 6/6 desktop + 2/2 mobile, regression 31/31; recording `~/workspace/journal-player-facts-play/facts-desktop.webm` (94.6 s, all 5 corrected lines legible on-video).

## Pending
- [ ] endgame-share E2E (NOT in the union; pre-existing, NOT a share-fix regression): `tests/e2e/endgame-share.spec.ts` fails 2/2 on BOTH `228467d2` (pre-fix head) and `0cf449d7` (share-fix head) with the identical signature — `expectCleanConsole` fails on two `Failed to load resource: net::ERR_TUNNEL_CONNECTION_FAILED` console errors. Trace proves the failed fetches are the journal-prefetch mp4s (`meridian-media/journal/redeemer.mp4`, `sagrada.mp4`) fetched for real during gameplay — VM Chromium via the egress proxy cannot reach github.io (standing VM limitation), and this spec has no mp4 route interception (unlike the journal-prefetch spec). The share assertions themselves PASS on the new head (clipboard exact text `:240`, `navigator.share` call `:313` — execution reaches the console check after them). Logs: `~/workspace/journal-prefetch-sharefix-e2e-endgame-share.log` (new head), `...-rerun.log` (identical re-run), `...-prefix.log` (pre-fix head, identical failure). Fix is a separate decision — intercept the mp4s in this spec as the journal-prefetch spec does, or scope the console check — NOT done here; the share fix touches no prefetch or console-check behaviour.
- [x] Step 5 — Screen recording (gameplay → prefetch → instant tap-play) + network trace, audio-probed per the video-audio law. Record spec: `tests/e2e/journal-prefetch.record.desktop.spec.ts` (1 passed, 39 s, first take). Recording: `~/workspace/journal-prefetch-record/prefetch-desktop.mp4` (37 s, 800×500, h264 + aac) — raw Playwright capture `prefetch-desktop-raw.webm`, timeline `timeline.json`, mux script `mux.sh`. Audio gate on the OUTPUT: ffprobe shows h264 + aac; volumedetect playing segment [26.4, 36.4] mean −19.1 dB / max −1.0 dB (audible narration), pre-play [0, 26] mean −91.0 dB (silent). Frames verified: t=12 s globe round in progress, t=30 s movie playing 0:03/0:10 with entry text on, t=36 s player closed, still + badge back. Timeline proof: round started t=9186 ms → manifest t=9188 → southpointe prefetch t=9843 → havelock prefetch t=9860 → back home t=21577 → tap t=25742 → movie playing t=26964. One fix found: the spec's first audio-delay estimate used performance.timeOrigin under the mocked clock and collapsed to 0; recomputed from eval wall time minus video currentTime (26,374 ms).
- [x] Step 5 (final pass, code head `05b8f506`) — RE-RECORDED on the final head, log `~/workspace/journal-prefetch-final-record.log`: record spec 1 passed (48.4 s). New take, `~/workspace/journal-prefetch-record/`: `prefetch-desktop.mp4` (45 s, 800×500, h264 + aac, 1,519,685 bytes) from raw `prefetch-desktop-raw.webm` (46.48 s); `mux.sh` default `DELAY_MS` updated 26374 → **34927** (new timeline `audioDelayMs`), `-t` 37 → 45, probe windows moved to the new beats. Timeline proof (entry this take: giza — window-dependent): manifest t=11720 → round started t=12577 → giza prefetch t=12887 → cn-tower prefetch t=13093 → back home t=30779 → tap t=34287 → movie playing t=36013 (audioDelayMs=34927) → closed t=44393. Audio gate on the OUTPUT (re-probed 2026-11-09 by the B5/B6 fix pass and re-verified by mux.sh's own probe + atrim cross-check: the −19.1 dB quoted here before was correct for take 2; −25.6 dB is the whole-file mean, not the segment figure): ffprobe shows h264 + aac; volumedetect playing segment [35, 45] mean **−19.1 dB** / max −0.9 dB (audible narration), pre-play [0, 34] mean −91.0 dB (silent). Frames verified: t=20 s Globe round in progress (Kriva Palanka card, Drop pin), t=38 s movie playing 0:02/0:10 with entry text on ("Great Pyramid of Giza", footer "ENTRY 89 OF 106 · NEXT ENTRY IN 0:30"), t=44.6 s player closed, still + "Watch the movie · 10 sec" back (footer in the VIDEO then reads "ENTRY 88 OF 106" — see B5 below: a screencast-capture artifact, the DOM reads 89; not an app bug, no re-record). Near-miss caught: the record spec writes the video only under `test-results/…/video.webm` — the first mux of this take ran against the STALE 12:55 raw (37 s) with the new delay; caught by the duration check, raw re-copied from `test-results/journal-prefetch.record.de-dffb5-fetches-tap-plays-instantly-desktop/video.webm`, mux re-run. The stale first-take frames (frame-12/30/36) were replaced with the new take's frame-20/38/44.

## Never
- Never merge — merge word stays the owner's, per PR, per head.
- Never rebuild the pilot. Never bundle all 106 into the app (lazy-load only).
- No ear-verification here — owner's listen is the final check per clip.

---

## Merged main record — feat/watson-station (PR #372, main @ 63d82869)

Preserved from main during the rebase onto 63d82869: the watson-station
branch-status record that main carried at the merge. It is not this
branch's work; it is kept here so the rebase does not silently drop it.

### feat/watson-station record

- **Branch:** `feat/watson-station` · **Base:** `main` @ `9e49da3` (PR #365 merged + live)
- **Task:** Watson holds the clue-card station through the guessing phases.
- **Owner defect:** 2026-11-08 ~00:53 CST — Watson standing large at the
  map's bottom-left corner on the owner's phone during guessing.
- **Diagnosis of record:** `~/workspace/meridian-detective-evidence/diag-watson-corner/DIAGNOSIS.md`
  — the walk works on live production; when a clue read ends, the state
  machine enters `SEARCH_IDLE`, whose view parked Watson at placement
  "dock" (rendered inside the map, bottom-left), and `SEARCH_AREA` /
  `SELECTION_READ` / `ASK_NEXT` kept him docked. Owner's standing ruling
  (2026-11-07): "Watson stays at the clues once play starts."

TASK / requested outcome: change Watson's placement from "dock" to
"station" in exactly four phases of `viewForState`
(`src/game/loop/detective/detective-state.ts`) — SEARCH_IDLE,
SEARCH_AREA, SELECTION_READ, ASK_NEXT — poses unchanged, no Holmes
placement or pose changed anywhere. Verify DetectiveHost needs no
logic change (it renders purely from the machine's placement), update
the unit + E2E pins that required Watson at the dock in the FULL
(non-degraded) path, and record the cure in the handbook.

Tier and rationale: Tier 1 builder silo under the coordinator's brief —
one proven mechanism, one view-table change. Independent clean-context
QA + panel verification are run by other agents, not the builder.

Done condition / evidence:
- Unit (TDD, RED first): the search-view pin flips dock → station; a
  new per-phase test pins SEARCH_AREA / SELECTION_READ / ASK_NEXT with
  Holmes-placement guards in all four phases. RED confirmed
  (dock ≠ station) before the cure; GREEN after.
- Host check: every `view.watson.placement === "dock"` consumer traced
  (`watsonOnMap`, `watsonReplayDockEl`, `mapSoundEl` guard, the map
  portal block) — all are placement-generic; in the cured phases the
  station cluster (figure, gutter transform, replay-at-station,
  station sound cluster) takes Watson and the map portal renders
  Holmes alone (the dock cluster markup is already conditional on
  `watsonOnMap`, so it tolerates Watson's absence). **Zero host logic
  changes** — only two stale comments updated.
- Degraded path untouched by design: dock-only companion
  (`data-companion="dock"` — Holmes's berth verdict), tap speech mode,
  and the "dock" member of `WatsonPlacement` (host fallback) all stay;
  E2E pins for that path were not modified.
- Gates: see Status below (real results, filled by the builder).

Files in scope: `src/game/loop/detective/detective-state.ts`,
`src/game/loop/detective/detective-state.test.ts`,
`src/game/loop/detective/DetectiveHost.tsx` (comments only),
`tests/e2e/detective-replay.spec.ts`, `tests/e2e/detective-sound.spec.ts`,
`tests/e2e/detective-visibility.spec.ts`,
`tests/e2e/detective-watson-walk.spec.ts`,
`tests/e2e/detective-endings.spec.ts` (gap-closure round),
`tests/e2e/detective-staging.spec.ts` (comment only),
`docs/handbook/10-holmes-and-watson-pair.md` (new dated record section),
this file.

Collision note: the #364 lane (`feat/holmes-follow`) touches the same
two source files (`detective-state.ts`, `DetectiveHost.tsx`). This
branch is off `main` @ `9e49da3` and merges independently; whichever
lane merges second rebases over the other.

## Status

- [x] Diagnosis read in full; mechanism confirmed in code
- [x] Unit test RED (dock ≠ station in the four phases)
- [x] Cure: four placements → "station" + plain-tone why-comments — `63879d8`, pushed
- [x] Host audit: zero logic changes needed; stale header + map-render comments updated — `45865ff`, pushed
- [x] E2E pins updated (full path only; degraded pins untouched) — `c142574`, pushed
- [x] Handbook: "Watson station cure (2026-11-08)" record section — `d732610`, pushed
- [x] Builder gates:
  - `npx tsc --noEmit` — clean
  - `npm test` — PASS (final suite 2267/2267, 0 fail; command exit 0)
  - `npm run test:worker` — PASS (145/145, 0 fail)
  - `node scripts/lint-cards.mjs` — GATE PASSED
  - `npm run build:pages` — PASS (exit 0; prerender + fingerprint-sw
    completed. Two earlier local attempts were killed by VM restarts
    mid-build — environment, not build errors — and the gate was
    re-run clean to this result.)
- [x] PR opened — PR #372 (opened by the pipeline finisher; the
  builder brief forbade the builder from opening it)
- [ ] Merge — on the owner's word / coordinator only, never the builder

## GATES STATE (finisher session, 2026-11-08 — updated after every gate)

Finisher: pipeline-finisher subagent (lane 1 of the owner's sequential
pipeline law). Base verified against **origin/main `9e49da3`** — the
local `main` ref is stale (#361-era `97d1dcf`); origin/main IS an
ancestor of this branch and the true branch diff is 11 files (709+/185−, measured at 3f3eaf0; later commits are docs-only).

- [x] Chromium launch RE-TEST: the WebGL-policy outage is OVER for the
  real spec path — Playwright + bundled chromium-1243 launches and
  renders the app. Two environment facts every E2E run here needs:
  (1) `PLAYWRIGHT_CHROMIUM_EXECUTABLE` must point at the bundled 1243
  binary (the config default `/opt/meta-chromium/chrome` refuses to
  launch); (2) runs go with `TMPDIR=$HOME/playwright-tmp` — the VM's
  /tmp is a 512 MB tmpfs that LANDED AT 100% under other lanes'
  profile/cache junk (since freed), and the home volume carries an
  EDQUOT **file-count** quota: Chromium dies with SIGBUS
  (`BUS_ADRERR`, "Creating shared memory … Disk quota exceeded (122)")
  once renderer shared-memory creation hits it.
- [x] **Gate 1a — `detective-endings.spec.ts`: RUN, 0 passed / 2 failed**
  (full reporter output read; logs in
  `~/workspace/meridian-detective-evidence/station-e2e-2026-11-08/`).
  Runs 1–3 died at the first click on environment (full /tmp, then the
  EDQUOT crash). **Run 4 (clean environment) played both tests end to
  end** — the complete WIN path and the full 5-guess FAIL path ran —
  and both failed on the NEW N2 audit windows only:
  - WIN: `WIN celebrate→debrief @ endings` — worst
    `map:high-five` over clue-2 text ("This is a hot desert cit…"),
    max overlap 4,777.5 px² over 2,900 samples.
  - FAIL: `FAIL fail-read→pout @ endings` — worst `map:think` over
    clue-4 text ("After the PEPCON disaste…"), max overlap 4,777.5 px²
    over 11,920 samples.
  - **N7 VERIFIED PASSING inside the WIN run:** no clue-3/4/5 clip in
    the play record or the network list after the guess-2 solve (the
    test reached and passed that assertion before failing at the N2
    absorb; absence checks fail loudly, so reaching the absorb proves
    them).
  - **What the failure IS (screenshots read first-hand):** at the
    1440 px endings viewport, Watson stands at his clue-card STATION
    (left gutter beside the active card — the cure working) and Holmes
    stands on the card's LEFT EDGE, his painted box overlapping the
    card's first text column. Holmes is the CELEBRATE/FAIL_READ layout
    partner placed beside Watson by the host's existing celebration
    layout — a phase this branch never touched (CELEBRATE was already
    "station" for Watson before the cure; FAIL_READ likewise). The
    sampler's "map:" prefix is its cluster label for Holmes, not a map
    position — in both failure screenshots **neither figure is on the
    map**; both stand at the clue cards. So: **pre-existing
    celebration/fail-read layout overlap, exposed by the NEW N2
    windows (Silo QA's own gap), not a regression of this cure.**
    Per the finisher brief (pin exposes a product bug → flag before
    touching production code) this is flagged to the parent for a
    routing decision; the pins are NOT loosened and production code
    is NOT touched by this session.
- [x] **Gate 1b — `detective-watson-walk.spec.ts`: 9 passed / 0 failed**
  (PLAYWRIGHT_EXIT=0, full output read; log `e2e-walk1.log` in the
  evidence dir). The main walk test at 390/768/1280 carries BOTH the
  N2 guessing-chain window (SELECTION_READ → NOTE_MARK → ASK_NEXT →
  READING sampled in order; window absorbed at 0 px²) and the clue-2
  walk window — **N2 guessing-chain half: PASSING**. The new mid-walk
  tap test passed — **N6: PASSING**. Kill-switch (watsonWalk OFF) and
  reduced-motion tests also passed.
- [x] **Gate 2 — nit-5 measurement TAKEN: maxOverlap 0 px²**
  (watsonWalk OFF via `fulfillFlagsStaging`, 390 px; throwaway probe,
  written → run → deleted; log `e2e-nit5b.log`). 9,600 figure/text
  pair samples across two 4 s windows: the first right after the
  unlock gesture (host not yet mounted — phase null, bench/CASE_OPEN
  window), the second starting 2.5 s after the guess commit (phase
  SELECTION_READ, spanning the guessing-chain into the clue-2 read).
  **No overlap anywhere on the walk-off path at 390 — nothing to
  route.** Caveat for the record: the probe's strict READING-phase
  gate never latched in the walk-off flow (the host mounts only after
  the duet drains), so the windows are labelled by their actual
  phases above, not by the intended READING label; the zero stands
  for the windows sampled.
- [x] Gate 3 — Silo QA delta re-key: the tip moved past `034535e`
  ONLY by this file's GATES-STATE commits (records, zero code/test
  changes) — the existing PASS-WITH-NITS + the now-run-verified gaps
  stand; no code delta exists to re-key. Stated per the finisher
  brief's either/or.
- [x] Gate 4 — PR opened: PR #372; the parent's routing decision
  (a) is recorded — the N2-endings failure is routed to its own
  follow-up (issue #371) and this PR proceeds with the failure
  recorded honestly in the PR body.
- [ ] Gates 5–7 — panel + DevEx + benchmark ran on `3f3eaf0`
  (panel 13/13 in: 1 APPROVE, 10 APPROVE-WITH-NITS, 2 BLOCKs both
  adjudicated pre-existing/out-of-scope — game audio → PR #370/PR 2,
  game player → issues #371/#373 + PR #370/PR 2; DevEx records cure
  applied after the panel, confirmation re-vote follows); merge
  awaits the panel verdict on the cured tip + the parent's merge
  call on the standing audio BLOCK.

> **SUPERSEDED — records cure, 2026-11-08 (pipeline finisher).**
> This capsule's per-gap run statuses below are STALE: they were written
> before the re-runs and claim several gaps are "NOT YET RUN", nit-5 is
> "not taken", and the Chromium outage is current. All three are wrong
> now. The **GATES-STATE section above is the current record**: GAP 4
> (N7) RUN VERIFIED PASSING; GAP 2 endings windows RUN — FAILED on the
> pre-existing CELEBRATE/FAIL_READ overlap (issue #371); GAP 2
> guessing-chain + GAP 3 (N6) RUN VERIFIED PASSING (walk spec 9/9);
> nit-5 MEASUREMENT TAKEN (maxOverlap 0 px²); the Chromium outage is
> OVER. Where this capsule and GATES-STATE disagree, GATES-STATE wins.

## Gap-closure round (2026-11-08, Silo QA PASS-WITH-NITS follow-up)

Test-only pins for Silo QA's N1–N7 gaps; zero production-code changes.

- [x] **GAP 1 (N1) — pinned + PASSING** (`49f210d`): unit test
  "station law past guessing: THINKING_BEAT, FAIL_READ, POUT,
  DEBRIEF and CELEBRATE never dock Watson (owner ruling 2026-11-07)"
  in `detective-state.test.ts` — Watson's placement asserted
  "station" in all five phases (CELEBRATE across all four
  choreography steps). Full suite: `npm test` 2268/2268.
- [x] **GAP 4 (N7) — pinned, RUN VERIFIED PASSING (GATES-STATE Gate 1a)** (`35db604`): endings
  spec "WIN in 2" asserts, after a 2 s settle, that no
  `case-137/clue-3.mp3`, `clue-4.mp3` or `clue-5.mp3` appears in
  either the play record or the network request list. RUN: verified
  passing inside the Gate 1a endings run — the test reached and
  passed this assertion before the run's N2-window failure (absence
  checks fail loudly, so reaching the absorb proves them).
  (Correction, same day: an earlier version of this capsule
  claimed this and the N2
  endings windows were PASSING on a "2 passed" endings run.
  That was a misread of truncated, piped output: the run's full
  output shows **2 failed**, both at browser launch. No endings
  test has passed in this round.)
- [x] **GAP 2 (N2), endings half — pinned, RUN (windows FAILED on the pre-existing overlap, issue #371)**
  (`35db604`): audit windows "WIN celebrate→debrief @ endings"
  (9 s, opens at CELEBRATE) and "FAIL fail-read→pout @ endings"
  (12 s, opens at the final miss) absorbed through `AuditTrail`
  at 0 px². RUN (GATES-STATE Gate 1a): both windows absorbed
  overlap up to 4,777.5 px² from Holmes's pre-existing
  celebration/fail-read placement (issue #371).
- [x] **GAP 2 (N2), guessing-chain half — pinned, RUN VERIFIED PASSING (walk spec 9/9, GATES-STATE Gate 1b)**
  (`368c201`): in the watson-walk main test (all 3 widths), a
  12 s audit window "guessing chain selection→note→ask-next"
  opens once SELECTION_READ is live + 300 ms (the documented
  ~200 ms guess-commit FLIP exclusion kept exactly), with a
  trace assertion that SELECTION_READ → NOTE_MARK → ASK_NEXT →
  READING were sampled in order and a play-order subsequence
  (name → suspicion → ask-next → clue-2). RUN: the window
  absorbed at 0 px² at all three widths.
- [x] **GAP 3 (N6) — pinned, RUN VERIFIED PASSING (GATES-STATE Gate 1b)** (`368c201`): new
  watson-walk test "watson walk: tap on Watson MID-WALK is
  ignored — one figure, walk arrives, held clue read fires
  exactly once (phone 390)". Pins the shipped behaviour: during
  a speech-gated walk the replay cue is hidden and the figure
  cluster is pointer-events:none, so the tap is a no-op — walk
  still "walking" after the tap, exactly one
  `[data-detective="watson"]` in every walking sample (never >1
  anywhere), clue-2 read + ack-2 each exactly once. RUN: passing
  in the Gate 1b walk-spec run (9/9).
- [x] **OBSERVATION (nit 5) — MEASUREMENT TAKEN: maxOverlap 0 px² (GATES-STATE Gate 2).**
  The finisher re-ran the probe (audit sampler + per-frame
  phase, watsonWalk OFF via `fulfillFlagsStaging`, 390px, two
  4 s windows, 9,600 pair samples): maxOverlap 0 px² (log
  `e2e-nit5b.log`). The probe's strict READING gate never latched
  in the walk-off flow, so the windows are recorded under their
  actual phases in GATES-STATE Gate 2.
- **Chromium outage — RESOLVED (see GATES-STATE Gate 1).** At the
  time this capsule was written, every NEW Chromium launch on
  this VM failed with `Hatch WebGL domain policy is required
  for browser startup` (chrome_main_delegate.cc:1283) — a
  runtime policy delivery break, not a code issue. The finisher
  re-test found the outage OVER on the real spec path
  (Playwright + bundled chromium-1243 launches and renders).
  The re-runs prescribed here are DONE — GATES-STATE Gates 1a/1b
  record the results. Historical detail, kept for the record:
  the endings run started 10:42 (VM clock) **failed both tests at
  browserType.launch** with exactly this error (full output in
  the run log; error contexts under `test-results/`); a bare
  `chrome --headless --dump-dom about:blank` reproduced it and
  was still failing at 11:38. The binary's strings show it
  requires `--hatch-webgl-allowed-domains-file` + `-sha256`
  switches that are not present on disk. Re-run prescription
  (DONE):
  `npx playwright test tests/e2e/detective-endings.spec.ts --workers=1`
  then `npx playwright test tests/e2e/detective-watson-walk.spec.ts --workers=1`
  (read the full reporter output — a piped `tail` masks the
  playwright exit code; that masking caused the correction
  above).
- [x] Gap-round gates: `npx tsc --noEmit` clean ·
  `npm test` PASS 2268/2268 · `npm run test:worker` PASS 145/145 ·
  `node scripts/lint-cards.mjs` GATE PASSED ·
  `npm run build:pages` PASS (exit 0)

---

## feat/journal-player — Impeccable follow-up, Part 1 (6 small fixes)

**Branch:** `feat/journal-player` · **Base:** `0f06a852` (stacked on #369's `4964a727`)
**Owner order:** "Yes. Keep going" — implement the 6 fixes, no merge, no PR.
**Status:** all 6 done, all gates green, recordings delivered. Head `fc64a897`.

- [x] 1. Mute (`f1ce6c99`): mute toggle in the controls (`journal-player-mute-<id>`,
      ≥44px, aria-pressed, toggles `video.muted` — synced onto the element
      directly since React's muted attribute doesn't reliably update the
      property). Badge is now "▶ Watch the movie · 10 sec 🔊" (aria-hidden);
      play button aria-label warns of sound ("10 seconds with sound").
      The header comment's "Audio is never muted" line updated.
- [x] 2. Tap-to-pause (`97e504d7`): clicking the video toggles play/pause;
      a tap-pause flashes a large ⏸ overlay for ~600ms
      (`journal-player-pause-flash-<id>`); toggle button untouched.
- [x] 3. Focus, WCAG 2.4.3 (`7ab25178`): on open, focus moves into the player
      (video, tabIndex -1, once ready; Close button while loading/on error).
      On close — Close button, Escape, or any path — focus returns to that
      entry's `journal-play-<id>` button instead of landing on BODY.
- [x] 4. Error retry (`6a1eeb0a`): "Try again" button
      (`journal-player-retry-<id>`) on the error state; adds
      `resetJournalMovieManifestCache()` (unit-tested: fetch → reset → fetch
      again) because the memoized loader would otherwise cache the failed
      fetch for the whole page load.
- [x] 5. Skip link, WCAG 2.4.1 (`d49a8bc6`): first focusable element on the
      home page, visually hidden until focused, jumps to `#home-journal`
      via the existing scrollTo (focus lands in the section): 1 Tab + Enter.
- [x] 6. GET INVOLVED nav at 390px (`996bdb31`): the ≤680px nav row wrapped
      instead of scrolling (was 83px past the right edge, scrollWidth 453
      vs clientWidth 350). All 6 items in-bounds, no strip scroll; desktop
      rules untouched.
- [x] E2E (`d0d8bd4c`, fixed in `3fc78134`): 10 new tests
      (journal-player.fixes.desktop/mobile.spec.ts) — all 6 fixes at 1280
      and 390, media fulfilled with the real 10 s Old Faithful clip
      (`stubJournalMediaRealClip`). First run 7/10: the retry stub's
      `route.continue()` sends the request to the real network (nothing
      listens on 4123 — the artifact is served from disk), so the second
      fetch failed; probe-verified, test now fulfills the real manifest
      bytes. The nav `boundingBox()` nulls were a transient measurement
      flake (probe re-measured GET INVOLVED right=953.5 at 1280); tests now
      read getBoundingClientRect. Re-run: 10/10.
- [x] Recordings (`fc64a897`): one continuous take per viewport
      (journal-player.fixes.record.*.spec.ts) — nav, skip link (desktop),
      retry, mute, tap-to-pause + flash, Escape/close focus return,
      keyboard reopen + Tab through controls.
      `~/workspace/journal-player-fixes-play/fixes-desktop.webm` (41.5 s,
      800x500) and `fixes-mobile.webm` (21.9 s, 368x800). Video-only, no
      audio. Frames spot-checked: skip pill, playing movie with Sound
      button, Muted state, new badge on close.
- [x] Gates (buildId `996bdb31`): `npx tsc --noEmit` clean ·
      `npm test` scripts 1154 pass / 0 fail / 11 skip, src 2282 pass /
      0 fail / 0 skip (baseline src 2281, +1 new reset test) ·
      `node scripts/lint-cards.mjs` GATE PASSED ·
      `npm run build:pages` green (VITE_KOFI_URL set) ·
      pre-existing journal-player E2E 7/7 (desktop, mobile, Old Faithful,
      reduced). Logs: `~/workspace/gjm-player-fixes-{gates,e2e,e2e2,
      e2e-regress,record,build,probe}.log`.

Out of scope, NOT done (separate items): mobile progress bar 27px wide
(Impeccable P1); loop/end-card issue (loop makes onEnded/Play-again
unreachable). The 106 clips' narration/audio/visuals are NOT verified
by this work. No merge, no PR opened.

## feat/journal-player — Part 2: desktop two-column layout + captions/transcript (approved mockup)

**Branch:** `feat/journal-player` · **Base:** `0f06a852` (stacked on #369's `4964a727`) · **Head:** `12dce717` (pushed) · **Owner approval:** mockup `journal-desktop-captions-mockup` approved 2026-11-09 03:06 CST.

- [x] Captions recovered for all 106 clips (`c5cc7ecf`): narration scripts from `journal-movies-batches/batch-*/NOTES.md` (+ Old Faithful from pilot NOTE-v4.md). `public/videos/captions/<id>.vtt` (106) + `public/videos/journal-transcripts.json` (v1, 106 entries, 430 cues). VTT↔JSON agreement checked: 0 mismatches. No narration text invented. Coverage report: `~/workspace/journal-captions-coverage.md`.
- [x] Desktop two-column layout + captions/transcript UI (`3688a134`): entries ≥681px two-column (art left, title/story/source right rail); mobile stacked. New `src/components/journal-transcripts.ts` (memoized lazy loader, `activeCue`, `captionUrl`). Player: `crossOrigin="anonymous"` + `<track kind="captions">`, CC toggle, Story-text transcript panel (live highlight, tap-to-seek + play), full-width progress row on all widths. Coverage-honest gating: entries absent from the JSON get no CC/Story-text button. Mobile progress bar now 216.5px (was 27px — Part 1 out-of-scope item, now done).
- [x] E2E + gates (`12dce717`, 9 files: 6 captions specs, helpers, 2 fixes-spec updates). Gates (buildId `3688a134`): `npx tsc --noEmit` clean · `npm test` scripts 1154 pass / 0 fail / 11 skip, src 2302 pass / 0 fail / 0 skip · `node scripts/lint-cards.mjs` GATE PASSED · `npm run build:pages` green. E2E (sequential, flock lock, chromium-1243, route-intercepted real Old Faithful clip): captions specs 8/8 green; regression 21 tests 19 pass / 2 fail on first run (both failures were the old tab-order tests — the new CC/Story-text buttons change Tab order, an intended consequence; specs updated to assert the new 5-stop order and re-run green per file). Recordings (video-only): `~/workspace/journal-player-captions-play/captions-desktop.webm` (29.0 s) + `captions-mobile.webm` (20.1 s); frame-difference checked, real motion. Logs: `~/workspace/gjm-captions-{gates,build,e2e,e2e2,e2e3,e2e4,e2e5}.log`.
- [ ] OPEN JUDGMENT CALL (not resolved by the build): the mockup's text says "all controls in a right rail", but the build puts the player + all controls in the art column (measured: controls row x=65–722 inside art column x=65–722; right rail holds 0 buttons). Needs the owner's read against the mockup.
- [ ] Out of scope, NOT done: loop/end-card issue (loop makes onEnded/Play-again unreachable). The 106 clips' narration/audio/visuals are NOT verified by this work. No merge, no PR opened. Panel review follows (not part of this task).

## feat/journal-player — Part 3: 5 Historian-blocked facts corrected (text + audio)

**Branch:** `feat/journal-player` · **Head:** `a7191e3e` (text fix, pushed) · **Audio:** meridian-media `fix/journal-facts-5` @ `70b2e95` (separate repo, NOT merged, NOT on the live Pages site — the live site still serves the old clips).

- [x] Text fix (`a7191e3e`): cue 2 only, in `public/videos/captions/<id>.vtt` + `public/videos/journal-transcripts.json` (VTT↔JSON 0 mismatches, 20 cues):
  - alamo: "An old mission, from 1718." 2.23–4.53 (was "from 1836", 2.23–4.13)
  - cadillac: "In winter, it catches the first sunrise!" 2.61–4.61 (was "It catches the first sunrise in the country!", 2.61–4.60)
  - joslyn: "Joslyn's museum stands right in Omaha." 2.86–5.49 (was "...stands north of Omaha.", 2.86–5.59)
  - niagara: "They drop where New York meets Canada!" 2.86–5.06 (was "They drop over a cliff in New York.", 2.86–4.52)
  - homestead: "One of the first claims, under the 1862 law." 2.89–5.64 (was "One of the first claims, back in 1862.", 2.89–5.10)
  Manifest untouched. Source scripts in `journal-movies-batches` batch-04/07/08/09 NOTES.md corrected with fix notes (unversioned working files, not in this repo).
- [x] Verification (this commit): gates — `npx tsc --noEmit` clean · `npm test` scripts 1154 pass / 0 fail / 11 skip, src 2302 pass / 0 fail / 0 skip · `node scripts/lint-cards.mjs` GATE PASSED · `npm run build:pages` green, buildId `a7191e3e` · worker suite 145/145 (bonus, not in the assigned gate set). E2E (sequential, flock lock, chromium-1243, VITE_KOFI_URL set at build + test): new facts specs 6/6 desktop + 2/2 mobile — each entry plays with its corrected cue-2 line as the active caption inside its window, the same line highlights in the transcript panel, and the 5 old wordings appear nowhere on the page; source check 5/5 VTT + JSON corrected. Regression: existing journal-player + captions specs 31/31. Media: the fixed mp4s were fulfilled locally from the `fix/journal-facts-5` branch files (`git show origin/fix/journal-facts-5:journal/<id>.mp4`, media clone's branch untouched); the video src stays the real meridian-media URL — VM Chromium cannot reach github.io, and the live Pages site still serves the OLD clips, so local fulfillment is the only way to test the fix. Recording (video-only, Playwright video has no audio): `~/workspace/journal-player-facts-play/facts-desktop.webm` (94.6 s, 800x500) — one continuous take, all 5 corrected entries playing; frames spot-checked by eye, each corrected caption legible on-video (alamo ~0:15, cadillac ~0:34, joslyn ~0:53, niagara ~1:12, homestead ~1:29.5). New specs: `tests/e2e/journal-player.facts.{desktop,mobile,record.desktop}.spec.ts` + `journal-player.facts.data.ts`; helper `stubJournalMediaFixedClips` in `journal-player.helpers.ts`. Logs: `~/workspace/journal-facts-{gates,unittest,worker,tsc2,build,e2e-desktop,e2e-mobile,e2e-record,e2e-regress}.log`. No merge, no PR opened.
- [ ] Out of scope, NOT done: the other 101 clips' narration/audio/visuals are NOT verified by this work; the media branch `fix/journal-facts-5` still needs merging/deploying before the live site serves the corrected audio.

---

## Merged main record — fix/337-guess-counter (PR #340, main @ 5e6af2f9)

Preserved from main during the rebase onto 5e6af2f9: the #340
branch-status record that main carried at the merge. It is not this
branch's work; it is kept here so the rebase does not silently drop it.

### fix/337-guess-counter record (verbatim from main @ 5e6af2f9)

# BRANCH_STATUS — fix/337-guess-counter

- **Branch:** `fix/337-guess-counter`
- **Base:** `main` @ `775d8b4` (#329 merged) · synced with `main` @ `9e49da3` on 2026-11-08 (merge commit; see Sync below)

## Task capsule

TASK / requested outcome: Fix issue #337 — the GeoDetective header
counter overstates by one once a case is finished: a case lost on
its 6th guess read "Guess 7 of 6" (owner screenshot, 2026-11-03),
a 1-guess win read "Guess 2 of 5". Finished case: show the guesses
actually made. Playing state unchanged. Builder silo: build, open
the PR, stop. NO MERGE without the owner's per-PR word; Silo QA and
the panel follow as separate silos.

Tier and rationale: Tier 1 — Solo TDD. One bug, one expression, a
clear repro (the owner's screenshot + the seeded finished cases
below).

Done condition / evidence: a new E2E spec seeds finished cases and
asserts the truthful header — it fails on the unmodified build with
the exact pre-fix strings, and passes after the fix; the shipped
playing-state pins in geodetective.spec.ts stay green; all gates
green (tsc, npm test, lint-cards, build:pages).

Files in scope: `src/game/loop/LoopScreen.tsx` (the counter
expression on the LoopGame header line only),
`tests/e2e/guess-counter.desktop.spec.ts` (new), this file.
Protected / untouched: LoopScreen's deal paths and the "Case #N"
header block (owned by the parallel #336 run), every other surface.
Redundancy: grep-verified — the header counter at this line is the
only surface that renders "Guess N of {cap}" from
`guesses.length + 1`; the reveal's "Solved in X of Y guesses."
already counts actual guesses and is untouched.

Assumptions: the rendered cap for a resumed case comes from the
puzzle's deal snapshot (`dealStartClues` / `dealMaxGuesses` →
`persistedDealConfig`); the spec's seeds stamp those fields so the
asserted caps (6 for the loss, 5 for the win) are the caps the
header actually renders — confirmed by the red run's page snapshots.

## Status

- [x] Fresh clone at `~/workspace/meridian-counter-fix`, branch cut
      at `775d8b4`
- [x] RED: new spec on the unmodified build — 2 failed, both on the
      header assertion. Page snapshots in the Playwright error
      contexts show the exact pre-fix headers: `- status: Guess 7
      of 6` (lost seed) and `- status: Guess 2 of 5` (won seed).
      Both seeds validated cleanly: each case restored as its
      reveal ("Out of guesses" / "🎯 You found it!") before the
      header assertion failed
- [x] FIX: one line — `finished ? puzzle.guesses.length :
      puzzle.guesses.length + 1` (the `finished` value already in
      scope on LoopGame; the neighbouring "— N left" suffix was
      already gated on it)
- [x] GREEN + gates on the tip: `npx tsc --noEmit` exit 0 ·
      `npm test` exit 0 (scripts 943 pass / 11 skip / 0 fail;
      src 2016/2016) · `node scripts/lint-cards.mjs` GATE PASSED ·
      `npm run build:pages` exit 0 · E2E under
      `flock ~/workspace/.e2e.lock`, `--workers=1`, against the
      Pages build: **19 passed / 1 failed of 20** — new spec 2/2,
      `geodetective.spec.ts` 17/18. Every counter pin stays green
      (playing state: "Guess 2 of 5" after one guess, "Guess 1 of
      5" on a fresh deal; the win-path snapshot shows the finished
      2-guess win header reading "Guess 2 of 5" — post-fix truth;
      pre-fix it read "Guess 3 of 5"), so the playing state is
      untouched. The 1 failure is NOT the counter — see next item
- [x] Pre-existing failure, proven on unmodified main: the
      geodetective win-path test (spec:199) fails at its share-text
      assertion (spec:256) — expected
      `https://meridian.knowledgetest.workers.dev/`, received the
      Pages URL `https://veeresh-bikkaneti.github.io/Meridian/`.
      Cause: the share origin follows the build's baked base
      (`shareOrigin` in `src/lib/og/share-meta.ts`); the harness
      serves the Pages build (base `/Meridian/`), while the pin
      expects the Workers origin (PR #128). Proven pre-existing:
      the identical test on unmodified main `775d8b4` (worktree,
      same Pages build recipe) fails with a byte-identical
      received share string. (One main run also flaked earlier on
      a sheet/reveal heading strict-mode race — transient timing,
      unrelated.) Out of scope for #337; flagged for the owner as
      a separate test-pin/build mismatch. Correction note: the
      first status commit claimed "21/21" — that was a misread of
      a piped E2E summary (the pipe masked Playwright's exit
      code); the true counts are as stated here
- [x] Redundancy grep on the tip: line 1134 is the only
      "Guess N of {cap}" render in `src/`; the only other
      cap-denominated surface, the reveal's "Solved in X of Y
      guesses." (line 1633), already counts actual guesses
- [x] PR opened against main — #340, still NO MERGE (owner's
      word only). The "now ticked" line in the PR body was false
      through `16daa5ad` (unchecked at `528df01` and `8e3ccda` too).

## Sync with main (2026-11-08, Rock — not a re-approval)

- Merged `origin/main` @ `9e49da3e` into this branch normally (no
  rebase, no force). The only conflict was this file (main carried
  another branch's status); resolved by keeping this PR's record.
  `LoopScreen.tsx` auto-merged; the fix line is now at line 1441
  (was 1134 at the original tip — main grew the file); it is still
  the only "Guess N of {cap}" render in `src/`.
- The panel's votes were on `8e3ccda`; this merge creates a new tip,
  so the panel must refresh on it. No merge without the owner's word.

- Gates on the merge tip `53a59b5` (2026-11-08, logs on the
  builder VM at /workspace/rock-pr340-logs): `npm ci` 0 · `tsc
  --noEmit` 0 · `typecheck:worker` 0 · `build` 0 · `npm test` 0
  (scripts 1023 pass / 9 skip / 0 fail; src 2266/2266) ·
  `test:worker` 145/145 · `lint-cards` GATE PASSED · `build:pages`
  0 · `lint:content` GATE PASSED · `check:flags` 0.
- E2E (`flock ~/workspace/.e2e.lock`, `--workers=1 --retries=0`,
  built Pages artifact). Browser: Playwright's bundled Chromium
  v1243 is NOT installed on this VM (it needs a download, not
  approved); ran with the config's documented override
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome` (Chrome
  156). `guess-counter.desktop.spec.ts` 2/2 pass;
  `geodetective.spec.ts` 17/18 — spec:199 (win path) fails at
  line 238: strict-mode violation, `heading "Ankara, Türkiye"`
  matches both the guess sheet's h2 and the reveal's h2.
  Pre-existing, not this PR: the identical test on unmodified main
  `9e49da3` fails 3/3 with the same error (`--repeat-each=3`); this
  tip also 3/3. This masks the older share-origin failure at
  spec:256 recorded above (not reached).
- GitHub's e2e job runs a fixed list of 6 specs that includes
  neither `guess-counter.desktop.spec.ts` nor
  `geodetective.spec.ts`, so CI green does not exercise this fix.

## P-Stack swarm on `16daa5ad` (2026-11-08 — not a 12-seat panel)

Owner ordered `/pstack:swarm` because the handbook persona pack
and `~/workspace/custom-skills/local-meridian-review-pipeline/SKILL.md`
are not on this machine. Role titles were not improvised as those
12 seats. Resolver `check-models-config.py` is not installed, so
each arm inherited the session model. The work model is unknown,
so this review may be same-model. Not a merge approval.

| Slice | SHA checked | Verdict |
|---|---|---|
| scope-and-regression | `16daa5ad` | PASS — 3 files; one counter line; merge-base `9e49da3` |
| counter-correctness | `16daa5ad` | PASS (SHA recorded; case table was thin — parent is re-checking the comment commit) |
| e2e-spec | `16daa5ad` | PASS |
| records-honesty | `16daa5ad` | ISSUES |

Kept from records-honesty (parent dropped two BLOCKs that treated
"not re-run in this session" as proof the builder VM log was false;
GitHub `build (22.x)` on `16daa5ad` is success and includes
`npm run build` + `npm test`):

- The PR body said a JSX why-comment was added. It was not in
  `16daa5ad`. This commit adds it above the counter. The expression
  is unchanged. It now sits under that comment (line moves by the
  comment only).
- The PR-opened checkbox was unticked. It is ticked above. PR #340
  is open. Still no merge.
- GitHub reviews API on #340 was empty. The "9 APPROVE / 3
  APPROVE-WITH-NITS on `8e3ccda`" sentence is PR-body prose, not a
  review object, and it does not cover this tip.

Independent re-run beside the builder log, not a replacement of it:
`tsc` 0, `test:worker` 145/145, `typecheck:worker` 0, lint-cards
GATE PASSED, lint-content GATE PASSED, `build:pages` 0,
`guess-counter.desktop.spec.ts` 2/2. Browser: Chrome for Testing
156.0.8078.4 (headless shell). `/usr/bin/google-chrome` was absent.
`npm test`: scripts 1021 pass / 11 skip / 0 fail, src 2266/2266.
The two extra skips versus 1023/9 are the SSR pins; `npm run build`
was not re-run here. `geodetective.spec.ts:199` was not re-run.
No Cloudflare Workers build result for `16daa5ad`.

## Sync with main (2026-11-08, verification-gate crew — not a re-approval)

- Merged `origin/main` @ `63d82869` (#372) into this branch (no
  rebase, no force; pushed by GitHub API replay — the created tree
  `e6ce631f` matched the local merge tree exactly). Merge commit
  `78b258e9`, parents `835ad2ef` + `63d82869`. The only conflict was
  this file; resolved by keeping this PR's record, per the standing
  per-branch convention. Branch diff vs main is now exactly 3 files:
  this file, `src/game/loop/LoopScreen.tsx`, and
  `tests/e2e/guess-counter.desktop.spec.ts` — the counter fix is
  unchanged (the expression sits at LoopScreen.tsx:1444 on this
  tip). GitHub reports the PR mergeable again.
- Gates on the merge tip `78b258e9` (2026-11-08, logs at
  `~/workspace/meridian-pr340-e2e/logs-gate/t340/` on this VM):
  `tsc --noEmit` 0 · `npm test` 0 (scripts 1021 pass / 11 skip /
  0 fail of 1032; src 2268/2268) · `test:worker` 145/145 ·
  `typecheck:worker` 0 · `lint-cards` GATE PASSED · `build:pages` 0.
- E2E (`flock ~/workspace/.e2e.lock`, `--workers=1`, built Pages
  artifact; browser = Playwright's bundled Chromium 1243 via the
  config's documented `PLAYWRIGHT_CHROMIUM_EXECUTABLE` override —
  it IS installed on this VM): `guess-counter.desktop.spec.ts`
  **2/2 pass**. The 6 leftover failures from the original full-suite
  run were baseline-matched on pristine main `63d82869` first: ALL
  SIX are pre-existing, zero are regressions from this PR — five
  fail signature-identically on unmodified main
  (tutorial.spec.ts:125/166/174 strict-mode 'Take the tour' ×2;
  crash-watchdog.spec.ts:164 lastMilestone; offline-content
  .spec.ts:203 heading timeout), and offline-content.spec.ts:181 is
  a proven flake on both trees (storyteller-CSS preload console
  error; trace-settled as the test's own offline choreography).
  On this tip the same six fail with identical signatures
  (`logs-gate/t340/e2e-six.log`), plus the pre-existing
  telemetry-spill teardown error also present on main. Fixes for
  the four clusters were built under a signed Tier 2 council
  manifest on their OWN branches off main (this PR stays purely
  the counter fix): `fix/e2e-tutorial-tour-names` @ `acbd506d`,
  `fix/e2e-watchdog-milestone-assertion` @ `ed13b47f`,
  `fix/e2e-offline-loop-scenario` @ `ff0d2628`,
  `fix/e2e-offline-preload-assertion` @ `8cbe1b99` — each gated
  green on its own scope; no PRs opened for them.
- GitHub CI on `78b258e9`: `build (22.x)` SUCCESS · `e2e` (the
  fixed 6-spec job — still neither guess-counter nor geodetective)
  SUCCESS · GitGuardian SUCCESS. No Workers Builds result exists
  for this or any branch: branch builds are off account-wide
  (platform tag mismatch, fixed during PR #351 by disabling
  non-production branch builds); production Workers state is
  untouched by this work.
- This tip supersedes every earlier tip the panel or swarm looked
  at; the 12-seat panel + Reality Checker refresh on this tip is
  recorded in `~/workspace/meridian-pr340-e2e/CREW-REPORT-2.md`.
  Still NO MERGE without the owner's per-PR word.


---


---

## Merged main record — feat/u11-clue-renders (PR #370, main @ f2bbf1a2)

# BRANCH_STATUS — feat/u11-clue-renders

- **Branch:** `feat/u11-clue-renders` · **Base:** `main` @ `9e49da3` (PR #365 merged + live)
- **Design of record:** clue-read diagnosis (evidence folder
  `clue-read-diagnosis/DIAGNOSIS.md`) + owner approval (Veeresh,
  2026-11-08 ~03:02 CST, in the `meridian` side chat): "Approve the
  full render — all 386 core cases."

## Task capsule

TASK / requested outcome: Phase A rendered clue audio for the
Capitals pack only, so 386 of the 387 core-deck cases had empty clue
entries in the audio manifest and their clues were never read aloud
(handbook ch.10 gate FG-3). Render all five clue reads for every core
case in Watson's cast voice, extend the manifest gate so an empty
core clue entry fails the build, and prove by ear-level E2E that a
core case's clues fetch and play.

OWNER APPROVAL (Veeresh, 2026-11-08): the full render of all 386
core cases, on the diagnosis that the playback machinery already
worked and only the renders were missing.

## Done

- [x] Pilot (cases 0–19): 105 rendered, 19% flagged, worst case
  479,225 B of the 500,000 B budget, ≈16.9 s/case at concurrency 4.
- [x] Full batch: 387/387 core cases carry all five clue reads
  (1,935 reads; case 137's five pre-existed). Core clue audio totals
  141.9 MB; the detective audio tree is 239 MB. Audio loads lazily
  per case — the entry JS chunk is unchanged (457,847 B).
- [x] Budget cures: five cases (28, 54, 87, 144, 289) busted the
  500,000 B budget on one very slow take each; re-encoding the
  affected clips at 32 kbit/s brought every case back under budget
  with pitch and duration measurements unchanged. Zero cases held.
- [x] Flagged disposition (explicit, not silent): 314 of 1,935 reads
  ship flagged by the pipeline's pitch/pace ladders — 103 outside
  Watson's family band (78–127 Hz), 6 under the 100 wpm pace floor,
  the rest inside-band pitch flags. A cure pass re-rendered the 103
  outside-band lines fresh: 0 landed inside the band, so the shipped
  takes stand. The Capitals pack ships the same flagged state
  (85 of 550) — flagged is the pipeline's designed "accepted with a
  note" state, and every flagged line is named in the PR body.
- [x] Manifest gate extended: `checkCoreCoverage` fails the build
  when a core case is neither claimed with all five reads nor on
  the explicit hold list (`coverage.coreHolds`, currently empty).
  Sabotage controls proven: an emptied entry (case 42), an
  over-budget case (case 10), and a dropped case (case 77) each
  fail the gate by name. Real tree: gate clean, 4,462 entries
  verified.
- [x] Handbook ch.10: FG-3 marked CLOSED by U11; the flip checklist's
  core-case item ticked with the closing E2E named.
- [x] Gates on the finished tree: typecheck clean · unit suites
  1,028 pass / 0 fail (scripts) + 2,266 / 2,266 (src) · worker
  145 / 145 · lint-cards GATE PASSED · build:pages green.

## Pending

- [x] E2E `tests/e2e/detective-core-audio.spec.ts` — **RUN AND
  PASSED 2026-11-09** (close-out below): all 3 tests by name —
  (a) all five clue clips fetched (HTTP 200) and play, in order ·
  (b) tap-Watson repeats the clue itself, not the ack or decode ·
  (c) solving at guess 2 flushes the queue.
- [x] Silo QA PASS @ `93a8fe52` (isolated worktree: manifest gate
  clean, typecheck, lint-cards, all suites green, silo's own
  sabotage control bites). **Key VOIDED by the close-out tip
  `fb46cf55` — Silo re-key is the next step.**
- [ ] Silo re-key, 13-seat panel vote, DevEx, benchmark; merge on
  READY under ship-when-ready; live check on both hosts.
- **LANE STOOD DOWN 2026-11-08** (owner's sequential pipeline
  law): queue position 3, behind the Watson-station cure and
  PR #364. (The lane later resumed and closed out in this file —
  see the Close-out section below; the old `RESUME-STATE.md`
  worktree file was retired 2026-11-09, its record lives in
  this file and the PR #370 body.)

## Close-out (2026-11-09, Agent ARCHIVE)

- **Merge-up done:** `origin/main` @ `5e6af2f9` merged in (merge
  commit `02798fd3`) — the two main commits past the old base
  `9e49da3` are `63d82869` (#372 Watson-station cure) and
  `5e6af2f9` (#340 guess counter). Sole conflict:
  `BRANCH_STATUS.md`, resolved keeping BOTH records (this U11
  capsule and main's #340 capsule both stand below). Handbook
  ch.10 auto-merged as a faithful union: main's Watson-station
  section came in, and this branch's FG-3 CLOSED record replaced
  main's open FG-3 text.
- **Playwright project added** (commit `6d4ad8e4`):
  `detective-core-audio` registered in `playwright.config.ts`
  immediately after `detective-berth` — the registration gap was
  why the spec never ran locally or in CI.
- **Fast gates on the merged + config tree, all PASS:**
  typecheck clean · `npm test` — scripts 1,028 pass / 0 fail,
  src 2,268 / 2,268 · worker 145 / 145 · lint-cards GATE PASSED ·
  audio manifest gate clean (4,462 entries verified) ·
  build:pages green (buildId `6d4ad8e4`).
- **E2E run 1** (log
  `~/workspace/meridian-detective-evidence/u11/e2e-core-audio.log`):
  2 passed, test (b) FAILED — a spec defect, not a product
  defect: test (b) scoped its `detective-watson-replay` locator
  inside the `loop-map` subtree, but the button renders at the
  station (the failure snapshot shows "Ask Watson to repeat this
  clue" below the map region); every other spec using this
  button scopes it page-wide. Fixed in commit `fb46cf55`
  (locator scope only — same button, same count assertion, same
  click; no assertion loosened).
- **E2E run 2** (log
  `~/workspace/meridian-detective-evidence/u11/e2e-core-audio-run2.log`):
  **3 passed (2.9 m), exit 0** — (a) core case: all five clue
  clips are fetched (HTTP 200) and play, in order · (b) core
  case: tap-Watson repeats the clue itself, not the ack or
  decode (replay started with `case-5/clue-1.mp3`) · (c) core
  case: solving at guess 2 flushes the queue — no clue audio
  fires after the solve.
- **Tip after close-out: `fb46cf55`.** Remaining: Silo re-key →
  panel → DevEx → benchmark → merge on the owner's word →
  live verification on both hosts.


---


---

## Merged main record — fix/credits-wait-for-content (PR #376, main @ f2bbf1a2)

## Capsule — fix/credits-wait-for-content (2026-11-09)

- **Branch:** `fix/credits-wait-for-content` · **Base:** `origin/main` @ `5e6af2f9`
- **Owner's word:** "Land the credits cure now as a tiny PR" (2026-11-09 14:36 CST).
- **Tier:** Tier 0/1 — one E2E spec file, no product code.
- **TASK:** Cure the no-wait race in `tests/e2e/credits.desktop.spec.ts`: `expectCreditsContent` read the body text once, immediately after the click/navigation, and asserted the credits strings — the credits route had not always rendered yet, so the test failed intermittently.
- **Evidence it is a spec race, not a product bug** (identical failure on unmodified main / other branches): main run `42511936129` (2026-11-08) · PR #370 tip run `42662167590` · `feat/journal-movies` run `42692238457` (2026-11-09) — while main passes other runs.
- **Cure:** `expectCreditsContent` now `expect.poll`s the body text (repo idiom, cf. band-film specs) until it carries the credits strings, then runs the original assertions unchanged — every assertion string kept at the same strength; only the waiting changed.
- **Files:** `tests/e2e/credits.desktop.spec.ts` + this capsule. Nothing else.
- **Proof:** build:pages green · credits spec 5 consecutive passes by name · full CI six-file set green once · tsc clean · lint-cards GATE PASSED (numbers in the PR body).
- **Merge:** NO MERGE without the owner's per-PR word. Once merged, PR #370 merges up and its red e2e check clears.

## Notes
- CSP: was NOT changed by this branch itself (repo CSP had no meridian-media in `media-src`/`connect-src`) — SUPERSEDED by the merge below: the player CSP fix (`da43a03f` + `8d4475e9`) adds the host to both directives, so this branch now carries it too. GitHub Pages ignores `_headers`, so live Pages is unaffected by the file; the worker-served CSP is what matters.
- No PR opened; merging stays the owner's decision.
- Head: this commit (docs-only over share-fix code head `0cf449d7`; all gates / E2E union ran on `0cf449d7`; verified this session: `git rev-parse HEAD`, worktree clean, remote tip matches; B5/B6 fix pass 2026-11-09, share-URL fix pass 2026-11-09).
- Final-pass verdict: unit gates + `build:pages` green on head `0cf449d7`; E2E union **88 passed / 0 failed** — the former share-URL failure (Step 3) is cured by the owner's 2026-11-09 ruling (see Share-URL fix). The three blocking seats re-vote with the green union on the record. One open item remains outside the union: endgame-share E2E (see Pending).

---

## CSP fix — journal media host (PR #388 follow-up, 2026-11-09, owner-ordered)

- **Problem:** the journal clips live on meridian-media Pages
  (`https://veeresh-bikkaneti.github.io/meridian-media/journal/`), but CSP
  had no `veeresh-bikkaneti.github.io` in `media-src` or `connect-src` —
  in production the player would show "This story's movie isn't ready
  yet." and prefetch would silently warm nothing. Proven by the negative
  controls below (not assumed).
- **Fix:** added the host to BOTH directives in
  `src/lib/security-headers.ts` AND `public/_headers` (drift test pins
  them identical), plus the matching lines in `docs/security-headers.md`
  (quotes the CSP verbatim) and a rationale bullet in the .ts CSP notes.
- **Tests:** new unit test in `src/lib/security-headers.test.ts` asserts
  both directives contain the host (src 2302 → 2303). New E2E
  `tests/e2e/journal-player.csp.desktop.spec.ts` serves the app shell
  with the real production CSP read from `public/_headers` and asserts
  the Old Faithful movie's `currentTime` advances (0.54 s in the run).
  Negative controls, both fail as designed: (1) old `_headers` restored
  → spec fails at the CSP-contains-host assertion; (2) old CSP served
  with the file fixed → the player shows "This story's movie isn't
  ready yet.", no `<video>` mounts, spec fails at `openEntry`.
- **Also:** `tests/e2e/journal-player.facts.data.ts` comment fixed to the
  30-minute window / mod 106 (wording copied from the prefetch branch so
  the merge stays clean). Pinned times untouched — they are the 2h-based
  instants this branch's rotation uses; B8's times arrive with the
  prefetch merge.
- **Gates (this commit):** tsc 0; `npm test` scripts 1161/11 skipped/0,
  src 2303/0; lint-cards GATE PASSED; `build:pages` ok; `test:worker`
  145/0. E2E targeted player set 39/39 (38 + new CSP spec).
  Logs: `~/workspace/journal-player-csp/`.
- **Merge:** NO MERGE without the owner's per-PR word. This commit moves
  the #388 tip; the old validator YES on `af7ec7c1` does not transfer.
  Next: merge this tip into `feat/journal-prefetch` (#389) per the
  owner's order.
- **Follow-up (same evening):** the first merge attempt into prefetch
  caught a spec bug — the CSP spec asserted the player's 3-entry set,
  but prefetch B8 shows 1 entry per 30-minute window (`wagon-train` at
  the pinned instant), so the spec failed there on the rotation
  assertion, not on CSP. Fixed by making the spec rotation-agnostic: it
  plays whichever entry the pinned instant shows (`ids[0]`). Re-run on
  the player branch: CSP + facts specs 9/9, movie `currentTime` 0.51 s
  (entry old-faithful). This lands as a second commit on this branch
  before the prefetch merge is redone.
- **Repair (2026-11-10, owner-ordered):** Lotus rebased this branch onto main `10e8121d` overnight (`6dcdcfc7`), orphaning the first merge (`60c16460`) and dropping the CSP fix — the rebased tip had no `github.io` in either CSP directive and #389 went CONFLICTING vs base. This merge re-merges the player tip `8d4475e9`. Resolution, all 21 conflicts: kept the prefetch (B8/B7) version of every player file whose two sides diverged — `game-app.tsx` (B7 boot-Home + prefetch effect; player's `readLoopOpen` boot-restore would regress B7), `journal-movies.ts` (baseUrl re-pin restored by prefetch follow-up `13844336`), the spinner (`journal-player.tsx`, `home-v5.css`, unit tests), and all rotation-sensitive specs (B8 1-entry/30-min assertions, incl. `facts.data.ts` B8 times + the fixed 30-min comment); took the player's CSP fix (security-headers files + docs, merged clean), the CSP spec, and this section. The player's 3-per-set spec wording and 2-hour language were NOT taken — they describe the old rotation.
