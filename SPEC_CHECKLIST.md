# SPEC CHECKLIST — Narration silence self-recovery (`fix/narration-silent-prod`)

Plain-language list of what this branch implements. Each item is a user-visible behavior.

## The problem (in plain words)
On the owner's phone, the storyteller's captions/subtitles appeared but no sound played. Tapping didn't fix it — every tap just showed another silent line. Three separate "silent traps" in the code could cause this, and none of them had a way back to sound.

## What was built
- [x] **1. If audio never starts, the app stops waiting.** When narration tries to play and the phone gives no answer within 4 seconds, the app now shows the text version with a "Tap the speaker to try again" hint — instead of waiting forever in silence.
- [x] **2. If audio starts but then stalls, the app recovers.** If sound begins but makes no progress for 3 seconds, the app treats it as failed and offers the retry path — instead of sitting in a fake "playing" state.
- [x] **3. Tapping while muted no longer wastes the one chance to play.** If the first tap happens while sound is off, the app stays ready — the next tap (after unmuting) still starts the narration. Before, that first tap silently burned the only attempt.
- [x] **4. Tapping grandpa replays a greeting you never heard.** If the home greeting failed or was missed, tapping grandpa now replays the greeting instead of a joke poke line. Once you've heard it, taps go back to the playful poke lines.
- [x] **5. Tapping during the tasting tour no longer burns the greeting.** A tap while the tour is walking no longer consumes the greeting's one attempt.
- [x] **6. Interrupting audio while it's starting no longer strands the player.** Tapping pause while sound is still buffering now lands in a proper "paused" state you can resume from — not a stuck "playing" state on a dead player.

## What was NOT changed
- The Ko-fi cloud (separate issue, untouched).
- The mute toggle itself — "sound off until I say so" still means silence; the speaker button still plays once without flipping the toggle.
- Caption timing, voices, and all existing passing behavior.

## How it was verified
- 20 new unit tests covering each decision above (fail-before / pass-after).
- 3 new end-to-end tests on the built app: hanging audio → fallback with retry hint; aborted audio → figure tap replays; healthy audio → element actually plays (not just captions).
- Full suite: typecheck, unit (1110), lint, build, Playwright storyteller specs.
- Screen recording of the test session attached to the PR (per owner's rule: no recording = testing didn't happen).
