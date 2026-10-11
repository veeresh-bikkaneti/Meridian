# Meridian Spec Checklist — Storyteller Tap-to-Play & Mute Indicator

Build: branch `fix/storyteller-tap-start-and-mute`. Each item below is done and can be checked by using the app on a phone or computer.

## Storyteller narration fixes

- [x] **Tapping the storyteller figure starts the narration when nothing is playing.** Before, tapping the figure while it was quiet did nothing. The button under the figure now says "Play the story" when idle.
  - *How to check:* 1. Open the app. 2. Wait until the greeting finishes (or mute is off and no sound is playing). 3. Tap the storyteller figure. → The story narration plays.

- [x] **The speaker icon shows whether sound is off.** When sound is off, the icon is a muted speaker (with an X). When sound is on, it is a normal speaker. Before, the icon always showed the normal speaker, so you couldn't tell mute was on.
  - *How to check:* 1. Open the app. 2. Tap the speaker icon. → It changes to the muted-speaker icon and all game sound stops. 3. Tap it again. → It changes back and sound returns.

- [x] **After the grandpa tour interrupts the greeting, tapping can start the sound again.** Before, a hidden blockage meant audio never recovered once the tour cut the greeting off. If the greeting already finished naturally on its own, it does not replay.
  - *How to check:* 1. Open the app. 2. While the greeting is speaking, let the grandpa tour take over the screen. 3. When the tour ends, tap the figure. → Audio plays again.

## Red-team hardening (edge cases)

- [x] **Tapping the figure while muted does NOT play sound.** Muting means "sound off until I say so," so a figure tap never overrides the speaker-off button.
  - *How to check:* 1. Open the app. 2. Tap the speaker icon so it shows the muted speaker. 3. Tap the storyteller figure. → No sound plays.

- [x] **If the tour ends after the greeting already finished, the greeting does not replay.** The greeting only ever plays once.
  - *How to check:* 1. Open the app. 2. Listen until the greeting finishes completely. 3. Start the grandpa tour and finish it. → The greeting is not heard a second time.

## Ko-fi cloud

- [x] **The Ko-fi donation cloud always shows when grandpa is on screen — on every visit.** Before, it only appeared on the first visit of the day and was missing on return visits. Tapping it opens an "ask a grown-up" message; tapping Continue opens Ko-fi in a new tab; tapping Cancel or pressing Esc closes the message. If Ko-fi isn't set up or the device is offline, the cloud hides itself.
  - *How to check:* 1. Open the app (on any visit, not just the first). 2. When grandpa appears, look for the cloud. → It is visible. 3. Tap the cloud. → The "ask a grown-up" message appears. 4. Tap Continue. → Ko-fi opens in a new tab. 5. Tap the cloud again, then Cancel. → The message closes.

---

# Meridian Spec Checklist — Result-Card Text Overflow (branch `fix/result-card-overflow`)

Owner report 2026-10-11: on a 390px phone, the pin-drop result card had three text problems. All three are fixed. Nothing else on the card changed.

- [x] **The distance headline fits.** "9,704 km northeast of your pin" used to get cut off at the card's right edge. Now it wraps to two lines and shrinks a little on small phones instead of spilling out.
- [x] **The storyteller's greeting banner fits.** "Gather round, explorer! …" used to run off the card's right edge mid-word. Now the bubble stays inside the card and the words wrap normally.
- [x] **The share-text block is readable.** The last lines ("0 over 1 places · …") used to hide underneath the "more below" scroll hint. Now you can scroll the last line fully into view, above the hint.

What was NOT touched: the storyteller narration, the share button and flow, "Next place", the grade chip, the pin-compare ledger, animations, or any text content. This is layout only.

## Proof

- Black-box test `tests/e2e/result-card-overflow.mobile.spec.ts`: plays the globe, drops a pin, and measures the real card — headline not clipped, banner inside the card, share text above the scroll hint. Screenshots taken.
- Screen recording of the test session (attached to the PR).
- Full gates: tsc, unit tests, lint-cards, production build, Playwright.
