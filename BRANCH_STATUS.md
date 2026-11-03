# Branch status — fix/267-reload-reveal-units

- **Branch:** `fix/267-reload-reveal-units`
- **Base:** `main` @ `2a0527f` (#295 merged)

## Task capsule

TASK / requested outcome: For issue #267 (Meridian issue-clearing wave,
PR W1) — make `tests/e2e/reload-reveal.desktop.spec.ts` pass on current
main by fixing its stale distance-unit expectation, prove it with a green
solo E2E run, and open the PR. Test-only fix; product code does not change.

Tier and rationale: Tier 1 — one bug, one file, clear repro (diagnosis
below matched the predicted failure signature exactly).

Done condition / evidence: diagnosis reproduced on unmodified main
(1 failed / 2 passed, the failure being the headline regex); after the
fix the same spec solo = 3/3 pass; mutation proof sealed; PR opened
against main. NO MERGE — merging is the owner's step.

Files in scope: `tests/e2e/reload-reveal.desktop.spec.ts` (one line) +
this file. Out of scope: product code, `.github/workflows/` (CI e2e list
surface is owned by open PR #265; whether this spec joins the CI list is
the owner's separate call, per the wave brief for #267).

## What changed and why

- The miss-headline regex at spec:87 accepted only metric units:
  `(km|m)`. The product renders miles for en-US players (per issue #267,
  since PR #138), so the diagnosis run's headline —
  `"Result: 110 mi northwest of your pin"` — could never match.
- Fix: `(km|m)` → `(km|mi|m)`. "mi" is ordered before "m" so miles match
  before metres. Every other assertion in the file is untouched. The
  test's intent is to prove the result card re-renders after a mid-reveal
  reload, not to prove the unit.

## Evidence (sealed: `~/workspace/meridian-issue-wave/evidence/267/`)

- [x] Diagnosis on unmodified main: `build-pages-diagnosis.log` /
  `.exit` (=0); `e2e-before.log` / `e2e-before.exit` (=1) —
  **1 failed, 2 passed**; the single failure is the headline regex
  (`Expected pattern: /(km|m)/`, received `"Result: 110 mi northwest of your pin"`).
- [x] After the fix: `e2e-after.log` / `e2e-after.exit` (=0) — **3 passed**.
- [x] Mutation proof: `mutation-unit.log` / `mutation-unit.exit` (=0) —
  unit-level regex check against the actual received headline string from
  the sealed diagnosis log: the old `(km|m)` regex fails it, the new
  regex passes it (and still passes km and m headlines).
- [x] Redundancy audit: `redundancy-grep.log` — grep for `miss-headline`
  and `of your pin` across `tests/e2e/`. This test's rehydration
  expectation lives at one site (this spec, line 87); the fix adds no
  duplicate. Similar pre-existing headline patterns in other specs are
  separate surfaces, untouched by this PR and outside #267's scope.

## Status

- [x] Diagnosis reproduced and sealed
- [x] One-line regex fix
- [x] Solo E2E green (3/3), sealed
- [x] Mutation proof sealed
- [x] PR opened against main (linked to #267, not closing it)
- [ ] Panel review — separate stage, run by the coordinator
- [ ] Merge — owner's explicit per-PR word only

## Cure — 2026-11-03

- Owner order: "Cure 297 and merge. Obviously we dont want messy code going into main" (Veeresh, 2026-11-03 16:10 CST).
- Spec cure (two changes in `tests/e2e/reload-reveal.desktop.spec.ts`):
  - Why-comment added above the headline assertion: the unit follows the player's region (US players see miles, since PR #138), so the pattern accepts every unit the headline can print; this spec proves the headline re-renders after a reload — not the unit.
  - Canonical pattern: the regex alternation is now `(km|mi|m|ft)`, the canonical form from `reveal-bearing.desktop.spec.ts`. `ft` is consistency only — it is unreachable for a miss headline (ft prints only under 1 mi; a miss is beyond the hit radius) — adopting it is not a behaviour fix.
- Records fix: the diagnosis evidence bullet above now quotes the full headline with its "Result: " prefix — received `"Result: 110 mi northwest of your pin"`.
- The cured tip goes back for a panel re-vote before merging (standing rule).

---

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

## Verdict — READY (2026-11-03, coordinator close-out)

- Clean Silo QA on `3aadb19`: PASS, zero product defects (gates all
  green; combined E2E 68/68 incl. Grandpa tour 25/25; behaviour
  probes green; GeoDetective film hash-identical to main's).
- 12-role panel on `3aadb19`: PASS WITH CONDITIONS — (1) PR body
  rewritten to the final tip, (2) owner eye-test on the full 9.54 s
  Review film, (3) silo QA on the final tip. UX Researcher dissent
  on the autoloop tradeoff recorded in the PR body, not a block.
- Rebase onto main `5dc21b9`: one conflict (this file), resolved
  preserve-both; diff excluding this file byte-identical
  (SHA-256 match + blob hashes, verified by the panel itself).
- Re-QA on `97ee9ae`: PASS (gates green again; probes green; the
  three local card-redesign "Target crashed" failures reproduce
  identically on unmodified main — environment defect).
- Panel confirmation re-vote on `97ee9ae`: 12/12 PASS, 0 BLOCK;
  dissent re-attested.
- CI on `97ee9ae`: build (22.x) pass, e2e pass, GitGuardian pass.
  Workers Builds fails, as on every tip; not a required check.
- PR body rewritten from the audited draft and read back
  (condition 1 closed). Condition 2 is the owner's eye-test,
  staged in the coordinator's final report with the full Review
  film and the 4.8 s settled-wrong frame.
- Benchmark vs base: entry JS +119 B raw, CSS +407 B raw;
  dist delta fully decomposed (films + posters + entry).
- Hover-wave: FAILED the identity bar (section in PR body);
  no wave code built; owner's pick among 4 options is pending.
- State: READY. No merge without the owner's per-PR word.
  (This entry is a docs-only commit on top of the panel-approved
  tip `97ee9ae`.)

---

# Prior records preserved on rebase onto 5dc21b9 (2026-11-03)

Main's `BRANCH_STATUS.md` at `5dc21b9`, verbatim below: the Cold
Trail card-copy record (PR #322) followed by the records main
already preserved for the capitals pack (PR #323), share first tap
(PR #305), reserve caption slot (PR #310), idle-kill locators
(PR #307), and security.txt expiry (PR #299).

# BRANCH_STATUS — fix/coldtrail-card-copy
- 2026-11-03: merge-up onto main `a8ee341` (#309 + #328) at the owner's merge word. Sole conflict BRANCH_STATUS.md, resolved keeping both records; the PR's app diff is unchanged from the panel-approved tip `97ee9ae` / READY tip `a442307`. Checks re-read on the new tip before merging.

---

# BRANCH_STATUS — feat/band-motion-locked-tile
