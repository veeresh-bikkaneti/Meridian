# Why Learn adoption mock — staging status

**What this is:** a scratch staging of the four corrected-scope adoption
lanes (A stamps, B predict, C visuals, D hinge) composed on the real Why
Learn build, for the owner's eye. **It is not a PR, was never pushed, and
no production branch was touched.** Local branch `mock/why-learn-adoption`
in this worktree only, based on `origin/main` @ `9314c6de`. Working tree
left uncommitted on purpose. Specs live in
`~/workspace/reverse-engineering/2026-11-24-three-sites/specs/`.

## What was staged (3 files edited, all marked "ADOPTION MOCK")

| File | Staging delta |
|---|---|
| `src/subjects/shared/SubjectPicker.tsx` | `wl-adoption-mock` scope class on the picker; `--subject-color` per card from a staging `SUBJECT_COLORS` map (production home: registry record — spec Lane C); Lane A stamp derivation inline (band-complete: every unit of the current band in the seeded progress) rendering a `★ Proved` mark in the title row; Grandpa (`grandpaStaticUrl()`, the existing static asset) + placeholder speech line under the hero. |
| `src/subjects/shared/SubjectCase.tsx` | `--subject-color` on the case main; Lane B hunch step (Math-gated staging: state in-memory, same choices, Skip button) replacing the AnswerCard until answered/skipped; result band gains the `★ Proved it!` stamp + the "YOUR HUNCH — You guessed 6. The answer is 8 — here's why." line; Lane D flap: a dashed "📖 Lift the flap" button covering the Math scene, 380ms rotateX hinge on tap, gone once lifted or when the scene solves. |
| `src/styles.css` | One appended staging block: sticker skin under `.wl-adoption-mock` (3px navy border, radius 24px, hard shadow `0 6px 0`, hover −5px / shadow `0 10px 0` / 150ms), badge + chip tinted by `--subject-color`, `.wl-stamp` (rotated ring badge), `.wl-hunch-label`, `.wl-grandpa`, `.wl-flap` + `wl-flap-lift` keyframes. |

Capture tooling (untracked, staging only): three Playwright specs in
`tests/e2e/` (`why-learn-adoption-capture|verify|retake.desktop.spec.ts`)
using the hermetic recipe (`serveBuiltArtifact`, pinned Chromium, flock,
workers=1). Seeds: age profile band 7-10, read-aloud pref "never",
progress store with **Math (22 ids) + Chemistry (5 ids) fully solved for
band 7-10** — ids read from the subjects' own `items.ts` records — so the
picker stamps are earned by the real derivation, not painted on.

## Capture inventory — 15/15 composed screens + 3 element proofs

In `captures/`: `picker-`, `hunch-`, `result-` × `1280x800, 1920x1080,
768x1024, 390x844, 320x568` (full-page), plus element proofs
`verify-hunch-card-320x568.png`, `verify-result-band-390x844.png`,
`verify-result-band-320x568.png`.

- **Picker:** sticker skin + subject-colour badges/chips + stamps on Math
  and Chemistry only (Physics/GK/Social/Journals unearned, nothing shown)
  + Grandpa row. Vision-verified at all five viewports. On narrow cards
  the stamp wraps under the case-count chip — readable, no clipping.
- **Hunch:** flap down over the scene, clue card, "What's your hunch?"
  card (choices 6/8/10 + Skip). Vision-verified at 390 + 320 (element
  proof at 320); DOM-asserted at 1280/1920/768.
- **Result:** flap lifted, scene in solved phase, result band with stamp
  + hunch named back ("You guessed 6. The answer is 8 — here's why.") +
  derivation + step-by-step + used-in line. Vision-verified at all five
  viewports (element proofs at 390/320).

## Known capture artifacts (not layout defects — proven by element shots)

- Full-page stitching at phone widths misplaces the sticky header /
  footer zone: in `hunch-320x568.png` the detective-host strip stitches
  over the hunch card's top, and in `result-390x844.png` /
  `result-320x568.png` footer text bleeds into the result band's lower
  edge. The element screenshots (`verify-*`) show the true layout is
  clean and complete. `result-1920x1080.png` has the same stitch quirk
  at the very top (sticky header over the case title's first line).
  Phone-width hunch/result were retaken once with animations frozen;
  the scene/hunch/result content is clean in the retakes, the footer
  stitch at 320 persists — it is a Playwright full-page artifact on
  this page, recorded here rather than chased further.
- The scene in result shots is mid/late solved-performance (drawn film
  frames differ per shot) — expected; the film is live.

## Staging approximations vs the specs (honest deltas)

1. Colour token lives in staging maps in the picker/case, not the
   registry record (spec's production home). Values are the spec's.
2. Hunch gate is `subjectId === "math"` + choice-kind, not the spec's
   `predict` field on the answer entry; the hunch prompt line reuses the
   entry prompt (production prompts are the Lane B content bill).
3. The hunch card is rendered inline, not via the AnswerCard `purpose`
   prop the spec mandates (one component per job in production).
4. The flap is inline in SubjectCase, not the shared `SceneFlap`
   component; its label is generic ("Lift the flap / to see it move"),
   not the scene's `labelSetup`; the scene mounts (and its film runs)
   beneath the closed flap — production should mount/reveal per spec.
5. Grandpa sits in a row under the hero at all widths; the spec's
   desktop beside-the-hero placement is a build detail. His line is
   placeholder copy ("Pick a case — I will be right here."), not owner
   copy.
6. Stamp text: picker "★ Proved", case "★ Proved it!" — wording is the
   owner's one-liner in the real lane.

## Verification

- `npx tsc --noEmit` clean on the staging tree; `npm run build:pages`
  green; capture run green with per-viewport DOM assertions (stamps
  present/absent per subject, flap, hunch card, result stamp + hunch
  line) before every screenshot.
- Nothing pushed, no PR opened, `origin/main` and the landmark-canon
  worktree untouched. To discard: delete this worktree.

## Interactable prototype (added 2026-11-24, owner direction 15:32 CST)

The coin case (`math-number:groups:skip-count`, band 7-10) is now
PLAYABLE in staging, and its result band leads with the explanation
as a motion segment. Files: new `src/subjects/shared/adoption-play.tsx`
(`CoinPlayScene` + `ExplanationMotion`), staging wiring in
`SubjectCase.tsx`, one appended CSS block in `src/styles.css`.
Recording: `tests/e2e/why-learn-adoption-interactable.desktop.spec.ts`
(same hermetic recipe + seeds as the walkthrough).

- **Interaction model:** 40 loose coins in a spill. Drag with the
  pointer (pointer capture; drop on the current tray places the
  coin) or tap a coin (tap sends it into the current group — the
  touch fallback; the same handler serves keyboard clicks). Each
  completed group of 5 locks (green tray + cumulative badge) and
  the count speaks in fives: chips 5, 10, … 40 over the spill plus
  "N of 40 coins grouped". At 40 the scene reports SOLVED through
  the answer-blind contract — the callbacks carry only progress
  (groups complete) and solved; the case takes its shared correct
  path (phase advance, progress record, celebration). The scene
  never sees the answer, a choice, or a pick.
- **Flow as staged:** picker → Math case → flap tap (hinge) →
  hunch "6" → play prompt replaces the answer card → play all 8
  groups → result band: stamp ★ Proved it!, "YOUR HUNCH — You
  guessed 6. The answer is 8 — here's why.", then the MOTION
  explanation (coins slide from a pile into 8 trays, count badges
  pop 5 → 40, ~7.4s, replay button), with the text derivation
  below it as the fallback. Reduced motion: the segment renders
  its still (grouped tableau, badges shown, no animation, no
  replay button) and the play scene loses its transitions; the
  Save-Data/low-memory still gates are the production mirror,
  noted in the Lane B/D addenda.
- **Video:** `captures/sample-video-interactable-390x844.mp4` —
  54.8s, 2.3 MB, H.264 +faststart. Beats verified by extracted
  frames: a drag caught in flight (1 of 40, coin over tray 0);
  mid-play partial grouping (24 of 40, 4 trays locked, chips
  5/10/15/20); the motion segment mid-animation in the result
  band (pile emptying, badges 5/10/15 popped); the segment at
  completion above the text derivation.
- **One bug found and fixed during the run:** the scene's solved
  timer was cancelled by the progress-report re-render landing in
  the same moment (callback identity in the effect deps +
  cleanup). Fixed by keying the timer off the all-done flag only
  and calling the latest callback through a ref. First recording
  failed on exactly this (all 40 grouped, no result); the second
  passed end to end.
- **Known staging nit:** in the motion segment, the last count
  badge of each row (20 / 40) sits at the stage's right edge and
  reads slightly clipped in stills. Cosmetic; a production build
  insets the badge.
- **Per-item authoring estimate, extrapolated from THIS build
  (stated as such):** this one case took ~2¼ hours of focused
  build time end to end (investigation, the two components, flow
  wiring, CSS, the recording spec, one debug cycle, verification).
  Roughly 70% of that is one-time machinery — the play-scene
  shell, drag/tap interaction, count chips, the motion-explanation
  segment, the flow wiring — which every later item reuses. The
  per-item delta is driven by the scene KIND, not the item count:
  a new kind (a different manipulable — dealing snacks, tipping
  pencil packs) needs its own interaction model + layout +
  educator review of its play prompt, estimated 45–75 min of build
  plus review; an item that reuses an existing kind with new
  numbers is data-only, ~10–15 min plus validation. The 37
  scene-carrying Math items span roughly a dozen kinds, so a
  rollout is priced per kind (~12 kinds), not per item (37).

## Sample videos (added 2026-11-24, owner's "record a sample video" ask)

- `captures/sample-video-390x844.mp4` — 44.3s, 3.5 MB, H.264 +faststart.
- `captures/sample-video-1280x800.mp4` — 61.1s, 8.2 MB, H.264 +faststart.

Recorded with Playwright video capture (pinned Chromium, flock,
workers=1) via `tests/e2e/why-learn-adoption-video.desktop.spec.ts`
(phone) and `why-learn-adoption-video-wide.desktop.spec.ts` (desktop),
same seeds and tap flow as the capture spec: picker scroll past the
sticker cards + stamps → Math case → flap tap (hinge lifts) → hunch
"6" (wrong on purpose) → answer "8" → result band with the stamp and
"You guessed 6. The answer is 8" line, final frame held. Beats
verified by extracted-frame reads (picker stamps, hunch card, result
band all visibly present in both videos). Every beat was driven by
real taps; the only seeded state is the documented localStorage seed
(band 7-10, read-aloud "never", Math + Chemistry progress).
