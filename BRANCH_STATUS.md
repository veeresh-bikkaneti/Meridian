# BRANCH_STATUS — feat/verdict-grandpa-video

- **Branch:** `feat/verdict-grandpa-video`
- **Base:** `main` @ `242a7ef` (#291 winner declaration + #294 merged;
  branched after the #291 merge, so no rebase was needed).

## Task capsule

TASK / requested outcome: Wire the animated "Grandpa Was Already
There" clip into the challenge verdict screen (shipped in PR #291) so
it plays at the top of the screen, above the headline, on ALL verdict
classes (win / hold / near-miss / loss). Owner's dispatch, 2026-11-01:
"Ship it — wire the clip into the verdict screen (both win and lose)",
running in parallel with the finger-gun regeneration track; the
regenerated take (v2) landed during the build and is the ship asset.

Interpretations considered and selected reading: "both win and lose"
= every verdict class, since all four render through the one
ChallengeVerdict screen; the clip is placed inside that component.

Tier and rationale: Tier 1 execution of an owner-decided design (the
concept, screen, and placement were all decided before the build:
council Concept #2, owner pick 2026-10-29; verdict screen design
#291). No new design decisions are taken on this branch.

Done condition / evidence: verdict screen shows the clip (video under
full motion, still keyframe under prefers-reduced-motion, poster
before play); aria-live ~650 ms announcement, focus order, and
tap-to-settle choreography untouched; repo gates green (tsc, npm
test, test:worker, lint-cards, build:pages); verdict/challenge E2E
under the flock with sealed logs; production bundle references the
emitted asset; PR opened. NO MERGE — the review pipeline is a
separate stage.

Files and interfaces in scope: `src/components/game-app.tsx`
(ChallengeVerdict render + imports only), new `src/assets/verdict/`
(grandpa-media.ts swap point + compressed .mp4 + poster .webp),
README + docs for the verdict surface, this file. Out of scope
(FORBIDDEN): the mc3 codec, duel dots, verdict copy/classes,
branch protection, any backend/network call.

Asset: source `grandpa-verdict-v2.mp4` (1,712,053 bytes, 1152×768,
finger-gun take v2 — AI-animated from the owner-approved keyframe)
compressed to 960×640, audio stripped, CRF 28 → 329,051 bytes.
Poster/reduced-motion still: the approved keyframe webp resized to
960 wide → 65,336 bytes. Swap point: `src/assets/verdict/grandpa-media.ts`
exports both URLs; game-app.tsx is the only import site — a future
re-cut replaces the .mp4 file only.

Redundancy audit (owner standing rule): the clip adds no control,
button, link, or entry point — it is a decorative picture on a screen
that already exists. No duplicate path to any job. PASS.

## Status

- [x] Branch off current main; coordination ledger heartbeat posted
- [x] Asset compressed (v2, 329,051 bytes) + poster still (65,336 bytes)
- [x] Swap-point module + verdict-screen wiring (video / still / poster)
- [x] Gates (tip `eded1bc` + docs): tsc 0 · npm test 0 (scripts
  850 pass / 11 skipped; src 1879/1879) · test:worker 85/85 ·
  lint-cards GATE PASSED · build:pages 0 — bundle emits
  `grandpa-was-already-there-*.mp4` (329,051 bytes) + poster webp and
  the routes chunk references them. Logs:
  `~/workspace/verdict-grandpa-video-evidence/`
- [x] E2E under flock (10 friend-challenge files, workers=1, bundled
  chromium-1243): **62 passed / 1 failed / 2 skipped** (39.5m). The
  verdict spec is fully green, incl. the reduced-motion WIN test.
  The one failure — mc2-create:131 (240 s click timeout waiting for
  the summary "Challenge a friend — play my route" button) —
  reproduces with an **identical failure signature on unmodified
  main `242a7ef`** in a solo control run (sealed:
  `e2e-maincheck-131.log`; the logs differ in scope/duration/paths —
  the signature and the disposition are what match), so it is a
  pre-existing environment/main-state failure, not a regression of
  this branch; the test never renders the verdict screen. The 2
  skips are designed (the @old-build scripted-manual gate + the
  parked summary-mint fixme from #291).
- [x] Docs: README feature table now describes the verdict cartoon
  and its reduced-motion still
- [x] PR opened (no merge) — PR #295, opened 2026-11-01; the review
  pipeline ran as a separate stage (verdict: NOT READY, 2 BLOCKs)

## Cure round (2026-11-01, after the pipeline verdict on `4d79946`)

Panel: 2 APPROVE · 8 APPROVE-WITH-NITS · 2 BLOCK · DevEx
PASS-WITH-NITS. Cures, one commit each:

- [x] **BLOCK 1 (CLS)** — `aspect-[3/2]` on BOTH media branches
  (video + reduced-motion still): the 3:2 box is reserved before
  the media loads, so the headline and score bar no longer shift
  mid-choreography. Proven by a new E2E test that holds the clip
  and poster at the network and measures the box + headline before
  and after the assets land.
- [x] **BLOCK 2 (WCAG 2.2.2, Level A)** — two stop mechanisms for
  the looping clip: (a) settling the choreography BY GESTURE
  (tap / keydown) pauses the clip and holds its frame — as first
  built in this round the pause also fired on the auto-settle
  timer; cure round 2 (below) split the signal, so the timer
  settles the choreography but never pauses the clip; (b) a ≥44 px
  pause/play toggle overlaid on the clip's corner (aria-label
  "Pause the cartoon" / "Play the cartoon", aria-pressed),
  available from the first frame.
  Autoplay + loop are otherwise as shipped. Proven by a new E2E
  test (settle → paused; toggle → play → pause).
- [x] **Record** — the mc2-create:131 disposition above now reads
  "identical failure signature" (was "byte-identically"; the three
  :131 logs differ in scope/duration/paths).
- [x] **Docs** — `grandpa-media.ts` now carries the full
  asset-derivation recipe: source locations, the ffmpeg command
  shape (960×640, CRF 28, audio stripped, faststart), the poster
  webp resize recipe, "replacement takes must be silent", "a new
  keyframe means replacing the .webp too", and the size/codec
  constraints for a replacement (≤ ~400 KB, H.264 mp4, 3:2).
- [x] **Tidy** — the dead `preload="metadata"` beside `autoPlay`
  is removed.
- [x] **Passenger** — the reduced-motion still branch of the
  verdict media now has its first test guard (new E2E test: IMG
  tag, no toggle, same reserved 3:2 box); before this round it had
  zero test references.

Redundancy audit, cure-round addendum (owner standing rule): the
pause/play toggle is a media control for the clip — the WCAG 2.2.2
stop mechanism the panel required — not a feature entry: it adds
no new path to any game job and duplicates no existing control
(the settle gesture is a choreography snap that now also pauses;
the toggle is the always-available, labelled stop). PASS.

Gates + E2E for the cured tip are sealed in
`~/workspace/verdict-grandpa-video-evidence/cure-295/`: tsc 0 ·
npm test 0 (scripts 850 pass / 11 skipped; src 1879/1879) ·
test:worker 85/85 · lint-cards GATE PASSED · build:pages 0.
Verdict spec: full run 9 passed / 1 designed skip / 3 renderer
crashes in the map aim phase ("Target crashed", verdict not yet
mounted); the 3 crashed tests re-run — the two new cure tests PASS
(CLS 59.9 s; settle/toggle 50.3 s) and the reduced-motion guard
passed in the main run. The third, the pre-existing LOSS test,
kept failing in map-phase waits (2× renderer crash, 1× canvas
never visible) — and fails the same way on the UNMODIFIED
pre-cure tip `4d79946` in a control run (page crashed in the
retry's map reload), so it is the VM environment class, not this
cure; its verdict assertions passed in the cured solo run before
the retry's map reload starved. Mutation proof: with the
settle-pause line cut, the new settle/toggle test fails at the
paused poll (15 s timeout, still playing); restored, it passes.
Friend-challenge set (the other 9 files): the local runner died
mid-run at test 45 of ~65 (no summary, no exit file); the 16
failures on the partial log are 16/16 renderer-crash class per
their error contexts — zero app-logic assertions — and ~20 tests
of the last file never ran locally (full census:
`cure-295/E2E-NOTES.md`). CI on the cured tip `453180a` is the
canonical read: build (22.x) SUCCESS · e2e SUCCESS (full suite,
incl. the LOSS test and the whole friend-challenge set) ·
GitGuardian SUCCESS · Workers Builds FAILURE (non-required,
standing). Next: panel RE-VOTE on the cured tip (separate stage).
NO MERGE without the owner's per-PR word.

## Cure round 2 (2026-11-01, after the panel RE-VOTE on `ad396fa`)

Re-vote: NOT READY — 1 APPROVE · 5 APPROVE-WITH-NITS · 6 BLOCK ·
DevEx PASS-WITH-NITS (record:
`~/workspace/verdict-grandpa-video-evidence/cure-295/REVOTE-295-VERDICT.md`).
Both round-1 BLOCKs were LIFTED by their owners and all six cure
items verified from source. The six BLOCKs stood on ONE wire the
cure added: the settle-pause subscribed to the undifferentiated
`settled` latch, so the ~1.6 s auto-settle timer froze the clip on
every default verdict, and the PR record never stated that
consequence. Cures:

- [x] **Timer excluded from the clip pause (panel option 1).**
  `ChallengeComplete` now keeps a second latch,
  `verdictSettledByGesture`, set only by the root's tap/keydown
  handlers (`settleByGesture`, which also sets `verdictSettled`
  exactly as before). The timer effect still sets `verdictSettled`
  alone. The clip's pause effect in `ChallengeVerdict` subscribes
  to the new `settledByGesture` prop only. Every other settle
  behaviour — CSS snap, inert gates, `data-verdict-settled`, the
  choreography — consumes `verdictSettled` unchanged. The pause
  behaviour that ships: the clip autoplays and loops; a tap or
  keydown settle pauses it; the auto-settle timer does NOT; the
  44×44 corner toggle pauses/plays it at any moment and alone
  satisfies WCAG 2.2.2.
- [x] **Pinning E2E.** A new verdict-spec test: with NO player
  gesture, the auto-settle timer fires (`data-verdict-settled`
  flips on its own) and the clip is still playing afterwards
  (unpaused, `currentTime` advancing); the toggle then stops it.
  The round-1 gesture test stands (a tap settle still pauses).
  Mutation proof: re-wiring the pause to the undifferentiated
  latch makes the new test fail (clip paused after the timer);
  restored, it passes.
- [x] **Passengers.** A keyboard E2E for the toggle (focus, then
  Enter pauses / Space plays — the stopPropagation path is now
  driven, not just source-verified); the toggle's `clip.play()`
  gained a `.catch(() => {})` guard so a rejected play() can never
  surface as an unhandled rejection.
- [x] **Record.** The PR body's main sections were brought true
  for this tip (the toggle is a control and is focusable; the
  removed preload's performance claim is gone; the redundancy
  audit now states the one media control honestly), an explicit
  behaviour note for the pause behaviour that ships was added,
  and the test-evidence section names this tip as the revision
  under vote.

Gates + E2E for this round are sealed in
`~/workspace/verdict-grandpa-video-evidence/cure2-295/`. Next:
panel RE-VOTE on the new tip (separate stage). NO MERGE without
the owner's per-PR word.
