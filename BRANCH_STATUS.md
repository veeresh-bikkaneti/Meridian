# BRANCH_STATUS — feat/smooth-cards

- **Branch:** `feat/smooth-cards`
- **Base:** `main` @ `685a94f` (#321 card films, #323 capitals pack, #322 Cold Trail copy, all merged)

## Task capsule

TASK / requested outcome: Owner, 2026-11-03, with a phone screenshot
of the live home page: "Similar to GeoDetective and cold trails can
we add some thing smooth here too. Also GeoDetective and cold trails
should have smooth blending like a gradient fading into text not
hard line." Two parts: (1) the two film cards' pictures dissolve
into the text area with a gradient fade, no hard edge; (2) the other
illustrated home cards get a calm, smooth motion in the same spirit.

Interpretations considered and selected reading: Part 2 motion is
CSS on the existing art (the owner has not approved generated film
for these cards). The motion settles after one pass instead of
looping, so no new pause control is needed (WCAG 2.2.2: content
that stops on its own within seconds needs no stop control).
SUPERSEDED the same day by the owner's ruling below (Part 2 redo):
the CSS reading was the parent brief's miss, not the owner's ask.

Tier and rationale: Tier 2 shape (home surface, several files) run
as a builder silo. QA and the 12-role panel are separate silos and
judge the final tip. No merge without the owner's per-PR word.

Done condition / evidence: fade visible in every film-card state
(playing, poster, reduced-motion still, error still); geometry of
both film cards byte-stable at desktop and mobile widths; each
treated illustration card shows one calm settling pass near the
viewport and is still under reduced-motion, Save-Data, and
deviceMemory at or below 2; all gates green; capture videos and
stills in `~/workspace/meridian-smooth-cards-evidence/captures/`.

Files and interfaces in scope: `src/components/home-v5.css` (the
fade and the art motion), `src/components/card-film.tsx` (header
comment only, if needed), `src/components/lazy-home-image.tsx`
(the near-viewport and gate logic that arms the art motion),
`src/assets/home-v5/card-media.ts` (comments only), new unit test
`src/components/home-smooth-cards.test.ts`, `README.md`, this file.
Out of scope (NOT touched): film media files, the pack shelf, pack
code, any game screen, the About text card, LockedLoop, and all
player-facing copy (zero string changes; eyebrows "Case file ·
Unlimited" / "Case file · Triangulation" and CTAs stay byte-exact).

## Inventory (from code, game-app.tsx)

| Card | Art surface | Line |
| :--- | :--- | :--- |
| GeoDetective | CardFilm `.hv5-pic` (film card, Part 1) | 4355 |
| Cold Trail | CardFilm `.hv5-pic` (film card, Part 1) | 4407 |
| Review (Review my misses) | `LazyHomeImage className="hv5-art"`, archive-tools | 4508 |
| Journal (What the land remembers) | `LazyHomeImage className="hv5-art"`, journal-tree | 4538 |
| Grown-ups (For grown-ups) | `LazyHomeImage className="hv5-art"`, binoculars-hat | 4559 |

That is the full `.hv5-art` inventory: exactly three cards. The
journal entry figures below the Journal card are content images,
not `.hv5-art`, and stay still.

## What shipped

Part 1, the fade. One overlay on the shared film wrapper
(`.hv5-card-film::after` in home-v5.css): a gradient inside the
existing picture box, clear at 64% of the box height, 0.45 alpha
at 82%, 0.88 at 93%, solid card colour (#fdfbf3, the
var(--hv5-card) value) at the bottom edge. Both cards share the
stops, because both pictures dissolve into the same card colour
and one alpha ramp blends each scene into it in proportion. The
overlay is on the wrapper, so it covers the film, the poster,
the reduced-motion still, and the error still with no component
change. It is pointer-events: none and sits at z-index 1. The
44x44 pause/play toggle stays where it was, in the top corner at
z-index 2, far above the fade zone and above the overlay, so it
is never faded and stays fully tappable.

Part 2, the art motion. `LazyHomeImage` arms one CSS pass on the
img inside each `.hv5-art` wrapper, and only there. The arming
mirrors CardFilm: an IntersectionObserver at rootMargin 200px
sets the pass off when the card nears the viewport, and the
`hv5-art-live` class is never added under prefers-reduced-motion
(the shared hook, live), Save-Data, or deviceMemory at or below
2 (read once at mount). Each pass runs once and settles back
onto the exact still it started from, so no loop exists and no
pause control is needed (WCAG 2.2.2 is met by the settle: the
moving content stops on its own in 9 to 11 seconds). Review
gets hv5-art-drift (10s, a slow pan under a 1.08 zoom), Journal
gets hv5-art-sway (11s, a 0.8 degree sway), Grown-ups gets
hv5-art-float (9s, a 4px rise). Keyframes use transform and
opacity only, and the motion is on the inner img, never on the
wrapper box the layout and E2E specs measure.


## Part 2 redo — cartoon films (owner ruling, 2026-11-03 06:19 CST)

Owner, verbatim: "What about the other 3 card where we wanted to
add similar contextual motion animated cartoon." The CSS passes
were the wrong class. They are removed in full, and Review,
Journal, and Grown-ups get animated cartoon films through the one
CardFilm system, by the #321 method: each card's existing
illustration is the animation source, the settle frame, and the
shipped still.

Removal (commit b11fbe8): the hv5-art-drift / hv5-art-sway /
hv5-art-float keyframes and live rules leave home-v5.css (81
lines); the hv5-art-live arming leaves LazyHomeImage (the file is
byte-back to its loading-orb-only job); the smooth-cards test's
art-motion pins become removal pins. The Part 1 fade is untouched
by the removal — a fade cure lands on this branch after this redo,
from the owner's variant pick.

Films (commit a7bf428; per-take notes in the evidence folder,
takes/TAKE-NOTES.md):

| Card | Film | Bytes | Slot (CSS px) | Encode |
| :--- | :--- | :--- | :--- | :--- |
| Review | review-film.mp4 | 66,023 | 172 wide, 400/269 | 800x538, 5.25 s |
| Journal | journal-film.mp4 | 110,320 | 148 square | 720x720, 7.875 s |
| Grown-ups | grownups-film.mp4 | 106,806 | 178 square | 800x800, 6.0 s |

- Review: the magnifying glass sweeps over the satchel as if
  checking the misses, then returns and rests. Three raw takes
  failed the identity/settle standard (no settle; layout redrawn;
  the lens vanishing in the last frame). The shipped film is
  take 1 edited there-and-back at its 2.6 s apex: forward sweep,
  then the same frames reversed. Shipped last frame vs first
  frame PSNR 38.0 dB — it settles on its own opening frame. The
  edit is disclosed here and in the PR body for the owner's call.
  The brief's "one card tips up" beat has no card to act on; the
  illustration holds a satchel, a compass, and the glass.
- Journal: wind through the tree, light warming over the hills.
  Take 1 of 1, retimed 10 s to 7.875 s. Disclosed drift: canopy
  ends more wind-blown than the still (last frame vs still PSNR
  16.6 dB), light ends warmer, a few tiny birds cross once.
- Grown-ups: the binoculars rise upright, the hat tips once.
  Take 2 of 2 (take 1 ended with the binoculars on their side).
  Settle: last frame vs own first frame PSNR 31.0 dB; vs the
  still 20.4 dB, the generator's repaint distance, present from
  frame 0 (first frame vs still 20.8 dB).

Wiring: all three slots render CardFilm (extended, not forked)
with REVIEW_FILM / JOURNAL_FILM / GROWNUPS_FILM entries in
card-media.ts; the stillUrls point at the original illustration
files. CSS adds three rules only: the pic fade stays off the art
slots, the toggle takes pointer events back from the decorative
wrapper, and the art-film wrapper rides at z-index 3 so the
toggle clears the stretched CTA (the Grown-ups links' own
precedent). Zero string changes; game-app.tsx swaps three
component lines and their imports, nothing else.

Redo gates (tip ee3487b; media and runtime identical at a7bf428,
which the E2E and captures ran against — ee3487b changes tests
and one comment digit only):

- `npx tsc --noEmit`: clean.
- `npm test`: scripts 953 (942 pass, 11 skipped, 0 fail); src
  1980/1980 pass (1977 at e6ecd1d; net +3 from the reworked
  CardFilm and smooth-cards pins).
- `npm run test:worker`: 85/85. lint-cards: GATE PASSED.
- `npm run build:pages` (VITE_KOFI_URL set): PASS. Byte deltas
  vs main 685a94f, same env, same shell-chunk method (the main
  numbers reproduce the round-1 record exactly): entry JS
  1,004,241 to 1,004,688 raw (+447 for the whole PR), entry CSS
  130,790 to 131,137 (+347). The three films add zero entry
  bytes; they are separate lazy assets (283,149 B of film +
  80,770 B of posters), fetched only near the viewport and never
  under the gates.
- Zero CLS: the three art wrapper boxes measured on the built
  app at 1280px and 390px match unmodified main exactly (1280:
  172x115.66, 148x148, 178x178; 390: 172x74.19, 148x104.77,
  178x120.64 — the 390 heights are viewport-clipped boxes,
  reproduced identically). Record:
  evidence/measure-artfilms-branch.json.
- E2E home set (flock, --workers=1, Chromium 1243): first run
  44 passed / 7 failed. Six failures were spec pins for the
  removed behaviour (art orbs; Review focus counts without the
  film toggle) — reworked honestly in ee3487b — and one
  storyteller visibility failure under peak VM contention.
  Rerun of the four affected files: 38/38 passed, storyteller
  included. The two files not rerun (home-badges-readaloud,
  grownups-privacy-contact) passed in full in run 1.
- Live governance proof (capture run): reduced-motion context
  shows the still in all three slots, no video element, and zero
  art .mp4 requests. On the capable context, each slot's toggle
  passes an elementFromPoint hit test at 44x44 and cycles
  Play -> Pause -> Play by click.
- Captures: captures/review-cartoon.mp4 (7.5 s),
  journal-cartoon.mp4 (8 s), grownups-cartoon.mp4 (7.9 s), frame
  strips for each, and settle-slot screenshots; settle screenshot
  vs still PSNR 16.9 / 16.5 / 20.0, matching the film-level
  settle numbers. The superseded CSS captures moved to
  captures/superseded-css/.

Environment note: the VM restarted mid-run (12:51 UTC) and the
E2E lock carried three other crews' suites; waits were long but
every run above completed against this branch's build.

## Rework — owner redirect (2026-11-03, after the fade captures)

Owner words, verbatim:
- 06:18 CST, on the Part 1 fade: "Thats too harsh on eyes the
  white clouds gradient."
- 09:05 CST: "Nothing is visible with the heavy cloud and
  playbutton, we dont need playbutton it should be in autoloop,
  I need this bigger, review should be more like rewinding
  something that went wrong so you need to rethink and
  reinageune this."
- 09:07 CST: "Remove playbutton set it on auto loop." (all card
  films). On the fade variants: he cannot tell A/B/C apart at
  capture size, the softer direction looks good, and he wants
  the gradient reduced even further. No variant landed as
  captured.

Four work packages, all built on this branch:

WP1, fade (thin bottom strip, game cards only). The cream ramp
is deleted. A mask feather on the `.hv5-pic` media itself holds
the scene at full opacity until 84% of the box, feathers to
transparent at 100% (stops 84 / 93 at 0.55 alpha / 100). The
wrapper ::after is now a landing strip only (clear to 94%,
0.5 alpha at 97.5%, solid #fdfbf3 at 100%). Mechanism is the UX
Designer memo's Variant C compressed from a 42% feather to a
strip, without its backdrop-blur layer. No pigment is painted
over the scene. `.hv5-art` slots keep ::after { content: none }.

WP2, autoloop, no toggle (all five cards). CardFilm loses the
toggle button, the paused state, and the play/pause/ended
handlers. The video gains `loop`. A second IntersectionObserver
(threshold 0) pauses films off screen and plays them on screen.
Gates unchanged: reduced motion (live hook), Save-Data,
deviceMemory at or below 2, or a video error land on the still
and the .mp4 is never fetched. The component header records the
governance change: the owner's autoloop order supersedes the
#295/#321 play-once + toggle governance for card films only
(the verdict clip keeps its stop), and the WCAG 2.2.2 tradeoff
is stated in plain words (continuous looping decorative motion,
no per-card stop; the gates are the stops that remain). Toggle
CSS deleted from home-v5.css.

WP3, bigger spot slots. Review, Journal, and Grown-ups art
slots are full-bleed banners at the top of the card: CardFilm
moves before `.hv5-txt` in game-app.tsx (no copy changes), and
the appended art-film block sets width calc(100% + 56px),
margin -26px -28px 18px, position relative, mask none,
border-radius 0. Per-card aspect ratios unchanged (400/269,
1/1, 1/1; nothing cropped). Spot text columns return to
max-width 100%. The wrapper keeps pointer-events: none from the
base rule. The z-index 3 lift and the toggle pointer-events
rule are deleted with the toggle. The game cards' `.hv5-pic`
geometry is untouched.

WP4, films (no new generation calls; per-build record in
evidence/takes/TAKE-NOTES.md, rework addendum):
- Review, reimagined (editorial, from take 1 raw): the glass
  sweeps, overshoots, and settles wrong at W = 4.8 s (frames at
  3.0/3.6/4.2/4.8/5.4 s inspected; 4.8 is the first clearly
  settled-wrong frame), 0.4 s freeze on W, the same frames
  reversed at 1.7x, 1.3 s freeze on frame 0. Last frame is
  frame 0 by construction. 9.54 s, 800x538, CRF 34, 179,821
  bytes. Last vs first PSNR 33.49 dB; the source frame against
  each encoded frame measures 33.70 / 33.87 dB, so the gap is
  CRF 34 quantization noise between two encodes of one frame.
  Poster unchanged: new frame 0 is pixel-identical to the
  shipped film's frame 0 (MAD vs poster 2.08/255, as shipped).
- Cold Trail, ping-pong from the original take: forward +
  reversed, 12.0 s, 1094x616, CRF 40 (38 measured 506,132
  bytes, over cap), 389,320 bytes. Both joins are the film's
  own frames; last vs first PSNR 26.81 dB (falling snow is
  per-frame noise at CRF 40; the scene and pose are the same
  frame at both ends). Poster re-derived from the new frame 0
  per the card-media standing rule (59,952 bytes, MAD 2.29;
  the old poster measured 5.88 against the new grain).
- Journal, seam polish only: 0.8 s xfade of the tail into the
  head on the shipped film. 7.917 s, CRF 38, 105,838 bytes.
  Last vs first PSNR 21.93 dB, up from the hard cut's 18.22.
  Poster unchanged (frame 0 untouched; MAD 2.44).
- Grown-ups, seam polish only: 0.4 s xfade. 6.042 s, CRF 34,
  100,591 bytes. Last vs first 33.09 dB, up from 31.37. Poster
  unchanged (MAD 1.99).
- GeoDetective: file untouched (native loop).
card-media.ts comments updated: fade paragraph, Review beat,
and a loop-treatment paragraph per film plus the autoloop
governance pointer to card-film.tsx.

WP5, tests (re-pins, each naming the owner order):
- card-film.test.ts: play-once + toggle describes re-pinned to
  autoloop (loop present; no <button>; no aria-pressed; no
  onEnded hold; off-screen observer pinned); toggle-CSS absence
  pins; banner geometry + picture-first DOM pins; byte caps on
  the new files' real sizes (all five at or under 400,000).
- home-smooth-cards.test.ts: fade pins on the mask stops
  (84/93/100) and strip stops (94/97.5/100); the 64% ramp is an
  absence pin that fails if the ramp returns; toggle pins
  replaced by absence pins; banner pins (calc width, banner
  margin, mask none, txt 100%, pointer-events none survives).
- E2E: card-redesign focus counts drop the film toggle (game
  cards 2 to 1, badges 3 to 2, Review due 3 to 2, empty 1 to 0,
  caught-up 2 to 1) and the Review illustration test now pins
  banner width; review-card-actions walks end at
  [primary, reset] in every deck state (empty is now []);
  loading-orbs masked-blob test re-pinned to the banner (mask
  none, banner spans the card width at its top).

Rework gates (tip before this status commit):
- `npx tsc --noEmit`: clean.
- `npm test`: exit 0; src 1987/1987 pass (1980 before the
  rework; the two re-pinned suites carry the net change).
- `npm run test:worker`: 85/85. lint-cards: GATE PASSED.
- `npm run build:pages` (VITE_KOFI_URL set): PASS.
- E2E (flock, --workers=1, Chromium 1243, Ko-fi build): the
  five affected files in one combined run passed 43/43
  (card-redesign 11, review-card-actions 6, loading-orbs 8,
  grownups-privacy-contact 5, home-visual-layout 13).
  card-redesign also passed 11/11 in a standalone re-run.
  (An early runtime summary of the standalone run reported
  one failure; the run's full output, delivered later, shows
  11 passed with test D green in 10.6 s. No flake is claimed.)
- mobile-home-overlap: 6 passed / 20 failed in the builder's
  own corrected run (VITE_KOFI_URL set; the first attempt
  omitted it and ran zero tests, and an early draft of this
  section carried an inverted 20/6 figure from a misattributed
  background delivery on this shared VM). 6/20 matches the
  recorded unmodified-main baseline in this VM exactly (Part 2
  redo round), and all 20 failures are the same family: the
  coffee-run strip, banner-zone, and tap-target checks at
  360px and 390px in both colour schemes, the strip failure
  recorded on main too. No regression from the rework.
- Grandpa tour: 24 passed / 1 failed, in a corrected run with
  VITE_KOFI_URL set in the run env (the spec throws at import
  without it; the builder's first attempt omitted it and ran
  zero tests, and an early draft of this section carried
  figures from a misattributed background delivery on this
  shared VM — the corrected run supersedes both). The one
  failure is "walker stops at each option, looks, sips, walks
  on": dwell y drift at stop 2 measured 15px against a <12px
  tolerance. The spec's own comments record this same test
  failing the same way on pristine main (2026-10-16 paired
  runs). The tour completes end to end on this branch: all
  trail-clearance, seated, skip, scroll, and reduced-motion
  tests pass with the taller banner cards in place.
- Zero copy changes in the rework: game-app.tsx moves three
  CardFilm elements and nothing else; LockedLoop, the verdict
  clip component, game screens, and pack code untouched.

## Cure — banner aspect + gradient refinement (2026-11-03)

Two defects cured on this tip after the rework measurements
were read closely. Owner-facing copy is untouched: zero string
changes in either cure.

Cure 1, the spot banners did not render at native aspect
(coordinator-measured; the builder re-measured before and after
and the numbers below are the builder's own). At 1280px the
three banners measured Review 386x185.56, Journal 386x241.34,
Grown-ups 386x241.34, against native aspects of 386x259.6
(400/269), 386x386 (1/1), and 386x386 (1/1). At 390px: Review
348x142.25, Journal 348x221.14, Grown-ups 348x218.53, against
348x234.1 / 348x348 / 348x348. The CardFilm media fills its box
with position absolute + object-fit cover, so the squashed
boxes cropped the films (Journal's circular medallion clipped
top and bottom). Mechanism, verified by the cure: the base
`.hv5-spot .hv5-txt` rule sets `height: 100%`, written for the
old corner layout where the art was absolutely positioned and
out of flow. Inside the flex-column `.hv5-card` the in-flow
banner's aspect height plus a 100%-tall text column overflow
the card, and flex shrink takes the overflow out of the
banner. The fix lives in the appended art-film block, with the
layout it serves: `.home-v5 .hv5-spot .hv5-txt { height: auto; }`
plus a comment recording the mechanism. `flex: none` on the
banner was evaluated and is NOT needed: with the text column
at natural height there is no overflow left to shrink the
banner, and the measured boxes below are the proof.
- Slot boxes after the cure, 1280px: Review 386x259.58,
  Journal 386x386, Grown-ups 386x386. At 390px: Review
  348x234.02, Journal 348x348, Grown-ups 348x348. Every box is
  within 0.1px of its native-aspect target.
- Game-card slots byte-identical to the defective build:
  590.98x332.42 (GeoDetective) and 591x332.44 (Cold Trail) at
  1280px; 348x195.75 both at 390px. Game card heights
  unchanged (561.16 at 1280px; 440.75 / 446.86 at 390px).
- Card heights did not move at either width: the three spot
  cards stay 676.66 at 1280px, and at 390px Review 396.34,
  Journal 638.66, Grown-ups 619.86 — the height the banner
  recovered came out of the text column's slack (the 100%
  column was mostly empty space below the copy), not out of
  the card.
- Zero CLS re-measured on the cured build: poster box equals
  playing box on all three spot slots (record:
  evidence/cls-rework.json, refreshed; geometry record:
  evidence/measure-rework-beforeafter.json, whose old-build
  side is untouched and whose defective-tip numbers are
  preserved under defectiveRework).

Cure 2, the gradient refinement. Owner, 2026-11-03 10:25 CST,
verbatim: "use gradient that belends into the bacground of
the page, and it should be very small not too big since its
covering up the actual txt and animation cartoon". Two
changes in the `.hv5-pic` fade block of home-v5.css:
- The mask feather shrinks from (full opacity to 84%, half at
  93%, out at 100%) to a ~7% zone: full opacity to 93%, out at
  100% — about 23px on the 332px box. The scene is untouched
  above the last 7%. Both the -webkit- and standard mask-image
  declarations carry the same stops.
- The painted landing strip is deleted entirely: the
  `.hv5-card-film::after` gradient rule (clear to 94%, 0.5
  alpha at 97.5%, solid #fdfbf3 at 100%) is gone. The melt is
  now a pure alpha feather with zero pigment painted anywhere.
  The base rule served no other purpose (it only painted the
  strip); the art slots' `content: none` guard on the
  wrapper ::after stays in place.
Ground reasoning (also recorded in the CSS comment): the page
ground is --hv5-parchment #f6f1e3; the card ground is
--hv5-card #fdfbf3. The two game-card pictures sit inside
their cards, so the ground their bottom edge touches — and
the ground the text zone sits on — is the card surface. A
pure alpha feather reveals exactly that ground, so the melt
is invisible against it. Painting the page's parchment across
the pale card instead would draw a visible warm band on the
card: a new hard edge, the opposite of the owner's ask. Per
card: GeoDetective melts into its card ground; Cold Trail
melts into its card ground; the three spot banners carry no
fade at all (their edge is the crop, and cure 1 shows the
full cartoon — no strip ever eats the cartoon).
Comments brought up to date with the strip's deletion:
home-v5.css (fade block + art-film block), card-film.tsx
header, and card-media.ts (fade paragraph). card-media.ts is
also where the Review film's duration is corrected below.

Re-pins, each named (no assertion weakened; every changed pin
still fails if the old behaviour returns):
- home-smooth-cards.test.ts, mask-stop pin: "#000 84%" +
  "rgba(0, 0, 0, 0.55) 93%" replaced by "#000 93%" +
  "transparent 100%", with new absence pins for the 84% stop
  and the mid stop (owner's very-small ruling, 2026-11-03
  10:25 CST).
- home-smooth-cards.test.ts, "the ::after landing strip hugs
  the bottom edge only" replaced by "the painted landing strip
  is deleted entirely (owner ruling, 2026-11-03 10:25 CST)":
  removal pins — no `.home-v5 .hv5-card-film::after` rule, the
  strip's three stops absent, the art slots' ::after guard
  still present.
- home-smooth-cards.test.ts, cream-ramp absence pin: re-based
  from the deleted fadeRule slice to the whole stylesheet
  (same two stops, same meaning).
- home-smooth-cards.test.ts, "the strip can never be tapped
  and never grows the box" replaced by "the feather is a mask
  only": the mask rule sets no height, width, or position.
- home-smooth-cards.test.ts, "the Part 1 fade is untouched by
  the removal": re-based from the strip rule to the mask rule
  (93% stop).
- home-smooth-cards.test.ts, NEW pin: "the spot text column's
  height: 100% is neutralized in the art-film block (aspect
  cure)" — art block carries height: auto, and the base rule
  still carries height: 100% (the cure is the override, not a
  base edit).
- card-film.test.ts, "art-film CSS: fade strip stays on the
  pic slots; no toggle layer survives" renamed to "art-film
  CSS: no fade overlay on the art slots; no toggle layer
  survives" — its assertions (art ::after guard, content:
  none, no toggle layer) are unchanged in substance; the name
  no longer claims a strip that does not exist.
- card-film.test.ts, banner-geometry pin: new assertion that
  the art block carries height: auto (the aspect cure).

Docs truth: the Review film's duration is corrected to
9.54 s. ffprobe measures 9.541667 s on two independent reads
(the source file src/assets/home-v5/review-film.mp4 and the
built bundle's review-film asset). The WP4 record above now
reads 9.54 s (it said 9.417 s), and card-media.ts's Review
loop comment now reads 9.54 s (it said 9.4 s).

Cure gates (this tip):
- `npx tsc --noEmit`: clean.
- `npm test`: exit 0; scripts 953 (942 pass, 11 skipped,
  0 fail); src 1988/1988 pass (1987 at the rework tip; +1 for
  the new aspect-cure pin, the gradient re-pins netting zero).
- `npm run test:worker`: 85/85. lint-cards: GATE PASSED.
- `npm run build:pages` (VITE_KOFI_URL set): PASS.
- E2E (flock, --workers=1, Chromium 1243, VITE_KOFI_URL set in
  the run env): the first combined run of the four briefed
  files reported 25 passed / 6 failed in 12.6 min under heavy
  shared-VM contention, and its file list carried the brief's
  name home-visual.desktop.spec.ts, which matches no file in
  the repo (the spec is home-visual-layout.desktop.spec.ts),
  so that run's composition was partial and its failure list
  did not survive in the run output. Every file was then
  re-run standalone against the same cured build, same env:
  review-card-actions 6/6, home-visual-layout 13/13, and
  card-redesign + loading-orbs 19/19 — 38/38 across the four
  files, a superset of the combined run's 31. Per this repo's
  evidence rule (parallel-era failures that pass sequentially
  are contention flake, not signal), the cure records the
  standalone results as the gate result and the combined run
  as a contention artifact, not a regression.
  Correction (later the same day): the combined run's full
  output, delivered after this entry was written, shows exit
  code 0 with 25 passed / 0 failed — the 25 being exactly the
  three correctly named files (card-redesign 11, loading-orbs
  8, review-card-actions 6), the misnamed home-visual arg
  having matched nothing. That full output supersedes the
  early summary's 6-failure figure above: on the fuller record
  the combined run passed everything it ran, and the
  standalone 38/38 remains the gate record for all four files.
- Recapture (evidence only): rework-{review,journal,grownups}-
  loopcross.mp4 + frames re-shot cropped to the corrected
  slot boxes (the defective-box versions are overwritten);
  rework-{geo,cold}-fade-mid-{1280,390}.png re-shot on the
  retuned build; captures/rework-fade-sidebyside.png rebuilt
  with the cured build as the REDUCED panels (CURRENT panels
  kept from the old build).

## Gates (tip before this status commit)

- `npx tsc --noEmit`: clean.
- `npm test`: PASS. Scripts 953 tests (942 pass, 11 skipped,
  0 fail); src 1977/1977 pass (1964 on main plus 13 new pins in
  home-smooth-cards.test.ts).
- `npm run test:worker`: 85/85 pass.
- `node scripts/lint-cards.mjs`: GATE PASSED.
- `npm run build:pages`: PASS, both with and without
  VITE_KOFI_URL set.
- Byte deltas vs main, same build env (VITE_KOFI_URL set, the
  tour spec's build): entry JS 1,004,241 to 1,004,788 raw
  (+547, +0.05%), gzip 311,561 to 311,748 (+187). Entry CSS
  130,790 to 131,893 raw (+1,103, +0.84%), gzip 26,137 to
  26,320 (+183). Whole dist tree +8,619 bytes.
- Zero CLS: both film cards' picture box, card box, and toggle
  box, and all three art wrapper boxes, measured on the built
  app at 1280px and 390px on this branch and on unmodified
  main. Every width and height delta is 0.0. Records in
  `~/workspace/meridian-smooth-cards-evidence/measure-*.json`.
- E2E (flock ~/workspace/.e2e.lock, --workers=1, bundled
  Chromium 1243, Ko-fi build): card-redesign 11/11,
  loading-orbs 8/8, home-visual-layout 13/13,
  review-card-actions + home-badges-readaloud 14/14,
  grownups-privacy-contact 5/5.
- Two specs fail in this environment on this branch AND on
  unmodified main, with identical counts, so they are recorded
  as pre-existing environment failures, not regressions:
  grandpa-tasting-tour 4 passed / 21 failed on both (the tour
  element never appears, `getByTestId('grandpa-tour')` not
  found, on main too), and mobile-home-overlap 6 passed / 20
  failed on both (first failure: the coffee-run strip starts
  336px after main ends, on main too). The builder makes no
  claim that these two specs pass anywhere in this VM.

## Visual evidence

`~/workspace/meridian-smooth-cards-evidence/captures/`:
geodetective-fade.mp4 and coldtrail-fade.mp4 (8s each, the fade
visible while the film plays and at settle), review-motion.mp4,
journal-motion.mp4, grownups-motion.mp4 (7s each), frame strips
for all five videos, settle stills for both film cards, the
reduced-motion stills for both film cards, and the Cold Trail
error still. Frame checks: PSNR between frames 4s apart in the
art videos is 26.4 (Review), 30.7 (Journal), 31.9 (Grown-ups),
a small real difference, which is what a calm pass should
measure. Reduced-motion run: no art img carried the live class.

## Frozen surfaces

Zero string changes anywhere. Eyebrows, CTAs, the Jolly copy,
LockedLoop, film media files, the pack shelf, pack code, and
all game screens are untouched. game-app.tsx has no diff at
all. Frozen PRs #297/#299/#302/#305/#307/#308/#309/#311/#312
were not touched, commented on, or rebased.

## Status

- [x] Clone created; branch cut at `685a94f`
- [x] Part 1: gradient fade on both film cards
- [x] Part 2: settling motion on the three `.hv5-art` cards (superseded by the redo below)
- [x] Part 2 redo: CSS passes removed; cartoon films on all three `.hv5-art` cards via CardFilm
- [x] Part 2 redo: E2E spec re-pins (orbs, Review focus stops) and rerun green
- [x] Unit tests, typecheck, lint-cards, production build
- [x] Byte deltas and zero-CLS measurements vs main
- [x] E2E home set under the flock (two specs fail identically
      on main; see Gates)
- [x] Visual captures (videos + settle stills)
- [x] Docs (README + card-media comments) and PR body
- [x] PR opened: #324; stop at READY (no merge)
- [x] Rework (owner redirect 2026-11-03): thin-strip mask fade,
      autoloop with no toggle on all five films, banner art
      slots, Review rewind film + Cold Trail ping-pong +
      Journal/Grown-ups loop xfades
- [x] Rework unit re-pins + E2E re-pins (E2E specs committed
      with this status update)
- [x] Cure: spot banners render at native aspect (height: auto
      in the art-film block; measured at both widths, zero CLS
      re-measured, loopcross captures re-shot at the corrected
      boxes)
- [x] Cure: gradient refinement (owner, 2026-11-03 10:25 CST) —
      feather shrunk to the last 7%, painted landing strip
      deleted, fade pins re-pinned and named
- [x] Docs truth: Review film duration corrected to 9.54 s
      (ffprobe 9.541667 s, source + built bundle)
- [ ] QA silo verification of the rework tip
- [ ] Panel re-vote on the final tip after QA

---

## Rebase onto current main (2026-11-03)

- **From:** pre-rebase tip `3aadb19` (base `685a94f`)
- **Onto:** `origin/main` @ `5dc21b9` (merges #305, #310, #292, #293,
  #304, #307, #299 landed from other operations)
- **New head after rebase:** `0af5714` (this status commit sits on top)
- **Conflicts:** 1 — `BRANCH_STATUS.md`, in the first docs commit
  only. Main's file had grown into a stack of preserved prior-branch
  records (Cold Trail copy #322 on top, then capitals #323, #305,
  #310, #307, #299); this branch's file is this branch's own record.
  Resolution: this branch's record wins in place (it is the live
  record for PR #324), and main's 607-line file is preserved verbatim
  below under "Prior records preserved on rebase onto 5dc21b9" — both
  sides kept, per the repo's preserve-on-merge convention. All other
  18 commits applied clean, including `README.md`, `home-v5.css`,
  and `game-app.tsx` (auto-merge; #310's hunks and this branch's
  hunks are in different regions).
- **Post-rebase audit:** `git diff origin/main..HEAD --stat` shows
  the same 20 files as the pre-rebase diff; excluding
  `BRANCH_STATUS.md`, the post-rebase diff is byte-identical to the
  pre-rebase diff (`diff` of the two diffs: no output). LockedLoop
  untouched; locked copy byte-exact ("Grown-ups — buy me a coffee?
  ☕", "Your support keeps Meridian free for kids", "Case file ·
  Unlimited", "Case file · Triangulation", CTAs "Solve a mystery" /
  "Start the trail"); no share/challenge or game-screen code in the
  diff (comments and README prose only).
- **Gates on the rebased tip (`0af5714`):** `npx tsc --noEmit`
  clean · `npm test` green (scripts 943 pass / 11 skipped / 0 fail;
  src 1988/1988 — share/challenge suites `src/game/share-action.test.ts`
  and `src/game/challenge.test.ts` green inside it) ·
  `npm run test:worker` 85/85 · `node scripts/lint-cards.mjs` GATE
  PASSED · `VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy
  npm run build:pages` exit 0.
- **E2E on the rebased tip** (flock, `--workers=1`): first combined
  run of the five desktop specs ran under extreme VM contention
  (load 25–46): 36 passed / 7 failed, every failure a timeout
  (card-redesign ×5, home-visual-layout ×2). Recovery run at lower
  load (card-redesign + home-visual-layout + grandpa tour, 49
  tests): 48 passed / 1 failed — card-redesign 11/11 and
  home-visual-layout 13/13, so all 7 contention failures pass on
  re-run; grownups-privacy-contact 5/5, loading-orbs 8/8, and
  review-card-actions 6/6 had already passed in the combined run.
  The one remaining failure is the tour's "walker stops at each
  option, looks, sips, walks on" dwell test (60 s predicate timeout
  in the recovery run; a 22 px dwell-Y assertion in a solo re-run).
  A control run of the same single test on unmodified main
  (`5dc21b9`, own worktree, own build) fails it too (tour stage
  stuck at "compass", 20 s attribute timeout) — the failure exists
  on unmodified main in this environment, so it is the documented
  on-main dwell flake, not a rebase regression. (This matches this
  file's earlier record: a 24/1 tour run whose dwell nit was the
  documented on-main failure, and a later 25/25 run.)
- **Environment note:** the VM rebooted mid-verification
  (2026-11-03 ~19:49 UTC), wiping /tmp logs and the first solo
  re-run; the branch and all gate results above were re-verified or
  already recorded in full before the reboot, and `build:pages` was
  re-run green after it (exit 0) before the recovery E2E.

---

# Prior records preserved on rebase onto 5dc21b9 (2026-11-03)

Main's `BRANCH_STATUS.md` at `5dc21b9`, verbatim below: the Cold
Trail card-copy record (PR #322) followed by the records main
already preserved for the capitals pack (PR #323), share first tap
(PR #305), reserve caption slot (PR #310), idle-kill locators
(PR #307), and security.txt expiry (PR #299).

# BRANCH_STATUS — fix/coldtrail-card-copy

- **Branch:** `fix/coldtrail-card-copy`
- **Base:** `main` @ `193b57c` (#321 home-card films, merged + live)

## Task capsule

TASK / requested outcome: Fix the Cold Trail home-card body copy
so it matches the now-live card film. The old copy ("A smuggler
moves between cities… make the interception") contradicts the
film, which shows Jolly (the cream plush mascot) being tracked by
a child before the trail freezes. Rewrite under the #321 panel
Narrative recommendation on record (panel VERDICT-RECORD flag 3):
keep the triangulation mechanic truth (three sightings, three
rings, tap where they cross), adopt the picture's cast inside it
(sightings of Jolly; reach Jolly where the rings cross before the
trail freezes) — do NOT rewrite to "follow Jolly" alone. Owner's
dispatch for this work — Veeresh, 2026-11-03: "work on the cards
that is not dependent on rock". Stop at PR-open; QA + panel are
separate silos. NO MERGE without the owner's per-PR word.

Tier and rationale: Tier 0/1 copy execution of a panel-recorded,
owner-open call — the wording rails were decided by the #321
panel's Narrative seat; this branch only crafts within them.
Scope is player-facing card copy + its test pin + a comment-only
fold-in in `card-media.ts`.

Done condition / evidence: new copy renders on the Cold Trail
card (verified in the built artifact); every pin of the old copy
updated or explicitly disclosed below; repo gates green; targeted
E2E green; PR opened with the full record.

Files and interfaces in scope: `src/components/game-app.tsx`
(the Cold Trail card `<p>` only), `src/components/card-film.test.ts`
(the one copy-lock pin), `src/assets/home-v5/card-media.ts`
(comments only), this file. Out of scope (NOT touched):
`src/game/coldtrail/*` (internal engine vocabulary incl.
"smuggler" names and themes.ts briefing strings), GeoDetective
card copy, the films/posters/stills and `card-film.tsx` logic,
LockedLoop, layout/CSS, and the locked strings "Case file ·
Unlimited" / "Case file · Triangulation" / "🔎 Solve a mystery" /
"❄️ Start the trail" (byte-exact — zero diff hits).

## What shipped

- **New Cold Trail card copy (123 chars, two short sentences;**
  **old copy was 110 chars rendered):**
  "Jolly was spotted in the snow. Three sightings, three rings —
  tap where they cross to reach Jolly before the trail freezes."
  The mechanic fragment "Three sightings, three rings — tap where
  they cross" is kept verbatim from the old copy; the cast is now
  Jolly (spotted → sightings of Jolly; goal = reach Jolly), and
  the freeze deadline from the film is the closing beat.
- **Pin updated:** `src/components/card-film.test.ts` copy lock —
  the old-copy fragment replaced with the new copy's fragment at
  the same lock strength (byte-exact `includes`, same position in
  the locked-strings list). No assertion weakened or loosened.
- **JSX comments checked:** the CardFilm comment block above the
  Cold Trail `<CardFilm>` (game-app.tsx ~4403) already truthfully
  describes the film (Jolly walks the footprint trail) — no change
  needed. The article header comment (~4394, "3 sightings, 3
  rings, one interception") describes the vertical slice's
  mechanic, which is unchanged — left as-is.
- **Fold-in, comment-only, `src/assets/home-v5/card-media.ts`:**
  (1) the two frame-0 extraction commands from the #321 cure
  record (`evidence/cure/CURE.md`) copied verbatim into the
  poster-derivation section; (2) ONE sentence stating the end
  axis per card (GeoDetective settles on the owner's image at the
  front angle; Cold Trail settles on the wide trail scene with
  Jolly mid-trail, still walking the footprint trail toward the
  lit cabin, which is still distant). No code lines
  changed; no asset bytes changed.

## Pin census (old copy + fragments, whole repo)

| Location | What was done |
| :--- | :--- |
| `src/components/game-app.tsx` ~4419 (the card `<p>`) | **Rewritten** — the source copy itself |
| `src/components/card-film.test.ts`:147 (copy lock) | **Updated** to the new copy, same lock strength |
| `docs/reviews/2026-10-21-wave2-mode-screens.md`:100 | **Left byte-intact on purpose** — a dated historical review record quoting the old copy as the open question (OD-1 / C-4) this PR resolves |
| `docs/handbook/02-game-design-decisions.md`:52 | **Left unchanged, disclosed** — it describes the Cold Trail edition's mechanic in the handbook's own words ("Three sightings, three rings, one interception… taps where the rings cross"), not the home-card text; it is not a pin of the card copy and the mechanic it describes is unchanged |
| `src/game/coldtrail/themes.ts` + `themes.test.ts` | **Out of scope, untouched** — different strings (in-game briefing texts for other themes); they share only the generic "Three sightings, three rings —" mechanic phrase, not this card's copy |
| README.md, e2e specs | **No pins found** — grep-verified; e2e references the card only via the untouched CTA "Cold Trail: Start the trail" |

## Redundancy audit (owner standing rule)

| Surface | Keep / remove | Reason |
| :--- | :--- | :--- |
| Card JSX `<p>` in `game-app.tsx` | **Keep — single source** | The one place the player reads this copy |
| `card-film.test.ts` copy lock | **Keep** | Deliberate byte-exact lock; it exists to fail the suite if the card copy drifts — a guard, not a second source |
| Historical review doc quote | **Keep (byte-intact)** | A dated snapshot; editing it would falsify the record of the open question |
| Handbook mechanic description | **Keep** | Describes the edition's mechanic from its own context; does not restate the card copy |

## Gates (code head 951246e; BRANCH_STATUS commit is docs-only on top)

- `npm run typecheck` — PASS (0 errors)
- `npm test` — PASS: scripts 850 pass / 11 skipped / 0 fail;
  src 1896/1896 pass
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — PASS; built artifact grep-verified:
  new copy present in `dist/client/assets/routes-*.js`, old copy
  absent
- E2E (flock `~/workspace/.e2e.lock`, --workers=1, Playwright-
  bundled Chromium 1243 — the VM's /opt/meta-chromium is not used,
  same as the #321 runs):
  - card-redesign.desktop — **11/11 PASS**
  - loading-orbs.desktop — **8/8 PASS** (builder-run result;
    incl. reduced-motion still + film-error → Cold Trail still)
  - home-visual-layout.desktop — **13/13 PASS** (copy is 13 chars
    longer rendered; the card chain has no fixed height or clamp,
    so a one-line text growth has no failure mode by construction
    — absorbed by grid stretch + auto-margin CTAs)
  - QA's combined E2E spot run had one infra flake
    (card-redesign:278 setup timeout under VM load; branch rerun
    1/1 PASS, unmodified-main control 11/11). The loading-orbs
    8/8 result above is a builder-run result that QA did not
    rerun.

## Flags for the owner / panel

- Panel approves the final tip; merge only on the owner's
  per-PR word. The Narrative seat judges the new wording.
- Eyebrows, CTAs, films, posters, stills, and LockedLoop are
  untouched — media asset bytes identical to main.

---

# Prior record preserved on rebase: capitals pack (PR #323, merged as 3bc7fd9)

# Branch status: feat/capitals-pack

Story packs (issue #319), integration branch. The Stacker integrated
the four swarm slices into one branch and runs the review pipeline to
READY. No merge. The owner's per-PR word gates merging.

Base: main `193b57c` (PR #321 merged). PR #322 (Track A, card copy)
is still open, now at cured head `cd6d47b`, so this branch stays based
on `193b57c`. If #322 merges first, this branch rebases onto the new
main before its own merge. The PR body records that debt.

## Task capsule

TASK / requested outcome: integrate swarm slices 1 to 4 (runtime core,
capitals content, Cold Trail adapter, pack shelf) into one branch,
resolve the six named seams, and run the full review pipeline to
READY. No merge.

Interpretations considered and selected reading: (a) one shared
selection blob for both editions — rejected, because each edition's
dealer reads only its own progress store, so a shared blob would be a
second source of truth one dealer never reads; (b) one selection
store per edition, each dealer reading the store its chips write —
selected (seam 1 below).

Tier and rationale: Tier 2. A new content system across many files,
with storage keys and a pack schema; the full review pipeline
(Silo QA, 12-role panel, DevEx, benchmark) applies.

Budget: Tier 2 default parent cap (400k tokens) covers this run and
all its delegates. No token meter exists for the run, so no count is
claimed here.

Approvals and checker: the owner approved the design and ordered the
build on 2026-11-03 ("Approve design — build the capitals pack",
"Pstack swarm"). Merge is NOT approved; it waits for the owner's
per-PR word on the final tip. Checkers are independent of the
builder: Silo QA (clean context) and the 12-role panel.

Slices and tips: swarm/runtime-core `093ec58`, swarm/capitals-content
`c5ba2b8`, swarm/coldtrail-adapter `762cb0d`, swarm/pack-shelf
`3f06576`. Integration commits: `6c7fce1`, `a103243`, `881a2fa`,
`0b58447`, `902e65c`, `f776fd1`, then `0e24e96` (dealing-proof E2E).

Seams and how they closed:
1. One selection store per edition. The GeoDetective loop store owns
   its selection (`activeDeckId`); Cold Trail selection lives in the
   shelf selection blob under its own key. One store per edition
   because the two editions keep separate progress stores today, and
   the dealer for each edition reads exactly the store its chips
   write.
2. Cold Trail pack progress key and shape match Slice 3's store.
3. Pack manifest carries coldtrailFile; the composer covers all 72
   cases, loopIndexes 387 to 458.
4. Schema and composer accept Slice 2's three record additions
   (schema field, directions array plus direction, target.aliases).
   Both validators pass over all 72 on the integrated tree.
5. Deck-correct dealing proven end to end in E2E for both editions
   (pack-shelf spec, 6 of 6 under the flock).
6. Screens pass the open case's real deck id as activeDeckId.

Out of scope, recorded in the PR body: the Direction B2 loss-reveal
credit (it depends on reverse-direction B1/B2 play being built
first; no B2 case can be lost until B2 cases deal), the home card
subtitle from DESIGN section 7 (Track A region), alias widening for
the five repair-2 cases.

Frozen: PRs #297, #299, #302, #305, #307, #308, #309, #311, #312,
#322. This branch does not edit, comment on, or rebase any of them.

## Round-1 cure (2026-11-03, on tip f74b708's verdicts)

Round 1 returned 7 panel BLOCKs, a DevEx FAIL, and 2 Silo QA
defects. The cure is built on this branch in 12 commits
(`414ddb6`..`aa0b7f4`); the full per-item record with evidence is
`~/workspace/meridian-capitals-evidence/cure/CURE.md`. In short:

- Code: edition-true Cold Trail pack total (60, not 72) end to end;
  TrailScreen mount resume (an unrevealed case in exactly one deck
  opens on that deck, ahead of the selection blob); deck-aware cycle
  celebration (Capitals copy denominated in 72, core copy
  byte-identical); 320px shelf second-row reserve; ride-alongs
  (role="status", reset clears the shelf blob, manifest-validator
  parity, missing-sidecar screen test).
- Content: duplicate targets cured by swap — Nairobi and Ankara
  (already core clues 74/218) replaced by Accra (Ghana) and Abu
  Dhabi (UAE) at tier 3, authored to the full standard; 459 unique
  targets restored, pack stays 72, Cold Trail deck stays 60 and now
  teaches 51 anchor capitals. Indianapolis hook carries no
  measurement string. Addis Ababa and Nashville giveaways rewritten
  as capital-only role facts (Addis hook rung untouched).
- Validators: all 72 records state Direction A only; the B2 subject
  rule is stated in the same words in schema.mjs and
  validate-pack.mjs, and validate-pack now calls schema's
  validatePackRecord for the shared checks (equivalence test pins
  both gates on a synthetic B2 record).
- Docs: design vendored at docs/story-packs.md with the v1 truth
  corrections; README passage; docs/geodetective.md updated (459
  clue files, pack-owned indexes 387-458); Handbook ch05 records
  the owner's 2026-11-02 packs-not-modes ruling; runbook at
  scripts/packs/README.md plus packs:* npm scripts; the Cold Trail
  generator's stale fallback header corrected.

Gates on the cured tip (all run unpiped, real exit codes):
validate-pack --all exit 0 (72/72); composer re-run drift limited
to generatedAt (restored); npm test exit 0 (scripts 953: 942 pass /
11 skipped / 0 fail; src 1964 pass / 0 fail); test:worker exit 0
(85/85); tsc --noEmit exit 0; lint-cards GATE PASSED; lint-content
exit 0 (6 baselined, 0 new); build:pages exit 0; perf:bundle entry
JS 982,696 raw / 306,177 gzip, CSS 130,790 raw / 26,137 gzip; E2E
under the flock: pack-shelf desktop + new 320px mobile spec, 8/8.

## Verdict (2026-11-03, on cured tip `9062a7f`)

Re-verification on the cured tip: Silo QA PASS (fresh clone, 10 of
10 cure items, 11 of 11 gates unpiped); panel re-vote 1 APPROVE /
11 APPROVE-WITH-NITS / 0 BLOCK; DevEx re-check PASS-WITH-NITS;
benchmark PASS (entry JS +0.36% raw / +0.30% gzip against main).
CI at verdict time on `9062a7f`: build (22.x) PASS, GitGuardian
PASS, e2e PASS; Workers Builds fails as on every tip and is not a
required check. The Boise and Addis Ababa hooks stand as ruled in
round 1; both texts are byte-identical on the cured tip.

This file's sync commit lands on top of the voted tip as a
records-only change; the panel vote, the QA ledger entry, and the
verdict all key to `9062a7f`. Remaining LOW nits from the re-vote
are follow-ups in the PR body and the verdict record, not cures.
The PR is at READY. Merge waits for the owner's per-PR word. If
PR #322 merges first, this branch rebases; the overlap is this
file only, and the panel re-votes only if that rebase touches code.

## Status

- [x] Integration clone created; branch cut at `193b57c`
- [x] Slice 1 merged (runtime core)
- [x] Slice 2 merged (capitals content)
- [x] Slice 3 merged (Cold Trail adapter)
- [x] Slice 4 merged (pack shelf)
- [x] Seams 1 to 6 resolved
- [x] Gates green on the integrated tree (validate-pack 72 of 72,
  composer deterministic apart from generatedAt, typecheck clean,
  worker tests 85 of 85, pack tests 85 of 85, lint-cards passed,
  build:pages exit 0, pack-shelf E2E 6 of 6 under the flock).
  Correction to this round-1 box: its "npm test exit 0" line was
  wrong — that reading came from a piped command whose exit code
  belonged to the pipe; the suite in fact failed on that tip (the
  two defects the cure then fixed). The corrected record is in the
  coordination ledger and the evidence folder.
- [x] Round-1 cure built (12 commits, gates above)
- [x] Silo QA pass on the final tip (`9062a7f`, re-check PASS)
- [x] Panel verdict on the final tip (re-vote: 0 BLOCK, READY)
- [x] DevEx recorded (re-check PASS-WITH-NITS)
- [x] Benchmark recorded (cured tip, PASS — see the verdict section)
- [x] PR open at READY (PR #323; merge waits for the owner's word)

# Prior record preserved on merge: share first tap (PR #305, fix/289-share-first-tap)

# Branch status — fix/289-share-first-tap

- **Branch:** `fix/289-share-first-tap`
- **Base:** `main` @ `2a0527f` (#295 merged)

## Task capsule

TASK / requested outcome: For issue #289 (Meridian issue-clearing wave,
PR W2) — find the true root cause of the swallowed first tap on the
summary's "Share score" button, fix it at the convicted layer, and earn
the removal of the `clickShareScoreWithRetry` mitigation from
`tests/e2e/endgame-share.spec.ts` (suite green on a single click in
repeated runs).

Tier and rationale: Tier 1 — one bug, clear repro, diagnosis-led; the
fix touches the two components the diagnosis convicted (summary
narration slot + narration first paint) plus the spec helper.

Done condition / evidence: swallow rate measured on unmodified main
first (instrumented probe, N=15, sealed logs); mechanism named from a
captured mid-tap event trace; after the fix, the same probe and the
real spec stay green on a single click in repeated runs (same N);
neighbour specs green; unit + typecheck + lint-cards green;
BRANCH_STATUS + PR with the diagnosis story. NO MERGE — merging is the
owner's step.

DEVIATION (labelled on the panel's request, PR #305 round 1): the
after-fix probe ran at N=5, not the same N=15 — the VM egress outage
(ERR_TUNNEL_CONNECTION_FAILED on the spec's console check, reproduced
identically on unmodified main) plus timebox cut the local runs. The
6.7% baseline is an existence proof from the probe, not a population
estimate, and 0/5 does not statistically exclude it; the verdict rests
on the deterministic mechanism proof (captured mid-tap trace +
constant-Y trajectory), the independent Silo QA reproduction, and CI
e2e green on the tip — not on the 0/5 count.

Files in scope: `src/components/run-summary.tsx`,
`src/components/storyteller.tsx`, `tests/e2e/endgame-share.spec.ts`,
this file. Out of scope: the share path itself (`share-action.ts`,
`share-button.tsx` — proven sound), any other narration host's
behaviour beyond the first-paint seeding (which only restores its
documented "caption text appears instantly" intent).

## Diagnosis (sealed: `~/workspace/meridian-issue-wave/evidence/289/`)

- Baseline on unmodified main `2a0527f`: instrumented single-click
  probe ×15 — **1 swallowed (6.7%)**, 14 effected
  (`probe-baseline-*.log`, `baseline-tally.txt`). The original spec
  cannot show this rate: its retry helper masks first-click losses.
- The swallowed run (04) is captured end-to-end: at click time the
  lazy Storyteller narration had not yet mounted (no caption in the
  dialog); `pointerdown` hit "Share score", then within ~5 ms the
  narration chunk mounted its caption ABOVE the buttons, pushing the
  button out from under the pointer; `pointerup`/`click` therefore
  landed on the summary card, so the button's handler never ran
  (`__shareCalls` stayed 0, label stayed "Share score" — the exact
  reported symptom). A click whose pointerdown/up targets differ
  fires on their common ancestor, not on the button.
- Second contributor, measured by a 4 s layout trajectory probe
  (`probe-traj-*.log`): even after the chunk mounts, the caption
  painted EMPTY (22px, text length 0 — its words lived in a ref set
  by the mount effect) and popped to full height (61px) at the first
  reveal tick ~260 ms later, moving the buttons a second time.
- Ruled out: the share path (sound — calls reach 1 whenever the
  handler runs), hydration (summary mounts long after boot), inert /
  settle choreography on the summary (none gates these buttons), an
  overlay intercepting (event trace shows the click target was the
  card itself after the shift, never an overlay), late CSS (computed
  styles at first caption paint were already the styled values).

## Fix

- `run-summary.tsx`: the narration's `Suspense` fallback now reserves
  the caption's box — the same summary line rendered invisibly
  (`aria-hidden`) with the caption's exact box metrics (max-width,
  padding, border, banner text size/line-height/balance wrap) — so
  the chunk's late mount swaps into identical space and nothing below
  it moves, at any viewport width.
- `storyteller.tsx`: `wordsRef` is seeded with the line's words at
  first render instead of starting empty (the mount effect still
  re-seeds the same split). The caption's first paint now carries the
  full line, eliminating the empty→full pop for every narration host.
- `endgame-share.spec.ts`: `clickShareScoreWithRetry` replaced by a
  single click (`clickShareScore`); every exact assertion (exactly 1
  call, exact payload, "Shared ✓", clipboard sentinel intact) is
  unchanged and still gates the outcome. No assertion weakened.

## Evidence (sealed: `~/workspace/meridian-issue-wave/evidence/289/`)

- [x] Diagnosis on unmodified main: probe ×15, 1 swallowed, with the
  mid-tap event trace (`probe-baseline-04.log`)
- [x] Trajectory probe: button Y constant for 4 s after the summary
  opens on the fixed build (`probe-traj-after3.log`)
- [x] After-fix probe ×5: **5/5 EFFECTED, 0 swallowed**
  (`probe-after-summary.txt`)
- [x] Endgame-share spec, single click: share assertions pass in every
  after-fix run; one run's clipboard test fully green incl. clean
  console (`spec-final-1.log`). Remaining runs fail ONLY at
  `expectCleanConsole` on `ERR_TUNNEL_CONNECTION_FAILED` (external
  telemetry/contact fetches via the VM egress proxy) — the control
  run on unmodified main fails identically (`spec-control-main.log`),
  so this is an environment outage, not the change. CI on the tip is
  the canonical full-suite check.
- [x] Neighbours: storyteller spec **6/6 green**; session-score 5/8 —
  its 3 failures are pre-existing/main-known (idle-kill strict-mode =
  #296 per the wave PLAN; share-text expects the Workers origin on a
  Pages build; HUD toggle blocked by a by-design celebration
  overlay). Its two end-game summary tests pass.
- [x] Unit suite (861 + 1879 tests, 0 fail), typecheck, lint-cards —
  all green (`unit-after.*`, `typecheck-after.*`, `lint-cards-after.*`);
  build:pages green (`build-after3.*`)
- [x] Redundancy audit: `redundancy-audit.log` — one share entry
  point (`ShareButton` → `shareScore`); the fix adds no second path
  (the placeholder is invisible, aria-hidden, non-interactive)

## Status

- [x] Diagnosis reproduced, mechanism convicted, sealed
- [x] Fix at the convicted layers (narration slot + first paint)
- [x] Retry helper replaced by a single click
- [x] Repeated runs sealed (probe 5/5; spec share assertions green in
  every run — see the environment caveat in Evidence)
- [x] PR opened against main: **#305** (For #289)
- [x] Silo QA (clean context, independent): PASS on `22a8d36`
  (evidence/289/qa-silo/)
- [x] Panel round 1 on `22a8d36`: 1 APPROVE / 11 AWN / 0 BLOCK, DevEx
  PASS-WITH-NITS — cure applied for the convergent metric-drift nit
  (Architect MEDIUM + 5 seats): a KEEP IN SYNC warning now sits in the
  fallback comment in `run-summary.tsx`, and the probe-N deviation is
  labelled above. Dismiss/failure-growth shifts tracked in #306.
- [ ] Silo QA re-verification on the cured tip (a new commit voids the
  `22a8d36` QA entry) — coordinator
- [ ] Panel re-vote on the cured tip — coordinator
- [ ] Merge — owner's explicit per-PR word only

## Observed, not fixed (tracked in #306)

- The caption's designed auto-dismiss (after audio ends / text-only
  hold) still collapses its height seconds later, which moves the
  buttons then. That window opens only after a first gesture has
  started the narration, so it cannot eat the FIRST tap; changing the
  dismiss visuals is a design call, not part of #289's fix. Filed as
  issue #306 at the panel's request, together with the audio-failure
  caption-growth facet the Level Architect seat found.

---

# Prior record preserved on merge: reserve caption slot (PR #310, fix/306-reserve-caption-slot)

PR #310 was stacked on #305's `db381cc`. Its own commits (`793579a`,
`20c5996`, `a08a2a5`) changed only `src/` and `tests/`; the branch's
BRANCH_STATUS.md record at `a08a2a5` was #305's record, unchanged and
byte-identical to the "share first tap (PR #305)" section above, so it
is not repeated here. Merged with `main` @ `534e963` (#305 squash-merged)
to bring #310 up to date without a force-push.

---

# Prior record preserved on merge: idle-kill locators (PR #307, fix/303-idle-kill-locators)

# Branch status — fix/303-idle-kill-locators

- **Branch:** `fix/303-idle-kill-locators`
- **Base:** `main` @ `2a0527f` (#295 merged; tip re-read from origin at build start, 2026-11-02)

## Task capsule

TASK / requested outcome: For issue #303 (Meridian issue-clearing wave,
Wave 2 pilot) — the two E2E specs that still use the bare
`page.getByText("Your game ended after 2 minutes of inactivity.")`
idle-kill lookup get the same scoped-locator cure PR #302 applied for
#296, IF they hit the same collision. Open the PR. Test-only fix;
product code does not change.

Interpretations considered and selected reading: issue #303's own
step 1 governs — reproduce first on unmodified main; if a spec
collides, scope it; if it passes, record why instead of changing it.
Both specs' idle-kill flows go through the in-page idle kill
(`killIdleSession` in `src/components/game-app.tsx`), which sets the
discarded notice (reason "inactivity") — the code path whose sr-only
announcer duplicates the visible card's text — so a collision is
expected in both; the sealed solo runs below are the proof, not this
reasoning.

Tier and rationale: Tier 1 — one known defect pattern, two spec files,
clear repro inherited from #296 / PR #302.

Done condition / evidence: before-runs of both specs' idle-kill tests
sealed on unmodified main; after the fix both full spec files pass
solo; all repo gates sealed (tsc · npm test · test:worker ·
lint-cards · build:pages); PR opened against main. NO MERGE, no QA
silo, no panel in this stage — those are separate coordinator stages.

Files in scope: `tests/e2e/scout-false-demotion.desktop.spec.ts` +
`tests/e2e/session-score.spec.ts` (one locator each) + this file.
Out of scope (FORBIDDEN): product code, PR #302's spec and branch
(frozen), any other PR, branch protection.

## What changed and why

- Both specs DID collide — reproduced solo on unmodified main, each
  with #296's exact strict-mode signature (bare lookup resolves to 2
  elements: the sr-only `discarded-notice-announcer` + the visible
  `discarded-notice` card's paragraph). Both flows use the in-page
  idle kill, which sets the discarded notice (reason "inactivity").
- Fix, identical in form to PR #302's cure: scope each lookup into
  the visible card —
  `page.getByTestId("discarded-notice").getByText("Your game ended after 2 minutes of inactivity.")`
  — plus the same in-spec comment recording why it is scoped.
  No `.first()` band-aid, no assertion weakened, no timeout changed
  (both specs keep their original default `toBeVisible()` wait).

## Evidence (sealed: `~/workspace/meridian-issue-wave/evidence/303/`)

- [x] Diagnosis on unmodified main: `build-pages-before` exit 0;
  `e2e-before-scout-false-demotion` exit 1 and
  `e2e-before-session-score` exit 1 — each idle-kill test fails with
  the strict-mode signature above.
- [x] Gates on the fix tip: `tsc` 0 · `npm-test` 0 (scripts 850 pass
  / 11 skipped; src 1879/1879) · `test-worker` 0 (85/85) ·
  `lint-cards` 0 (GATE PASSED) · `build-pages` 0.
- [x] E2E after: scout-false-demotion full file **3 passed**, exit 0.
  session-score full file **6 passed / 2 failed**, exit 1 — the cured
  idle-timeout test passes; the 2 failures (`:77` HUD toggle —
  celebration overlay intercepts the click; `:509` share text — the
  spec's hardcoded Workers origin vs the Pages build's origin) are in
  tests this diff does not touch and BOTH reproduce on unmodified
  main with the same signatures (`e2e-control-main-session-score`,
  exit 1; `:509` solo on this branch fails with the identical origin
  mismatch, `e2e-after-session-score-share-solo`, exit 1) =
  pre-existing, not regressions.
- [x] Redundancy / other-instances grep: `redundancy-grep.log` — the
  only other bare instance on main is #296's own spec (fixed on the
  frozen PR #302 branch; untouched here).

## Status

- [x] Branch off current main (`2a0527f`, re-read); coordination ledger heartbeat posted
- [x] Diagnosis reproduced solo on unmodified main (both specs)
- [x] Scoped locator fix, consistent with PR #302's cure
- [x] Gates sealed (tsc · unit · worker · lint-cards · build:pages)
- [x] E2E after-fix solo runs sealed (both full spec files + main control)
- [x] PR opened against main (For #303)
- [ ] QA silo + panel — separate coordinator stages (not run here)
- [ ] Merge — owner's explicit per-PR word only

---

# Prior record preserved on merge: security.txt expiry (PR #299, chore/224-security-txt-renewal)

# Branch status — chore/224-security-txt-renewal

- **Branch:** `chore/224-security-txt-renewal`
- **Base:** `main` @ `2a0527f` (#295 merged)

## Task capsule

TASK / requested outcome: For #224 (Meridian issue-clearing wave,
PR W3) — renew `public/.well-known/security.txt` by setting a fresh
`Expires`, prove the backstop test passes, and open the PR.

Tier and rationale: Tier 0 — config / discovery file, one line, no
locked or owner-approved copy changed.

Done condition / evidence: `Expires` is `2027-11-01T00:00:00.000Z`;
both `Contact` lines byte-identical to main; `node --test
scripts/static-wellknown.test.mjs` green with sealed log + `.exit`
under `~/workspace/meridian-issue-wave/evidence/224/`; PR opened
against main. NO MERGE — merging is the owner's step.

Files in scope: `public/.well-known/security.txt` (one line) +
this file. Out of scope: everything else.

## What changed and why

- `Expires: 2027-10-01T00:00:00.000Z` →
  `Expires: 2027-11-01T00:00:00.000Z` — a fresh full year from this
  wave (2026-11-02), inside the backstop test's bound (in the future
  and at most one year / 366 days out) with margin.
- The file's own renewal comment names no date — it only says to
  renew `Expires` before it passes — so no comment change was needed.
  Verified: the old date `2027-10-01` occurred only on the Expires line.
- Both Contact lines are unchanged, byte-identical:
  `https://meridian.knowledgetest.workers.dev/contact` and
  `https://github.com/veeresh-bikkaneti/Meridian/security/advisories/new`.

## Contact-channel verification (2026-11-02)

- [x] `GET https://meridian.knowledgetest.workers.dev/contact` →
  HTTP 200 — re-run by this build crew on 2026-11-02.
- [x] GitHub private vulnerability reporting → enabled — API-verified
  by the coordinator on 2026-11-02 (cited, not re-derived here).

## Next renewal expectation

- **Renew before `2027-11-01T00:00:00.000Z`.** That is the new expiry
  set by this PR; the backstop test
  (`scripts/static-wellknown.test.mjs`) fails once it is in the past
  or more than a year out, so the next renewal should set a date
  within one year of that renewal run.

## Evidence (sealed: `~/workspace/meridian-issue-wave/evidence/224/`)

- [x] Gate: `static-wellknown.log` / `static-wellknown.exit` (=0) —
  `node --test scripts/static-wellknown.test.mjs` green.

## Redundancy audit

- One file, one line: `security.txt` is the single RFC 9116 discovery
  file; this renewal adds no duplicate path, control, or entry point.
  PASS.

## Status

- [x] Expires renewed to 2027-11-01T00:00:00.000Z
- [x] Contact lines verified unchanged; /contact re-checked (HTTP 200, 2026-11-02)
- [x] Backstop test green, sealed
- [x] PR opened against main (For #224, not closing it)
- [ ] Panel review — separate stage, run by the coordinator
- [ ] Merge — owner's explicit per-PR word only
- [ ] Next renewal — before 2027-11-01T00:00:00.000Z (see above)
