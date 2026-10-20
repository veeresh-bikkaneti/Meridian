# BRANCH_STATUS.md — fix/x-banner-180

## What this branch fixes

Issue #180: the shipped X feed-card banner `public/x-banner.jpg` still
read "MERIDIAN / FIVE PLACES" in the old dark-teal palette. Meridian is
endless — there is no five-place count ("five" belongs to GeoDetective's
five *guesses*). Found during PR #177's full-pipeline review (Office
Hours seat), verified on main by the owner-side check, and filed as
issue #180 on the owner's word. Issue #156 / PR #177 fixed the same
problem on `og.jpg` only; this branch fixes the second share surface.

## Owner decision

Two candidates were rendered and put to the owner. He picked A —
Veeresh, 2026-10-20: **"Pick A — classic layout, slogan on the dark
field"**.

## The fix (one file)

`public/x-banner.jpg` replaced with candidate A's exact bytes.

- **What the new banner shows:** the old banner's layout in the
  approved og.jpg gold treatment — cream MERIDIAN wordmark on the left
  over a deep dark-green field, the locked slogan ("Explore the world,
  one pin at a time—where every guess unlocks a new story") in gold
  italic serif on two lines exactly where "FIVE PLACES" used to sit,
  the gold lamp-lit world map spanning center/right, and one gold
  location pin in the Indian Ocean south of Indonesia. No place count
  anywhere; the only words are MERIDIAN and the slogan.
- **Rendered, not generated:** script-rendered from the game's own
  Natural Earth land-50m data through the issue #156 og pipeline
  (typeset in Noto Serif Display, no AI lettering). Render script and
  candidates record live outside the repo at
  `~/workspace/your_files/xbanner180/` (note.md + work/render.py).
- **Checksums (all three identical):** source candidate = the file in
  this branch = the built `dist/client/x-banner.jpg` —
  md5 `20414d49bda307f794ba40013995e451`, 1200×264 baseline JPEG,
  68,552 B. (Old banner: md5 `d1798e62db7340829622fb09581d1e44`,
  21,916 B.)

## Documentation survey (the PR #177 lesson, applied)

Grepped `docs/handbook/`, `docs/adr/`, `README.md`, and the standalone
handbook source (`~/workspace/your_files/meridian-handbook/`) for
"x-banner" and "FIVE PLACES" before calling this done:

- **No living document describes the banner's content** — its palette,
  words, or size appear in no doc, in the repo or the standalone
  handbook. There was no stale banner description to update.
- **The three "FIVE PLACES" hits in the repo are all about `og.jpg`,
  not this banner**, and all three are left untouched here, on purpose:
  1. `docs/handbook/06-design-and-ux-decisions.md` §5, the
     "OPEN — issue #156" line — already cured on PR #177's branch
     (same lines). #177 merges before this branch; editing them here
     too would collide with that cure.
  2. `docs/adr/0001-share-tag-ownership.md`, the unchecked follow-up
     "[ ] New og.jpg (#156)" — ticked by PR #177's cure, same reason.
  3. `docs/ops/specs/share-card-copy.md`, "Known issue found while
     building: `public/og.jpg` still reads…" — a dated build-time
     note; a historical record, left as one.
- **`scripts/brand-check.mjs` — no change, confirmed:** it guards the
  banner's presence, its 1200×264-JPEG format, and the 600 KB scraper
  budget (`MAX_CARD_BYTES`) only; its header describes path/format,
  which are unchanged and still accurate. The new file (68,552 B)
  complies.
- **Wiring — no change, confirmed:** `scripts/grok-pwa-shared.mjs`
  stamps `site.banner` from the file's existence and the `x:game:image`
  meta is path-based. No banner-specific alt text exists anywhere
  (`SHARE_IMAGE_ALT` describes `og.jpg` only), so no alt update is
  owed.

## Gates (run on this branch)

- `npx tsc --noEmit` — clean
- `npm test` — scripts 799 (790 pass / 9 skip / 0 fail) + src
  1358 pass / 0 fail
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` (with `VITE_KOFI_URL`) — green; built artifact
  checksum verified identical (above)

## Ready to merge? NO

- The full review pipeline (owner's standing rule) has not run on
  this PR yet.
- Merging is the owner's word alone. This branch is based on main
  `a45674b`; the owner's 2026-10-20 merge order runs #177 → #178 →
  #179 first, so a rebase + retest at merge time is expected.
