# BRANCH_STATUS — feat/storyteller-v2-2d

Owner: Mouad · Branch: `feat/storyteller-v2-2d` · Base: origin/main @ ce88939
· Created: 2026-10-10. **DO NOT MERGE — DO NOT INTEGRATE without owner design approval.**

Standing rules: named-file staging only, never `git add -A`. $0/offline/keyless —
hand-written SVG only, no raster, no AI image services. Meridian is an
educational game: no unverified claims; a behavior is not "implemented" until
a test walks its runtime path. Never chain sequential timers across React
state changes. Never merge — merging is the owner's decision.

## Phase 1 — DESIGN (done 2026-10-10, awaiting OWNER APPROVAL)

Owner spec (2026-10-10): (1) figure same height as full banner or bigger;
(2) crisp at any size — hand-built vector SVG, no raster; (3) built for
motion — 2D "Homer" Greek storyteller, layered for animation.

- **Sr Game Artist**: character design spec + complete hand-written SVG draft
  (`homer-v2-draft.svg`, 56 elements, 8 named groups: homer-wreath/head/eyes/
  jaw/torso/wave-arm/scroll-arm/legs; wreath nested in head). Well-formed XML
  verified; visually inspected via headless-Chromium renders (one real defect
  found and fixed: mustache read as second eyes). Palette: ink #0c181d, skin
  #f2c9a0, hair #f5f2ea, brass #e8b64c, chiton-blue #4f7296, cream #f3ecd9,
  paper #fffdf8, leaf #7d8b5f.
- **Game Designer**: `storyteller-v2-homer-brief.md` — "Homer, the map's
  mischievous grandfather"; 5 pose moments mapped to animation layers; kid
  appeal 5–13; EXPLICIT NO-CONFLICTS on all 4 owner rulings. Startle debounce
  + reduced-motion collapse flagged as acceptance criteria.
- **UI/UX**: banner integration spec — 104px mobile / 120px desktop, row grows
  to fit (option b rejected: overflow breaks popover + eyebrow), skeleton
  resized to match, popover CSS unchanged, hit area = art box, reduced-motion
  no concerns, exact 360px layout math (12.08px slack). Measured against the
  real banner (56px mobile / 76px desktop today).

Design package for owner: `~/workspace/your_files/meridian-storyteller-v2/`
(DESIGN.md, homer-v2-draft.svg, old-vs-new.png, previews, brief, spec).

## Pending (blocked on owner design approval)

- Phase 2 — Technical Artist: finalize layered SVG (tighten viewBox to ~96%
  art bleed so visible figure ≥100px in the 104px box).
- Phase 3 — Animate: CSS keyframes extending storyteller-home.css phase
  system (idle breath, talking bob, greeting wave, poke startle; ≤150ms fade
  under prefers-reduced-motion: reduce).
- Phase 4 — Integrate: replace storyteller.jpg in banner
  (storytellerFigureUrl / StorytellerMascot), remove circular mask, 104/120px,
  preserve all behavior (4 rulings, popover, sound toggle, poke lines).
- Phase 5 — Gates (tsc, npm test, lint-cards, build:pages, Playwright
  storyteller specs, screenshot verify) + open PR (never merge).
