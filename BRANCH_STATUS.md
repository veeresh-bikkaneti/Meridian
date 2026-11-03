# BRANCH_STATUS — feat/home-card-films

- **Branch:** `feat/home-card-films`
- **Base:** `main` @ `2a0527f` (#295 verdict Grandpa clip)

## Task capsule

TASK / requested outcome: Port the two owner-approved home-card
designs into production: the GeoDetective card's `.hv5-pic` slot
plays the round-2 reshoot FILM as-is, and the Cold Trail card's
slot plays a NEW walking animation (owner correction, verbatim:
"I want the avatar chasing the clue like walking not the zoom in
and out of card" — the round-2 pull-back is superseded and was
never shipped). One shared component + one swap-point media
module govern both cards. Stop at PR-open; QA + panel are
separate silos. NO MERGE without the owner's per-PR word.

Tier and rationale: Tier 1 execution of owner-decided designs
(the films, casting, and motions were all decided 2026-11-02;
the governance mirrors the shipped home-globe gates and the
#295 verdict clip's stop semantics). No new design decisions.

Done condition / evidence: both cards render their film in the
slot at desktop + mobile geometry with zero layout shift;
locked band still renders LockedLoop; reduced motion shows the
still with zero video fetch (proven by E2E + a headless probe
with a request log); per-card media ≤ ~400 KB per film; repo
gates green; PR opened with the full record. Evidence dir:
~/workspace/meridian-card-port-evidence/

Files and interfaces in scope: `src/components/game-app.tsx`
(the two `.hv5-pic` sites + imports only), `src/components/
home-v5.css` (film fill rules only — `.hv5-pic` box geometry
untouched), NEW `src/components/card-film.tsx`, NEW
`src/assets/home-v5/card-media.ts` + 6 media files, tests that
pinned the old stills, README + this file. Out of scope
(FORBIDDEN): the locked GeoDetective tile (LockedLoop branch —
byte-identical), all card copy, the frozen PRs
#297/#299/#302/#305/#307/#308/#309/#311/#312.

## What shipped

- **GeoDetective film** — the reshoot, as-is (four beats, lands
  on the owner's image; beat-4 ~1 s generation drift is
  OWNER-ACCEPTED, disclosed before his build-as-is pick).
  Encoded 1094×616, H.264, silent, faststart: **371,759 bytes**.
  Poster = the film's own first frame (frame 0 of the shipped
  film): 79,846. Still (reduced-motion/gated) = the owner's
  image, centre-cropped to the slot: 90,376. Per-card total:
  541,981.
- **Panel cure (PR #321, Frontend seat BLOCK):** the first
  shipped GeoDetective poster was the wide top-down desk plate
  (from geo-table.webp), but the film's frame 0 is a tight crop
  of the pinned map's centre — poster↔frame-0 MAD 102.4/255, a
  hard visible pop at playback start, against card-media.ts's
  own hard rule. Cured by re-deriving geodetective-poster.webp
  from frame 0 of the shipped film (WebP quality 82, 1094×616,
  79,846 bytes); MAD after = 1.29/255 at 547×308 (Cold Trail's
  league: 1.97). One asset only; no code change. Evidence:
  ~/workspace/meridian-card-port-evidence/cure/
- **Cold Trail film** — NEW image-to-video take 1 of 3 from the
  approved keyframe: Jolly steps up the footprint trail to the
  cabin (legs alternating, new prints under its feet, frost over
  the oldest print), the child tracker follows with her
  flashlight, camera locked. Encoded 1094×616: **326,786
  bytes**. Poster = the film's first frame: 58,354. Still =
  the keyframe: 76,010. Per-card total: 461,150.
- **Encode deviation, recorded honestly:** the brief's CRF
  28–32 range cannot meet its own ~400 KB hard cap on these
  sources (dark rainy grain / falling snow = per-frame noise):
  CRF 32 veryslow measured 505,840 (Geo) / ~500 KB (Cold). Same
  technique (H.264 CRF, -an, +faststart), CRF tuned past the
  range — Geo CRF 35 (SSIM 0.932 vs CRF-10 reference; legible
  and near-identical at the 547 px display size), Cold CRF 36.
  Full sweep: evidence `logs/media-encode.txt`, and the record
  lives in `card-media.ts` for the next re-cut.
- **CardFilm component** — gates to the still (video never
  fetched): prefers-reduced-motion (shared hook, live),
  Save-Data, deviceMemory ≤ 2, video error. Lazy: video mounts
  only near the viewport (IntersectionObserver, rootMargin
  200px, preload="none"); poster fills the slot until then.
  Plays once, muted, playsInline, no loop; holds the last
  frame. WCAG 2.2.2: 44×44 pause/play toggle above the
  stretched CTA, labels "Pause the cartoon" / "Play the
  cartoon" driven by the video's own events; after the end the
  toggle replays (gesture only). Video is decoration
  (aria-hidden, tabIndex −1). Media absolutely fills the
  existing `.hv5-pic` box — geometry untouched, zero CLS
  (probe: card box identical at film start and after settle).
- **Deleted:** `desert-ruins.webp` + `patagonia.webp` (the old
  stills; no remaining references — grep-verified across src,
  scripts, public, index.html).

## Gates (code head 3659f23; build stamp 3659f23)

- `npm run typecheck` — PASS (0 errors)
- `npm test` — PASS: scripts 850 pass / 11 skipped; src
  1896/1896 (incl. new card-film.test.ts)
- `npm run test:worker` — PASS 85/85 (untouched surface, run
  per repo gate list)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — PASS
- `npm run perf:bundle` — entry JS 979,123 raw / 305,248 gzip
  vs main's 977,196 / 304,649 (**+1,927 raw / +599 gzip** — the
  component code only; films are separate URL assets, zero
  media bytes in the entry chunk)

## E2E (flock, --workers=1, Playwright-bundled Chromium)

The VM's /opt/meta-chromium currently refuses every launch
("Hatch WebGL domain policy is required") on branch AND main,
so runs used the Playwright-bundled Chromium
(PLAYWRIGHT_CHROMIUM_EXECUTABLE=~/.cache/ms-playwright/
chromium-1243) — same browser for branch and controls.

- loading-orbs.desktop — **8/8 PASS** (incl. the rewritten
  reduced-motion test: still shown, zero .mp4 requests; and
  the film-error test: aborted .mp4 → Cold Trail still)
- card-redesign.desktop — **11/11 PASS** (whole-card clicks,
  focus stops incl. the new toggle stop, rings, badges)
- home-visual-layout.desktop — **13/13 PASS**
- home-badges-readaloud — **8/8 PASS**; badge-journey — **6/6 PASS**
- grandpa-tasting-tour — 4 pass / 21 fail on branch; **control
  on unmodified main fails identically from test #1** (tour
  stuck at stage "compass", never reaches "walk" within 20 s):
  environment class on this VM+browser, NOT a regression.
  First-run card-redesign crashes ("Target crashed") had the
  same disposition and a found cause: /tmp is a 512 MB tmpfs
  that filled (ENOSPC in a main-control log); after cleanup
  the full spec passes 11/11.
- mobile-home-overlap — 6 pass / 20 fail on branch; failures
  are storyteller-greeting elements never appearing within
  20 s (same timing class as the tour); spot control on main
  recorded in evidence logs.
- Headless probe (temporary spec, deleted after the run):
  toggle labels flip via the video's own events; both films
  `ended` and hold; replay-by-toggle restarts Cold Trail
  (currentTime 0.67 s and playing); reduced-motion slots have
  NO video element and the request log shows **zero .mp4
  requests**; locked band (seeded 5-7 profile): GeoDetective
  card + film absent, LockedLoop renders, Cold Trail film
  present. Screenshots: evidence `screenshots/` (desktop film
  start / settled / reduced-motion / locked band, mobile
  settled).

## Redundancy audit (owner standing rule)

| Surface | Keep / remove | Reason |
| :--- | :--- | :--- |
| `LazyHomeImage` (component) | **Keep** | Still owns the four remaining home stills (`.hv5-art` ×3 + journal entries); only the two `.hv5-pic` sites left it. Removing it would orphan working surfaces. |
| `desert-ruins.webp` | **Remove** (deleted) | The GeoDetective slot's old still; superseded by the film's poster+still pair; zero remaining references. |
| `patagonia.webp` | **Remove** (deleted) | Same: Cold Trail's old still, superseded; zero remaining references. |
| Layered-plates DOM approach (reshoot CONCEPT) | **Not ported** | The owner approved a FILM for GeoDetective ("Build this in production" on the reshoot video), not the layered-plates web build; a second rendering path for the same picture would duplicate the slot's job. |
| Round-2 CSS-mirror prototype | **Not ported** | Prototype only; the production port is the film behind CardFilm, per the owner's build word. |
| CardFilm toggle vs the cards' badge buttons | **Keep both** | Not a duplicate: badges toggle a blurb (GeoDetective only); the film toggle is the WCAG 2.2.2 stop for moving content, one per film, dealing from its own context (the #295 verdict toggle is the same pattern on a different screen). |

## Flags for the owner / panel

- Cold Trail copy mismatch: the card still reads "A smuggler
  moves between cities…" under a picture of Jolly and the
  tracker. The copy is byte-locked for this diff; the mismatch
  is the owner's open call — code does not decide it.
- GeoDetective beat-4 drift (~1 s, robots morph / sign
  garbles, then hands back to the owner's exact image):
  owner-accepted as-is, 2026-11-02.
- Panel approves the final tip; merge only on the owner's
  per-PR word.
