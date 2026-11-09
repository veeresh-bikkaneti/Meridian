# SPEC CHECKLIST — Narration silence self-recovery (`fix/narration-silent-prod`)

Plain-language list of what this branch implements. Each item is a user-visible behavior.

## The problem (in plain words)
On the owner's phone, the storyteller's captions/subtitles appeared but no sound played. Tapping didn't fix it — every tap just showed another silent line. Three separate "silent traps" in the code could cause this, and none of them had a way back to sound.

## What was built
- [x] **1. If audio never starts, the app stops waiting.** When narration tries to play and the phone gives no answer within 4 seconds, the app now shows the text version with a "Tap the replay button to try again" hint — instead of waiting forever in silence. The hint names the replay button because it's the only control still on screen in the failed state (the speaker button hides on failure). The banner's version says "Tap me to try again" — the banner has no speaker button, so its hint names the figure tap that replays the greeting. (Copy is the panel's pick; final wording needs the owner's sign-off before merge.)
- [x] **2. If audio starts but then stalls, the app recovers.** If sound begins but makes no progress for 3 seconds, the app treats it as failed and offers the retry path — instead of sitting in a fake "playing" state.
- [x] **3. Tapping while muted no longer wastes the one chance to play.** If the first tap happens while sound is off, the app stays ready — the next tap (after unmuting) still starts the narration. Before, that first tap silently burned the only attempt. Qualifier: this is true on the card when sound was ON at mount (the armed one-shot is what retries). If sound was OFF at mount, the card never arms the one-shot — it's in manual mode, and the speaker button (then replay) is the path, not the one-shot.
- [x] **4. Tapping grandpa replays a greeting you never heard.** If the home greeting failed or was missed, tapping grandpa now replays the greeting instead of a joke poke line. Once you've heard it, taps go back to the playful poke lines.
- [x] **5. Tapping during the tasting tour no longer burns the greeting.** A tap while the tour is walking no longer consumes the greeting's one attempt.
- [x] **6. Interrupting audio while it's starting no longer strands the player.** Tapping pause while sound is still buffering now lands in a proper "paused" state you can resume from — not a stuck "playing" state on a dead player.
- [x] **7. Resuming paused narration is watched too.** If a paused line's resume never gets going within 4 seconds, the app fails loud into the text version with the same "try again" hint — instead of sitting in a fake "playing" state with no way back.
- [x] **8. Tapping grandpa rapidly can't spam the greeting.** The greeting-replay tap has the same short debounce as the poke lines, so a tap storm fires one attempt, not one per tap.

## What was NOT changed
- The Ko-fi cloud (separate issue, untouched).
- The mute toggle itself — "sound off until I say so" still means silence; the speaker button still plays once without flipping the toggle.
- Caption timing, voices, and all existing passing behavior.

## How it was verified
- 23 unit tests in the guards file covering each decision above (fail-before / pass-after).
- 7 new end-to-end tests on the built app: hanging audio → fallback with retry hint (+ the replay button actually rendered); stalled audio (starts then hangs) → fallback with retry hint; aborted audio → figure tap replays; muted first tap → one-shot survives, unmute + tap starts real playback; pause mid-buffer → recoverable paused state, replay resumes; banner play() rejection → figure-tap hint, figure tap replays; healthy audio → element actually plays (not just captions).
- Full suite: typecheck, unit (1113), lint, build, Playwright storyteller specs.
- Screen recording of the test session attached to the PR (per owner's rule: no recording = testing didn't happen).

---

# Spec checklist — ResizeObserver telemetry-noise hardening
(`fix/resizeobserver-telemetry-noise`)

Plain-language record of what was built and verified.

## What was implemented
1. **New helper `src/lib/observe-resize.ts`** — a ResizeObserver wrapper that
   coalesces callbacks through requestAnimationFrame (cancels any pending
   frame on re-fire). This breaks the synchronous layout read/write loop
   that makes the browser log "ResizeObserver loop completed with undelivered
   notifications". Disconnect cancels the pending frame, so nothing fires
   after teardown. Falls back to setTimeout where rAF is unavailable.
2. **The three production RO sites now use it** (behavior identical, just
   deferred one frame):
   - `src/components/atlas-map.tsx` — map `draw()` on stage resize
   - `src/components/scroll-cue.tsx` — "more below" `update()` on region resize
   - `src/map/starfield.ts` — starfield `repaint()` on container resize
3. **Crash-pipeline classification** (`src/lib/observability.ts`):
   - New exported `isBenignBrowserNoise(message)` — matches the RO loop
     message (case-insensitive).
   - The window `error` listener now drops that message entirely: no
     `js_error` event, nothing queued, no breadcrumb touch (lastMilestone
     keeps describing game progress, not browser housekeeping).
4. **Deliberately untouched**: the BoundedText dev-only ResizeObserver
   tripwire (already compiled out of prod).

## What was verified
- `npx tsc --noEmit` clean.
- `npm test`: 1189/1189 green (incl. 3 new observe-resize unit tests and
  3 new observability tests: noise classification, nothing-emitted, and a
  control proving real errors still emit js_error).
- `node scripts/lint-cards.mjs`: GATE PASSED.
- `npm run build:pages`: green.
- Playwright `tests/e2e/resizeobserver-noise.mobile.spec.ts` (1/1): boots
  the built app at 390×844, waits through the boot_ready window, thrashes
  the viewport, asserts zero "ResizeObserver loop" pageerrors and that the
  app stays interactive. Screen recording:
  `~/workspace/your_files/meridian-ro-noise-fix/boot-session-390px.webm`.
- Rebased onto origin/main tip (a0f153e); zero conflicts.

## Ready to merge? NO
(Per standing policy the verdict lives in the PR body; this checklist is
the plain-language record.)

---

# Spec checklist — PB-1: Holmes follows the pointer (`feat/holmes-follow`)

Plain-language record of what was built and verified. Owner
restatement, 2026-11-07 ~11:55 CST: "Holmes follows finger gestures
+ mouse movement throughout the WHOLE PAGE and stays with the
pointer" — returning to a home spot after a pause was named "a big
bug". This PR replaces the waypoint-berth + dock-return model
(shipped in #361–#363) with that model.

## What was implemented
1. **Follow model (new flag `holmesFollow`, shipped ON in
   flags.json, baked default false):** Holmes senses the pointer
   page-wide (mouse + touch) and travels to a legal spot BESIDE the
   pointer — never on top of it. One travel per solve, head-turn
   telegraph first, 0.3–0.8 s by distance. Desktop clearance 56 px /
   touch 64 px edge bubble (the K2 law), centre band 80–100 px.
2. **Positional memory:** he stays where the last solve parked him —
   across pauses, phase exits, and case changes. NOTHING sends him
   home: `exitToDock`, the phase-exit dock snap, and the >320 px
   remote rule are deleted.
3. **Planted during scroll/pinch:** the two-pointer centroid is
   never a target; scroll and pinch never move him.
4. **Speech lock:** while any pair speech plays he holds still;
   the next solve runs when the queue drains.
5. **Bursts:** sheet/rings/full-screen hide him; ~120 ms after the
   burst he re-solves to the pointer's last position. A quick tap
   still opens the place sheet instead of summoning him.
6. **Zero text coverage:** every solve rejects candidates
   intersecting clue/question articles, the Watson cluster, top
   header, result card, and pin markers (+48 px).
7. **Tier machine (new pure module `follow.ts`):** PAGE_FOLLOW →
   PAUSE_BERTH (yesterday's pause-berth, page-wide) → DOCK_ONLY,
   stepping DOWN on every auto-kill verdict (kill / degradation
   dock / Save-Data / low-memory / reduced-motion / battery saver)
   and back UP on the #362 re-qualification signals (case change /
   5 healthy seconds). The FG-5 latch itself is unchanged.
8. **Answer-blindness untouched:** the follow code reads only
   geometry; ack/decode/selection-reaction inputs are unchanged.

## What was NOT changed
- Watson: bench, walk, station, tap-to-replay, all lines.
- The speech player, the state machine's phases, the bench.
- PB-2 (session/moments) and PB-3 (mute-by-character) — separate PRs.

## How it was verified
- Unit: follow solver + tier machine fail-before/pass-after
  (16 tests); detective suite green; full suite on the merged
  tree (session 5, tip d869083): 2275/2275 src + 1021 pass
  scripts + worker 145/145; tsc clean; lint-cards PASSED.
- Build: `npm run build:pages` exit 0 on the merged tree;
  `dist/client/_shell.html` verified present (14,339 B) and
  buildId = code tip — the session-4 gap (a build that verified
  build-meta.json only, with no shell file) is closed.
- E2E: NEW `detective-follow.spec.ts` gates (a)–(f);
  `detective-berth.spec.ts`, the K2/K3 assertions in
  `detective-companion.spec.ts`, and staging cure C12 were
  REWRITTEN to the new model (they asserted deleted behaviour).
  SUPERSEDED (session 5): the earlier claim that E2E execution
  was environment-blocked (renderer crashes on game mount) no
  longer holds — the Chromium launch-policy outage recovered,
  and the step-0 CSO sweep ran the full 57-test detective set on
  unmodified main @ 63d8286 (55 pass + the 2 known issue-#371
  endings windows). The full census on this branch's merged
  tree runs as the session-5 gate; results land in
  GATES-STATE.md.

## Ready to merge? PENDING — pipeline verdict on the final tip
(Census, rest verification, Silo QA re-key, 13-seat panel,
DevEx + benchmark on the merged tree — session 5. The verdict
lives in the PR body; this checklist is the plain-language
record. The owner's standing ship-when-ready directive is the
merge word for a READY / READY-WITH-NITS verdict.)
