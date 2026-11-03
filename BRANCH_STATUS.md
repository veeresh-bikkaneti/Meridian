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
  frame 0 by construction. 9.417 s, 800x538, CRF 34, 179,821
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
- mobile-home-overlap: 20 passed / 6 failed, against the
  recorded unmodified-main baseline in this VM of 6 passed /
  20 failed (Part 2 redo round). The Review-card overlap tests
  inside it pass. The six failures sit in the recorded
  environment family (coffee-run strip on desktop and mobile,
  the recorded main failure; narrow-scout sheets; two journal
  section geometry checks at single widths).
- Grandpa tour: 5 passed / 20 failed in this VM. The standing
  record for this spec in this VM is failure on unmodified main
  too (4 passed / 21 failed in the Part 2 redo round, the tour
  element never appearing). This run's pass count is one above
  that baseline. Tooling caveat, recorded honestly: Playwright
  test discovery in this VM proved unstable during this round
  (repeated --list runs returned 1430, then 0, then 0 tests,
  and one run's title list did not match the spec file on
  disk), so the tour result is reported as UNVERIFIED here,
  not as a pass and not as a branch regression. The QA silo
  should re-run the tour in a clean environment.
- Zero copy changes in the rework: game-app.tsx moves three
  CardFilm elements and nothing else; LockedLoop, the verdict
  clip component, game screens, and pack code untouched.

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
- [ ] QA silo verification of the rework tip (incl. a clean-
      environment Grandpa tour run; see the tooling caveat in
      the rework gates above)
- [ ] Panel re-vote on the final tip after QA
