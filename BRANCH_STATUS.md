# BRANCH_STATUS — feat/journal-storybook-art

Wave 1 of the journal storybook-art feature (owner-requested via /bug, 2026-10-16).
**DO NOT MERGE — owner merges on his explicit per-PR word only.**

## What this branch does
- Journal notes gain an OPTIONAL `image` (path under `public/`) + `imageAlt` field.
- The journal section of the home page renders the drawing ABOVE the note
  title when present (`figure.hv5-entry-art > img`, `loading="lazy"`,
  `decoding="async"`). Notes without art render exactly as before.
- Image URLs go through the same `assetBase()` seam the storyteller audio
  URLs use (`journalImageUrl()` in `home-journal.ts`; `assetBase()` newly
  exported from `storyteller-lines.ts`) — never a hardcoded deploy path.
- CSS: full card width, `aspect-ratio: 3/2` + `object-fit: cover` (no layout
  shift), `border-radius: 16px` (inside the 24px card), 12px bottom margin.
- Wave 1 ships 3 drawings: `taj`, `opera-house`, `redeemer`
  (`public/images/journal/*.webp`, 1200x800 q80, 125–164 KB each).

## Owner decisions (Veeresh, 2026-10-16, his words in quotes)
- **"Journey" = the Journal** (home journal), not the tasting tour (2026-10-16 19:39 CDT).
- Each journal note gets a contextual drawing as a visual aid (his /bug ask).
- **Drawings over photos** (his tap, 2026-10-16 19:39 CDT — over the
  Wikimedia Commons real-photos option).
- **Style approved: "Love the ones you generated"** (2026-10-16 19:41 CDT)
  — warm storybook watercolor, cream/brown/gold, consistent across the set.

## Art-direction prompt template (recorded verbatim for future waves)
"Children's storybook illustration of <SUBJECT + the note's story details>.
Warm gouache and watercolor picture-book style, soft cream and warm brown
palette with gentle gold light, friendly and calm mood, wide landscape
composition, no text, no words, no letters anywhere in the image."
Production recipe: ffmpeg resize max width 1200 (keep aspect), webp q80,
must stay under 200 KB. Sample full-size sources live in
`~/workspace/journal-art-samples/` (not committed).

## Done
- [x] 3 sample drawings generated, owner-approved by eye
- [x] Asset conversion + ffprobe decode verification (taj 134566 B,
      opera-house 125076 B, redeemer 163992 B)
- [x] Data model + 3 notes wired; render + CSS
- [x] Unit tests (alt/path/file + journalImageUrl seam)
- [x] E2E spec `tests/e2e/journal-art.desktop.spec.ts` (window-agnostic,
      390px overflow check) — PASS
- [x] Screenshots: `~/workspace/bench-wt/journal-art-shots/`
      (journal-mobile.png, journal-desktop.png — real 2h window with art;
      journal-art-desktop.png — forced clock to the taj/opera-house/redeemer
      window, titles asserted)
- [x] storyteller-tapstart.desktop.spec.ts (existing home spec) — see below

## Pending
- [ ] Owner merge word (DO NOT MERGE without his explicit word)
- [ ] Waves 2+: remaining 103 notes need drawings in the same template,
      each batch eyeballed before landing (wave-by-wave delivery)

## Gate results (2026-10-16, branch head d413964+)
- `npx tsc --noEmit` → clean
- `npm test` → scripts: 778 tests / 769 pass / 0 fail; src: 1324 tests /
  1324 pass / 0 fail
- `node scripts/lint-cards.mjs` → GATE PASSED
- `npm run build:pages` → green (dist carries images/journal/*.webp)
- `journal-art.desktop.spec.ts` (desktop, --workers=1) → 1 passed
- `storyteller-tapstart.desktop.spec.ts` → 3 passed / 7 failed —
  the SAME 7 pre-existing failures baselined on unmodified main
  (Veeresh's "Not a regression" ruling, 2026-10-14; assigned to their own
  fix branch, out of scope here). Failures are `storyteller-narration`
  element-not-found in the game flow — untouched by this branch's
  journal-only render; the home page renders green per journal-art E2E.
