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
