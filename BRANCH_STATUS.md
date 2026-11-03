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
- [ ] Fade cure (Part 1) lands after this redo, from the owner's variant pick
- [ ] Panel re-vote on the final tip after the fade cure
