# BRANCH_STATUS — feat/loading-orbs

**Branch:** `feat/loading-orbs`
**Base:** origin/main @ `ddb6d28` (PR #242 merged 2026-10-25 11:22 CDT)
**State: IMPLEMENTED, gates running — NOT pushed. Push is the Chair's call after panel review.**
**Remote branch:** does NOT exist yet (verified at build time).

This branch replaces the stale record that used to live here (old
card-redesign branch, base `28c5fea`, PR #242 OPEN). That record is
superseded: #242 is merged, and this branch starts from its merge.

## Scope (exactly this — owner-decided, no expansion)

- **1. Globe zone loading orb** (`src/components/home-globe.tsx` +
  `src/components/home-v5.css`): a HomeGlobe-INTERNAL placeholder. New
  `textured` state (default false), plumbed via an `onTextured` callback
  into `initGlobe` so `TextureLoader`'s onLoad fires it (existing
  colorSpace/anisotropy work kept). The orb overlay renders INSIDE the
  mount div while the texture is pending, then crossfades out (CSS
  opacity transition, unmounted on a single transitionend handler — no
  timer chains). The overlay is aria-hidden, pointer-events:none,
  absolutely positioned + centered, and covers the mount opaquely (hero
  gradient) so no black/faceted pre-texture frame shows through. The
  mount keeps its aspect-ratio box: no CLS.
- **2. Lazy card-image loading orbs** (`src/components/game-app.tsx`
  home page ONLY + new shared `src/components/lazy-home-image.tsx`):
  one wrapper rendering the same reused `.meridian-spinner` overlay
  centered over the image until onLoad fires, then the same
  fade-on-transitionend pattern. Used at exactly the six verified home
  lazy sites, each img's classes/src/alt/aria preserved exactly:
  GeoDetective `.hv5-pic` (desertRuinsUrl), Cold Trail `.hv5-pic`
  (patagoniaUrl), Review `.hv5-art` (archiveToolsUrl), journal teaser
  `.hv5-art` (journalTreeUrl), grown-ups `.hv5-art`
  (binocularsHatUrl), journal entry `.hv5-entry-art` figures
  (`journalImageUrl(note.image)`, alt kept as `note.imageAlt`). The
  wrapper carries the image's layout class, so card layout is
  unchanged. Cached images: complete && naturalWidth > 0 at mount
  skips the orb outright (no polling). On error the orb clears and
  current browser behavior applies — no error-fallback UI invented
  (that design ruling is still owed by the owner).
- **Visual correction applied:** there is NO dedicated "thinking orb"
  component in this codebase (BootSplash is text-only). Both orbs reuse
  the existing `.meridian-spinner` (border spinner, 900ms linear
  infinite; reduced-motion query kills the spin → static ring). No new
  multi-dot orb design was invented, no new image assets.

## Explicitly NOT touched

- The globe-zone `Suspense fallback={null}` in game-app.tsx (a fallback
  swap cannot cover the post-mount waterfall — forbidden, left alone).
- No eager three.js load; the 390px IntersectionObserver gate
  (rootMargin 200px) is unchanged — the placeholder shows when the zone
  is reached, not on first paint below the fold (expected, not a defect).
- Edition maps (Loading pill + Try-Again dialog + MapLoadingFallback),
  stories/storyteller, BootSplash, first-load/update orbs, and every
  other wait. No orbs anywhere else.
- Fallback paths unchanged: reduced-motion / Save-Data / low-memory /
  WebGL failure / import failure / texture onError all land on the
  existing static disc, with NO orb (the disc IS the content).
  Dispose/teardown leak-free: `disposed` flag guards all post-unmount
  setState.
- Reduced motion (standing law): placeholders are STATIC — overlays
  declare no animation of their own, and the spinner's existing
  reduced-motion media query kills the spin. The opacity transition is
  deliberately kept under reduced motion so the transitionend unmount
  still fires (a fade is not spinning motion, and killing the
  transition would strand the overlay in the DOM).
- No changes to #242's merged code beyond placeholder wiring. No
  refactoring of working code.

## Tests

- New `src/components/home-loading-orbs.test.ts` (16 tests, colocated
  per repo convention). No React-render/jsdom harness exists in this
  repo, so — following the `game-app-lazy-boundary.test.ts` precedent —
  the wiring is pinned by reading the source: orb shows initially, orb
  clears on load, orb clears on error, cached-complete shows no
  lingering orb, reduced-motion static variant, globe textured-state
  transition plumbing (three.js itself is NOT faked in unit tests).
- Globe visual transition coverage is owed by the test seat's E2E
  specs against the built app (stated explicitly, not faked here).

## Gates (all green, 2026-10-25)

- `npx tsc --noEmit`: CLEAN, exit 0.
- `npm test`: GREEN, exit 0. Scripts suite: 841 tests (832 pass,
  9 skipped, 0 fail). Src suite: 1555 tests, 1555 pass, 0 fail
  (includes the 16 new home-loading-orbs tests). Combined: 2396
  tests, 2387 pass, 9 skipped, 0 fail.
- `node scripts/lint-cards.mjs`: GATE PASSED (chunk audit 124690
  records: 8802 with hook, 115888 hook-missing, 0 legacy, 0
  curated-note violations).
- `npm run build:pages`: GREEN, exit 0. Verified:
  dist/client/build-meta.json buildId == `ddb6d28` == HEAD short hash,
  and dist/client/sw.js VERSION == `meridian-ddb6d28` (matches).

## Commits

- (commit lands below after gates pass; message:
  "feat(home): loading orbs for globe zone + lazy card images")

## Pending

- Panel review of this branch (Chair-arranged).
- Push decision: Chair pushes after panel review (implementer does NOT
  push).
- E2E visual confirmation of the globe orb transition (test seat).
- Owner green-light / Chitti review path for this branch (per standing
  Meridian flow), then the owner's merge call.

## Known limits (do not paper over)

- The lazy-chunk window BEFORE HomeGlobe mounts still shows Suspense
  fallback={null}: the orb covers the post-mount texture waterfall
  only, not the chunk download.
- Every home lazy image found in code is covered (six sites, verified
  by grep before editing); no home lazy image was found missing from
  the brief's list, and no listed site turned out not to be a home lazy
  image.
- Card orb overlays are transparent (spinner only, no opaque block):
  the opaque cover requirement applies to the globe mount, where a
  black pre-texture frame exists; card art areas are empty before load,
  and an opaque block would sit badly over the masked `.hv5-art` blobs.
