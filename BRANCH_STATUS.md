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

# BRANCH_STATUS — feat/pivot-ack-renders (Agent VOICE)

- **Branch:** `feat/pivot-ack-renders` · **Base:** `main` @ `5e6af2f9` (#340)
- **What landed (2026-11-09):** Holmes's ack pool grows 4 → 10. Six new
  fixed lines added to `scripts/detective/render-plan.mjs` (ack-5…ack-10,
  frozen text, receipt-only register) and rendered through the pipeline
  (`render-audio.mjs --fixed`) in Holmes's cast voice `avocado_v2:atlas`
  (voice field verified per render by the renderer — a mismatch aborts):
  ack-5 "Heard, Watson." · ack-6 "I'll take that, Watson." · ack-7 "Filed,
  Watson." · ack-8 "Received, Watson." · ack-9 "Set it down, Watson." ·
  ack-10 "One moment, Watson."
- **Gates:** manifest gate clean (2,538 entries verified) · scripts suite
  1,032 tests, 0 fail (render-plan count expectations updated 4 → 10 acks,
  fixed-lines total 20 → 26).
- **Flags (pipeline's own, kept honestly):** ack-7 flagged — final take
  111.1 Hz, below the 110–160 family band's floor edge after the pitch
  ladder (speed 112); ack-8 flagged on pace only (85 wpm vs the 90 floor,
  pitch in target at 123.7 Hz). ack-5/6/9/10 ok. Human ear check owed on
  ack-7/ack-8 at panel time.
- **Untouched on purpose:** ack-1…4, suspicion, and every other fixed
  line are byte-identical to main (the render run's collateral re-renders
  were restored); `detective-state.ts` still rotates 4 — the random
  picker is Agent HERALD's piece, stacked on this branch.
- **Pending:** GATE opens the PR and runs integration + panel. No PR
  opened by this branch's builder.

## GROK-REWORK — independent verification + ear check (2026-11-09)

- **Re-verified at tip `de612a41`:** tip + clean tree confirmed; all ten
  ack clips present and playable (ffprobe); manifest gate clean (2,538
  entries); manifest diff vs main = only the six new entries (+75/−0
  lines); all 20 pre-existing fixed clips md5-identical to main; every
  ack manifest entry's text = the frozen text, voice `avocado_v2:atlas`,
  measuredHz = the record's pitch table.
- **Voice tool confirmed on this machine:** a throwaway probe render via
  `/opt/hatch/bin/tts speak --voice avocado_v2:atlas` returned the voice
  field `"avocado_v2:atlas"` — the exact cast voice is reachable here.
- **Ear check (measurement-based — no human hearing claimed):** two
  independent pitch trackers (YIN + HPS) reproduce the pipeline's Hz
  within ~5 Hz on all ten clips; pace = words/total-duration (reproduces
  manifest wpm exactly); plus ebur128 loudness, spectral centroid, and
  terminal-contour measures per clip.
- **ack-7 "Filed, Watson." — KEEP.** YIN 111.6 Hz ≈ pipeline 111.1 Hz:
  ~2 semitones below the set median but bracketed by shipped ack-3
  (114.0 Hz), pace identical to its 2-word peers (89.3 wpm), loudness
  mid-set, narrowest pitch spread of the ten — the same man at the
  family's low end, not a different, gruffer Holmes. (The manifest note
  cites the first take's 107.8 Hz; the shipped take measures 111.1.)
- **ack-8 "Received, Watson." — KEEP.** 84.7 wpm vs 89–91 for the other
  2-word lines (+72–96 ms on a ~1.35 s clip, ≈5–7% — at the edge of
  tempo perceptibility); pitch in target (YIN 128.4 Hz), widest pitch
  movement and bright timbre — deliberate, not dragging.
- **Set picture:** ack-4 stays the warm ceiling (highest pitch,
  brightest, flattest ending); no clip exceeds it, so no draw can sound
  more encouraging than the shipped reference. Panel observation only:
  ack-3 is the set's quietest (−30.5 LUFS) — pre-existing on main,
  byte-identical, left untouched.
- **No cures:** no clip was convicted, so zero re-renders and zero
  audio/manifest changes; this capsule is the only change in its commit.

## GATE integration cure — ack-pool spec pins (2026-11-09, on feat/pivot-speech @ 891031da)

- **Why:** GATE verification of HERALD's random ack picker (pool
  ack-1…ack-10, no repeat within a case) found 7 E2E failures, all one
  class — older specs pinned the exact file `fixed/ack-1.mp3` (or
  `ack-2.mp3`) the retired rotation always played. Live behaviour was
  correct in every failure: the chain fired in position with a lawful
  pool draw. The specs now assert the pool contract instead of the
  retired rotation; no assertion was weakened or deleted.
- **What changed (specs + shared harness only, no `src/`):**
  `tests/e2e/detective-u10.ts` gains the shared pool matcher
  (`ACK_POOL` = /fixed\/ack-\d+\.mp3/, plus `countAcks` / `ackFiles`)
  and `assertSubsequence` accepts RegExp needles alongside substrings.
  `detective-replay.spec.ts`: every played/network ack pin is now a
  pool count (first pass exactly 1 · after replay exactly 2 · restart
  exactly 1 · chain tail still clue → ack → decode in order); ack-1
  remains only as test (c)'s absence needle (mid-read: no ack at all).
  `detective-watson-walk.spec.ts`: the full-walk order array takes the
  pool matcher in the ack slot (order + count unchanged); the mid-walk
  arrival pin now asserts exactly 2 acks in the case so far, ALL
  DISTINCT — the no-repeat rule, stronger than the old ack-2 pin; the
  sheet test's deferred drain asserts exactly one pool ack.
  `detective-sound.spec.ts` untouched (verified pool-safe).
- **Gates:** `npx tsc --noEmit` clean; the two cured specs + the sound
  spec re-run E2E after this commit (counts in the GATE report).

---

# BRANCH_STATUS — feat/geodetective-end-game
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
