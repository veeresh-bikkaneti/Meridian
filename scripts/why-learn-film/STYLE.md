# Home card film style: match this

Short version: the Home films are calm. Most of the frame sits still, one
thing moves at a time, and the loop never pops. Numbers below come from the
shipped files in `src/assets/home-v5/`.

How measured: each film was sampled at 8 fps, scaled to 240x135 gray, and the
share of pixels that changed by more than 12/255 between samples was counted
("moving share"). A "hold" is a run where under 0.5% of pixels change.
Contact sheets are in `.film-work/proof/style/`. All labels: [measured] or
[inferred].

Probe table [measured]:

| Film | Length | fps | Size | Bytes | Bitrate | CRF (from card-media.ts) |
|---|---|---|---|---|---|---|
| geodetective | 7.0 s | 25 | 1094x616 | 371,759 | 422 kbps | 35 |
| coldtrail | 12.0 s | 24 | 1094x616 | 389,320 | 257 kbps | 40 |
| review | 9.54 s | 24 | 800x538 | 179,821 | 148 kbps | 34 |
| journal | 7.92 s | 24 | 720x720 | 105,838 | 104 kbps | 38 |
| grownups | 6.04 s | 24 | 800x800 | 100,591 | 130 kbps | 34 |
| geodetective-locked (10 s) | 10.0 s | 24 | 1094x616 | 355,210 | 282 kbps | not recorded |

Heads up: only geodetective and coldtrail are 1094x616. The other three are
smaller or square, so "1094 wide" numbers for them are scaled up. Our new film
is 1094x616 and should look like coldtrail (the closest cousin: a lit
character walking, loop, 10 to 12 s).

## 1) How much moves vs stays still

Moving share, mean over the film (median in brackets) [measured]:

- geodetective: 33% (28%). This is a camera swoop from a top-down map to a
  desk, so the whole frame travels. Not a model for a locked camera. The last
  second is near still (0.5%).
- coldtrail: 8.6% (7.4%), never below 5%. Locked camera, snow drifting, one
  kid walking, one yeti walking. Busiest second is 13% (the turn).
- review: 5.4% (7.4%). Props slide on a still cream page. 68% of the time
  something moves, 32% is frozen on purpose.
- journal: 4.4% (4.4%), dead flat from start to end (3.8% to 5.0% in every
  second). A tree sways, light drifts, nothing else.
- grownups: 6.2% (7.3%). Two objects take turns. 83% of the time something
  moves.

Rule of thumb [inferred]: for a locked camera, aim for 5% to 9% moving share,
peak under 14%, and never two big movers at once.

## 2) Pose hold lengths

[measured] unless marked.

- Opening hold: review 0.9 s, grownups 0.5 s, coldtrail none (walks from
  frame 0), journal none.
- Between moves: grownups holds 0.25 to 0.33 s between the binocular lift and
  the hat tilt. Review holds 0.38 s on the "wrong" pose (the freeze at 4.75 s)
  and 0.38 s just before the rewind ends.
- Closing hold: review 1.25 s on frame 0 (the "rethink" pause). Geodetective
  about 1 s settled.
- Long moves: a single move runs 0.8 to 1.7 s, then a hold. Nothing moves
  faster than about 3% of the frame width per second [inferred].
- Handoff rule [inferred]: a pose that must read (the split, a glimpse) needs
  to hold at least 0.4 s. That matches the review wrong-pose hold, and the
  brief's 0.4 s window glimpses.

## 3) Easing and anticipation

[measured] from per-frame change at 24 fps.

- Grownups ramps in over about 7 frames (0.3 s) from still to plateau, holds a
  smooth plateau for about 0.5 s, then eases out over about 6 to 8 frames
  (0.25 to 0.35 s). That is a soft ease-in, ease-out. No snapping.
- Review is nearly linear: a flat 2.0 to 2.8 level for about 4 s, with a soft
  start (one 0.3 step frame) and an abrupt freeze. The rewind runs at 1.7x
  with alternating duplicate frames (it reads as a quick scrub, which is the
  point).
- Coldtrail: slow walk plateau at about 1.8, then a turn that builds to about
  5 over 8 frames and relaxes over about 12. Limbs lag the body.
- Anticipation is small and cheap [inferred from sheets]: the kid dips and
  leans (frames 0 to 1 s) before standing; binoculars drop an inch before they
  lift; the hat tips back before the flip. About 3 to 6 frames each. Keep
  overshoot under about 5% of object size, and settle within 0.3 s.
- No bounce, no squash and stretch, no shake. Calm.

## 4) Line weight and texture (px at 1094 wide)

[measured] with a "dark line vs local average" run-length test.

- Outline median 4 px (quarter to three-quarter range 2 to 6 px, 90th percentile
  8 px). Coldtrail 4.0 px natively. The 720 to 800 px films measure 3 px
  natively, which is 4.1 to 4.6 px at 1094 wide.
- Lines are soft, ink-and-watercolor, not hard vector. Edges are anti-aliased
  and slightly wobbly [inferred from sheets].
- Texture: paper grain on cream backgrounds (review, journal, grownups); snow
  speckle and soft brush in coldtrail; film grain in geodetective.
- Thin detail (rope, strings, hat stitches) sits at 1 to 2 px and is the first
  thing the encoder eats. Keep story-critical lines at 4 px or more.
- Gold lens lines for our film [inferred]: draw them at 6 to 8 px with a soft
  glow, so they survive CRF 34 to 40 and a 390 px wide phone slot (that scales
  everything by 0.36, so a 6 px line becomes about 2 px).

## 5) Palette and light

Swatches are the most common colors in sampled frames (frequency in brackets).

Cream-paper films (review, journal, grownups) [measured]:
- #f4ede1 (paper, 40% to 61%)
- #cdb48e (sand), #ae936e (leather), #8e724f (brass shadow), #6d5232 (dark wood)
- Journal adds a sunset sky #ead2ae and olive foliage. Grownups adds accent
  blue #3d6fb0-ish lens glints (small, under 2% of pixels) [inferred].
- Warm 99% to 100% of pixels, cool 0%. Mean luma 195 to 218 (bright).

Coldtrail (night snow) [measured]:
- #8cbbf3 (snow light), #5196e6, #4c8ed6, #0d4f8f (deep shade)
- Accents: red hat, orange scarf, yellow torch beam, warm cabin window.
- Cool 91%, warm 7%. Mean luma 131. The warm accent is what the eye finds first.

Geodetective (map to dark desk) [measured]:
- #0b0b0c (night, 28%), #d0ac8f, #f1cda8 (lamp-lit paper), #302b2a
- Warm 59%, cool 6%, mean luma 87. Lamp warm against a blue night window.

Light rule [inferred]: one warm light source or one warm accent against a
quiet field. For our film: a bright cream-and-street day base, gold lines as
the only saturated warm thing inside the lens (#e8b84a-ish gold), the outside
world slightly desaturated. Keep text-free.

## 6) Loop method per film, and bitrate/CRF clues

- geodetective: no loop treatment. It opens and closes on different scenes.
  A cut reads as a replay. CRF 35, veryslow. Dark, grainy frames cost bytes.
- coldtrail: ping-pong. Forward 6 s, then the same frames reversed. Both joins
  are real frames, so no seam. CRF 40 to fit under 400 KB.
- review: loop-native. Last frame is frame 0. Plays, freezes 0.4 s on the
  wrong pose, rewinds at 1.7x, holds frame 0 for 1.3 s. CRF 34. Keyframes at
  0, 4.83, 5.25 and 8.17 s [measured], so freezes cost almost nothing.
- journal: last 0.8 s crossfaded into the first 0.8 s. CRF 38. Length stays
  7.9 s.
- grownups: same, with a 0.4 s crossfade. CRF 34.
- Encode recipe from card-media.ts: H.264, veryslow, no audio, faststart,
  CRF tuned between 34 and 40 until the file fits about 400 KB.
- Size clue [measured]: flat cartoon with moving snow needed about 257 kbps at
  CRF 40. Flat cream pages with props needed only 104 to 148 kbps at CRF 34 to
  38. A busy scene needs a higher CRF; a freeze-heavy one can afford a lower
  CRF (better quality).

## 7) "Match this" checklist for a new 10 s film

1. Locked camera, 24 fps, 1094x616, silent, H.264, under 400 KB.
2. Moving share about 5% to 9%, peak under 14%, never below 3% except in a
   planned hold.
3. One star mover at a time. The quiet character moves least.
4. Open with a 0.5 to 0.9 s hold, so the poster (frame 0) is a clean picture.
5. Every must-read beat holds at least 0.4 s. Close with a 0.5 to 1.2 s hold.
6. Ease in about 0.3 s, ease out 0.25 to 0.35 s, with a small 3 to 6 frame
   anticipation. No bounce or shake.
7. Outlines 4 px (2 to 6), soft ink and watercolor edges, paper grain. Story
   lines 4 px or heavier (gold lens lines 6 to 8 px).
8. Palette: cream base #f4ede1, brass and leather earth tones, one gold
   accent. About 90% or more of pixels warm, or a cool field with one warm
   accent.
9. Loop by returning to frame 0 (loop-native, as review does) or a 0.4 to 0.8 s
   crossfade (journal, grownups). Check frame 9.9 s vs 0.5 s: no pop.
10. Keep key action in x 20% to 80%, y 10% to 84%, because phones crop to
    object-fit: cover. Check the encoded file at 390 px wide, and
    center-cropped.
