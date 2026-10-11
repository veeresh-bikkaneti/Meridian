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

---

# Meridian Spec Checklist — BoundedText Wrapping Contract (branch `fix/result-card-overflow`)

Owner's words: "I would just wrap the text allowing the spill over to go in second line and make it readable rather letting go out of the boundaries." · "Data should be kept within the container." · "Component."

What changed: a new `BoundedText` component now renders every text element on the result card (headline, place names, story, score, share block, source link, "more below" hint, storyteller caption). The component guarantees text wraps to a second line instead of spilling out — no future text element can reintroduce the bug, because the build fails if card text isn't rendered through it.

## What you can check on a phone or computer

- [x] **Long headlines wrap to two clean lines.** Drop a pin far from the target — "9,704 km northeast of your pin" wraps to two balanced lines, nothing cut off at the card's right edge.
  - *How to check:* 1. Play the globe. 2. Drop a pin far from anywhere (e.g. middle of the ocean). 3. Look at the distance headline. → Two lines, fully readable, no spill.
- [x] **Long place names never truncate.** The answer name and the "Your pin / True spot" lines always show the full name, wrapping as needed.
  - *How to check:* 1. Play a country round (e.g. France). 2. Reveal a place with a long name. 3. → The full name shows on as many lines as it needs — never "…".
- [x] **The edition line in the header wraps instead of clipping.** The small "GLOBE · MEDIUM" line under the card header can now use two lines on narrow phones instead of cutting off with "…".
- [x] **The storyteller's caption still fits.** The greeting bubble stays inside the card and wraps normally.
- [x] **Nothing else changed.** The grade chip, difficulty chip, "Next place" button, share button, and speaker icon look and behave exactly as before — they were intentionally left out (single-line by design).

## What was measured (not just eyeballed)

- **Worst-case strings, real fonts, 5 widths** (320/360/390px + 200%-zoom equivalents): every card text element was measured in Chromium — nothing spills horizontally or clips vertically, headlines stay within their line budgets (≤2 lines at 390/360/320px).
- **The 10px-slack acceptance test passed** at 390px: the worst-case headline's first line keeps ≥10px of breathing room, so a different fallback font can't push it over.
- **Keep-together decision:** wrapping with balanced lines alone keeps "9,704 km" and "of your pin" together — no special markup needed. (Measured: adding no-wrap spans gave identical results at normal widths and *caused* overflow at extreme zoom, so they were rejected.)
- **Chip row:** when the headline wraps, it takes the full row width; the grade chip keeps its one line beside it.
- **Text-spacing stress (WCAG 1.4.12):** with extra-wide letter/line spacing forced on, nothing clips — the old header-clip hazard is gone.
- **Font failure:** with fonts blocked (fallback serif), nothing spills.
- **Full card matrix:** globe miss, globe hit, GeoDetective reveal, and long-name place cards × 320/390px × 100%/200% zoom — no clipped, spilled, or overlapping text; every text node is registered in the closed-world list. (Two honest scope notes: the page-level no-overflow check runs at ≥320px CSS — at 200%-zoom tiny widths the app's map chrome overflows on main too, a pre-existing limitation outside the card text; and the GeoDetective guess flow / map hit-tap can't be driven through the real UI below 320px CSS on main either, so those two variants are asserted at ≥320px.)
- **Fold test:** the "Next place" button is pinned and always visible; the share block at the bottom of a long card scrolls fully into view.
- **Real bug the battery caught and fixed:** the answer heading's short-name style used line-height 1.12, which clipped Fraunces descenders by 2px on the hit card. It now uses 1.15 (matching the ledger's short-name style) — same look, no clip.

## Proof

- Component contract tests: `src/components/bounded-text.test.ts` (14 tests, node --test).
- Chromium fixture suite: `tests/e2e/bounded-text.mobile.spec.ts` (18 tests) + fixture `tests/fixtures/bounded-text.html`.
- Page-level matrix: `tests/e2e/result-card-overflow.mobile.spec.ts` (16 card variants + fold test).
- Build gate: `node scripts/lint-cards.mjs` → GATE PASSED (new Tier 3: BoundedText-only text, no escape hatches, CSS guardrails, flex shrink allowance).
- Screen recording of the worst-case fixture cards (attached to the PR).
- Full gates: tsc, unit tests, lint-cards, production build, Playwright.
