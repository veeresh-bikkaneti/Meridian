# BRANCH_STATUS — fix/og-image-156 → issue #156

**Issue:** [#156](https://github.com/veeresh-bikkaneti/Meridian/issues/156) —
the share image `public/og.jpg` (the picture chat apps show when the game
link is shared) still read "MERIDIAN / FIVE PLACES", but the game is
endless now, so the preview misdescribed it.

**Owner's pick (Veeresh, 2026-10-20): Candidate B** — "gold repaint,
slogan added." Two candidates were produced for the pick (rendered by
script from the game's own Natural Earth map data, so the continents are
geographically true and the lettering is exact); the owner chose B: gold
continents with a warm lamp-lit glow on deep green, the MERIDIAN
wordmark, the owner's slogan as the only secondary text, one gold pin.
Neither candidate mentions any number of places.

**Base:** `origin/main` @ `84ac861`.

## What changed

1. **`public/og.jpg`** — replaced with Candidate B's bytes, byte for
   byte. md5 `d96d16300c8f420f2868a0406e8e0cc2` (135,153 bytes), verified
   1200×630 JPEG after the copy — and the built artifact
   (`dist/client/og.jpg`) carries the identical checksum.
2. **`src/lib/og/share-meta.ts`** — `SHARE_IMAGE_ALT` now describes B,
   slogan included: "The word Meridian and the line 'Explore the world,
   one pin at a time—where every guess unlocks a new story' over a dark
   green and gold world map with a gold location pin."
3. **`scripts/share-card-built.test.mjs`** — the matching `SHARE_IMAGE_ALT`
   constant updated to the same text (the issue names both places).
   One extra one-line fix in the same file, found by running the built
   check below: the test's HTML-entity decoder knew `&#39;` but not
   `&#x27;`, which is the form the built shell actually emits for an
   apostrophe. The old alt had no apostrophes, so the gap was invisible
   until this alt added two. The decoder now accepts both forms; the
   expected value itself is unchanged.

Nothing else changed — the share tags already point at `/og.jpg` and
declare 1200×630, so no tag or code change was needed.

## Gates (this branch, 2026-10-20)

- `npx tsc --noEmit` — clean
- `npm test` — scripts suite 799 tests (790 pass / 9 skipped / 0 fail);
  src suite **1358 pass / 0 fail**. Targeted: `share-meta.test.ts` 7/7
  (it asserts the image is a 1200×630 JPEG and the alt matches).
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green
- Built-artifact check (opt-in, beyond the default suites):
  `SHARE_CARD_BUILT=pages node --test scripts/share-card-built.test.mjs`
  — **passes**: the built Pages shell carries all 12 share tags exactly
  once, with the new alt text.

## Pending

1. Owner's merge word. Nobody merges — the PR merges only on the owner's
   explicit word.
2. After deploy: chat apps cache share previews; refresh via each app's
   debugger or a query string if the old card lingers (issue's note).
