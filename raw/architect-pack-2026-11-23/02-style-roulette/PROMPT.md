# 02 — Per-episode style roulette (explainer series format)

## Intent (one line)
From episode 2 onward, each explainer film draws a random visual style from the owner's Instagram boards, so the series never looks the same twice.

## Why (origin)
Owner's series-format direction, set 2026-11-19/20 alongside the explainer pipeline: styles named from his boards — paper cutout, watercolor, low-poly 3D, comic, pixel art, anime, vintage engraving — with real camera language per episode. The Moon sample (episode 1) keeps the game's own 3D look and is the exception.

## Scope IN
- A style field per episode (already in the template's `episode.json`), a defined style roster, and a per-style production recipe (assets, camera moves, typography).
- Random draw per episode, recorded so an episode's style is reproducible.

## Scope OUT
- Producing any episode before item 01 (the acting bar) is resolved — the roulette is a format layer on top of a format that is currently rejected at collage quality.
- Inventing new styles not traceable to the owner's boards.

## Locked decisions
- Episode 1 (Moon) = game 3D look; roulette starts at episode 2.
- 14 camera-move presets already exist in the template (`cameraMoves.js`): DollyIn/Out, Settle, Drift, LowArcAround, BackwardOrbit, Close-up, SnapZoom, Crane, SnapCrane, Tilt, PendulumSwing, Ground-Skim, FPV.

## Acceptance criteria
- Each roster style has a one-page recipe an episode builder can follow without improvising the look.
- A style draw is logged in the episode's data before production starts.

## Assets & related work (in this folder)
- `episode.json` — shows the style-roulette field as implemented for the Moon episode.
- `TEMPLATE-STATUS.md` — template state and limits. Full template: `~/workspace/explainer-videos/`.

## Open questions for the architect
1. Is a per-episode style lottery good series design for a kids' learning product, or does it fight brand recognition? Where is the line?
2. Which of the named styles are actually producible with the local pipeline, and which are fantasy?
3. Should the draw be pure random, or weighted/curated per topic?

## Status & evidence
- Designed and represented in the template (2026-11-20); zero episodes produced under it. Fully gated by item 01 and the owner's direction pick.
