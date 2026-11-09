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
