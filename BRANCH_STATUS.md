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
- [x] Part 2: settling motion on the three `.hv5-art` cards
- [x] Unit tests, typecheck, lint-cards, production build
- [x] Byte deltas and zero-CLS measurements vs main
- [x] E2E home set under the flock (two specs fail identically
      on main; see Gates)
- [x] Visual captures (videos + settle stills)
- [x] Docs (README + card-media comments) and PR body
- [ ] PR opened; stop at READY (no merge)
