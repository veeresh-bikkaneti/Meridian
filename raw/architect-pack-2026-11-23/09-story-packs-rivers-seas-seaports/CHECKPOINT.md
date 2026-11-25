# CHECKPOINT — Next story packs mockups (Rivers · Seas & Oceans · Famous Seaports)

Owner order 2026-11-03 21:21 CST: mockups first, owner approves design, THEN build.
This run = mockups + design note ONLY. No repo branch, no PR, no content build.

## Grounding [observed]
- Style source: main-based clone ~/workspace/meridian-regate (tree = main 775d8b4 + #312 specs).
- Tokens from src/styles.css: --atlas-brass #e8b64c, --atlas-ink #f0e7d2, --atlas-muted #9db3ad,
  --atlas-card rgba(16,34,42,.66), --atlas-card-line rgba(232,182,76,.22), --map-answer #f2c14e,
  --map-water #10262e, --map-land #3c4a3c, --map-park #1f4d36, --map-river #3c8496.
- .name-eyebrow: Space Mono, 11px, uppercase, letter-spacing .14em, brass.
- Shelf (src/components/pack-shelf.tsx): chips = glyph + label + progress line; packs carry ★;
  core chip 📁 "All cases"; capitals 🏛️ (pack-shelf-data.ts CATEGORY_LABELS).
- Briefing pattern (src/game/loop/packs.ts packBriefingText, Direction A):
  "Your case: find the capital of {given}."
- GeoDetective clues: 5 tiers Geography / Climate / History / The Hook / Giveaway (LoopScreen.tsx).
- Cold Trail pack case (cases.capitals.generated.json): hideout point + 3 sightings
  (witness city, radiusKm, octant, "Last seen … X km <octant> of <city>"), packId.
- Shipped Cold Trail framing copy (PR #322): "Jolly was spotted in the snow. Three sightings,
  three rings — tap where they cross to reach Jolly before the trail freezes."

## Screens (screens/, .html + .png, 390px wide) — ALL DONE
- [x] 01-shelf — GeoDetective entry + Case decks shelf: All cases / Capitals / Rivers /
      Seas & Oceans / Famous Seaports chips
- [x] 02-geodetective-rivers — Nile mouth case
- [x] 03-geodetective-seas — Santorini, Aegean Sea case
- [x] 04-geodetective-seaports — Singapore case
- [x] 05-coldtrail-rivers — Jolly hideout at the Nile mouth (Rosetta)
- [x] 06-coldtrail-seas — Jolly hideout at Santorini
- [x] 07-coldtrail-seaports — Jolly hideout at Rotterdam

Rendered with Playwright chromium-1243, viewport 390px, full-page PNGs.
Visually verified by the coordinator: 01 (shelf), 02 (rivers case), 05 (Cold Trail
rivers) — all read in the shipped visual language. Maps are stylised SVG panels
using the repo's map tokens, standing in for the real satellite map.

## Design note
- [x] DESIGN-NOTE.md — per-pack target semantics, clue rule, 3 example cases each,
      deck-size sketch, seaport-migration question (owner decision, NOT decided here),
      point-target honesty verdict per pack.

## Stop line
STOP at mockups + note. Build is a separate dispatch after the owner's design approval.
