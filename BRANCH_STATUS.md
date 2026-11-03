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

## Status

- [x] Clone created; branch cut at `685a94f`
- [ ] Part 1: gradient fade on both film cards
- [ ] Part 2: settling motion on the three `.hv5-art` cards
- [ ] Unit tests, typecheck, lint-cards, production build
- [ ] Byte deltas and zero-CLS measurements vs main
- [ ] E2E home set under the flock
- [ ] Visual captures (videos + settle stills)
- [ ] Docs (README + card-media comments) and PR body
- [ ] PR opened; stop at READY (no merge)
