# Meridian

**Explore the world, one pin at a time—where every guess unlocks a new story**

Play it at [veeresh-bikkaneti.github.io/Meridian](https://veeresh-bikkaneti.github.io/Meridian/)
— also served via [meridian.knowledgetest.workers.dev](https://meridian.knowledgetest.workers.dev/).

## A learning journey, not just a quiz

Meridian is a geography game with a single job: teach kids history, geography, and general knowledge in a way that sticks — because they *played* it, not because they memorized it.

Every round is a small journey:

- **Guess.** A place name appears over unlabeled satellite imagery. No labels, no hints — naming things is the game. You read the land itself: coastlines, rivers, mountains, cities from above.
- **Learn — right or wrong.** Every answer reveals a story card about the place. Get it right and the card deepens what you knew. Get it wrong and the camera pulls back to frame your pin and the true spot together, with the distance between them — the mistake becomes the lesson.
- **Go deeper.** Globe → country → state, every level playable. Curiosity decides how far down you go, and endless play means the journey ends when *you* say so.
- **Keep it.** No accounts, nothing uploaded — your run lives in your browser. Share your trail with the Wordle-style share line and compare with friends.

### The four principles behind every story card

Every card in Meridian is written to the same four rules:

1. **History first, modern identity second.** What happened here outranks what's here now. Kids remember stories, not statistics.
2. **Geography you can picture.** Plain-spoken descriptions of the land — never coordinates, never elevation filler. If a child can't picture it, the sentence failed.
3. **One memorable hook.** A person, a quote, an event, a movie, a record. If a child can't retell it, the card failed.
4. **Short and story-like.** Numbers appear only when they teach — a record, a first, a biggest.

The bar is simple: the best cards read like the opening of an adventure, not an encyclopedia entry.

## How a round goes

You pick **Globe**, **Country**, or **State** — each level is playable, and countries with states drill down further. A prompt names a place, qualified so you can't tap the wrong same-named spot: "Toronto, Canada" in Globe, "Manhattan, Nebraska" in a country run. The map is unlabeled satellite imagery, opened on your region. Tap to place a pin, tap again to move it. Double-tap (or double-click) to drop the pin, or press **Drop pin** when you're sure: that's your one guess, and the pin locks in. Pinch to zoom.

Inside the close-enough radius, it's a hit — points, a short story, and the next name follows. Outside it, the miss card leads with your distance, draws the line from your pin to the true spot, and tells the place's story anyway: every reveal teaches, right or wrong. Then the next name follows. There is no final round and no game-over on a miss; the trail cycles and you keep playing place after place until you choose **End game**. Ending shows your summary — total score with a per-edition breakdown, places played, hits, average distance, best pin. Your score is session-wide: switching editions mid-game keeps adding to the same total (tap the score pill any time to see the breakdown). Leave the game idle for 2 minutes and the session ends, returning you to the edition picker. A "Still there?" nudge appears about 30 seconds before the idle kill — any tap or keypress keeps the game alive.

Every visit shuffles the trail with a fresh seed, so restarts open on different questions. Places you've already seen are skipped until the pool is exhausted, then the trail reshuffles and the cycle starts over. A reload in the same tab resumes the same session — including mid-reveal, where the answer card reappears instead of stranding the game. There is no account.

### Scoring

Points follow scoring v3: a distance-based base (MapTap's curve) multiplied by the place's difficulty tier (1x / 1.25x / 1.5x / 2x / 2.5x) and a streak combo, plus a flat +15 region bonus, capped at 400 per place. Misses score 0 and reset the streak. The breakdown is shown on every hit card — no hidden math.

### Learning paths

The edition picker asks "How do you want to grow your map today?" — three learning paths, not gamer difficulty. **Easy** deals famous places (tiers 1–2), the must-know spots every explorer starts with: world-famous cities and capitals, the curriculum core. **Medium** (tiers 2–4) mixes the familiar with the thought-provoking. **Hard** (tiers 4–5) opens the hidden corners of the world — small towns and neighborhoods most people have never heard of — for explorers ready to discover more. Within your path, famous places deal first: the mental map gets built before the obscure places attach to it. On Easy that rule is strict: the pool is hand-curated starters plus tier-1 places with a verified history hook, falling back to all tier-1 places and then the full 1–2 band only when a region is too small to fill a run (`src/game/easy-curation.ts`). The hero's **Begin exploring** button starts a Globe expedition at the path you picked — it no longer just scrolls the page. Your choice persists across editions and reloads; switching paths starts a fresh run.

The share line carries the trail, not just a number:

```
meridian October 2
https://veeresh-bikkaneti.github.io/Meridian/
🎯🏆🌟👏🙂
1,240 over 14 places · 89 avg/place · 🔥 3 best streak · Nebraska
```

Sharing uses the device's native share sheet where available and falls back to the clipboard otherwise; the end-game summary screen shares session totals instead of the trail.

### GeoDetective — the mystery edition

A fourth edition alongside Globe → Country → State, sitting alongside the endless run: **fully unlimited play** — no daily puzzle, no midnight-UTC reset. Mystery places are dealt from a shuffled deck over **387 human-reviewed, validated clue sets** (`public/loop/clues/`); when the deck is exhausted, it reshuffles. Each mystery gets five guesses. Clues unlock in a fixed ladder — Geography → Climate → History → Hook → Giveaway — one new clue per guess. Guesses are map taps: tap a labeled place to open the bottom-sheet confirm, and unlabeled or ocean taps are legitimate guesses too, scored as "Open Water". Every guess is answered with the distance, the direction toward the target, and warmer/colder against the previous guess. Solve streaks persist as `bestStreak`, and the share line shows `🔥 N best streak` when it reaches 2. Progress persists under `meridian.loop.v2` (the v1 daily-era archive is kept, untouched), so a reload mid-game restores the board; the endless-run state is never touched.

The share line reads `meridian geodetective <date>` with a proximity-graded emoji grid — no place names, no distances, no spoilers:
```
meridian geodetective October 3
https://meridian.knowledgetest.workers.dev/
🟥🟩⬜⬜⬜ solved in 2 · 🔥 2 best streak
```

Solving all 387 mysteries earns the full-collection celebration.

### The Journal

The home page carries a Journal: 106 place notes rotating in 36 sets over 2-hour windows. Since 2026-10-17 every note is illustrated — each of the 106 places has its own storybook drawing (warm gouache-and-watercolor picture-book style, no text). Every note carries its source citation and a confidence label — **Verified** (government or university source) or **Cited** (named source recorded) — and the footer reads "Entry X of 36" with a countdown to the next set. Art integrates only through `scripts/journal-art-manifest.json` + the dataset generator (`scripts/build-journal-dataset.mjs`); the generated data file is never hand-edited.

### The storyteller and Grandpa's tasting tour

The home page opens with a storyteller mascot who greets visitors with a spoken line (a new greeting each day) and reacts when tapped. Grandpa runs a tasting tour of the home screen — a sip-sized walkthrough of the difficulty picker, the edition cards, and GeoDetective for first-time visitors.

### Supporting the game

Meridian is free for kids — no paywalls, no accounts. Grown-ups can buy the builder a coffee: **"Grown-ups — buy me a coffee? ☕"** — "Your support keeps Meridian free for kids". That copy is locked verbatim.

## Where the stories come from

Story cards are built by pipelines, not written by hand at play time. Two feed the cards:

**Wikipedia enrichment** (`scripts/enrich-wikipedia.mjs`, merged). A resumable, rate-limited crawler resolves each place to its Wikipedia article and extracts hook sentences matching the four principles — named-after stories, birthplaces, battles, foundings, firsts. Every candidate passes a no-fabrication validator: each content word must appear in the source extract, and coordinate/elevation/population/census patterns are banned outright. CLI: `node scripts/enrich-wikipedia.mjs <crawl [limit]|merge|report>`. Measured state: **8,797 of 124,690 places** carry enrichment content (`history`/`wiki`/`hook`) in the shipped dataset. Most cards still show the plain geographic blurb until enrichment reaches them.

**Fact ladder** (merged, PR #104). The fact layer that enriches story cards with referenced facts: `factLadder()` in `src/game/generated-places.ts` reads per-region fact data (e.g. `src/game/data/geonames/facts/arkansas.json`) and adds 247 pilot facts to story cards. Two independent research passes verified the bet: **Wikidata as the ID spine + Wikipedia text as the fact source** — with the honest caveat that structured facts cover only low single digits of small towns on a first pass, so the fallback ladder is part of the design.

## Architecture

The game in the browser is four pieces.

- **Atlas.** `src/game/data/geonames/chunks/` holds 124,690 GeoNames places in 64 lazy-loaded region chunks (CC-BY 4.0, attributed in-app), plus a curated starters set. Each place carries name, coordinates, a blurb, difficulty tier, and optional `history`/`wiki` enrichment.
- **Rules.** `src/game/radius.ts` decides the close-enough circle. `src/game/run.ts` is the endless run state machine (aim → story/done → aim, until explicit End game). `src/game/scoring.ts` is scoring v3. `src/game/share.ts` writes the share line. `src/game/trail.ts` + `src/game/pool.ts` deal fail-closed from the selected region's pool with persistent no-repeat.
- **Map.** `src/map/satellite-map.tsx` draws Esri World Imagery with MapLibre. State and country cameras open inside that region's box — pinch out and the box releases to a full Earth-from-space view, pinch back in and it re-locks. Tiles are requested by the browser. They are not bundled. The pin is not sent anywhere.
- **Story.** `src/game/generated-places.ts` composes each card as `history + blurb` when enrichment exists, falling back to the plain blurb. `src/game/rewrite.ts` asks Gemini Nano only when the browser reports the model is already available — a missing model never blocks play. For places with no authored story at all, `src/game/story-ai.ts` may ask Nano for one validated story sentence: the blurb shows immediately and the AI sentence arrives later with a small "AI" badge. Otherwise the written story is what you read.

Nothing about a guess is stored on a server. The in-progress run lives in `sessionStorage`; reloading mid-reveal restores the answer card (or fails safe to the next question) instead of soft-locking.

### Invariants a contributor must know

- **Every place's coordinates must match its claimed location.** Enforced by a build-time gate (`src/game/validate-places.ts`). No exceptions.
- **Dealing is fail-closed to the selected region.** Questions always come from the selected region's pool; a region that can't load its places doesn't start.
- **No repeats before pool exhaustion.** Per-session shuffle plus a persistent no-repeat history across visits.
- **Missing on-device AI must never block question loading or reveal.** The Nano paths are strictly enhancement.
- **Nothing deploys to production without thorough E2E testing.** Playwright specs in `tests/e2e/` are the gate.

### Feature flags

`public/flags.json` carries the production feature flags. Both graduated experiments are ON in production: `globeTierSplit` (the globe edition ships per-difficulty-tier region files, PR #148) and `learningOutcomes` (players build per-place learning records from their next boot, PR #45).

## Inspired by MapTap, not a copy

[MapTap](https://maptap.gg/) is the daily that suggested a pin on a map and a line you can share. Meridian keeps that feeling and leaves the rest.

| | MapTap | Meridian |
|---|---|---|
| Length | Five rounds, then the card is over | Endless — ends only when you choose End game |
| Result | Weighted scores and an emoji row | Scored per place (v3), emoji strip, running total |
| Prompt | A clue, then the map | The place name, then the story |
| Where | One daily world (and practice sets) | Globe, countries, and states — every level playable |
| Map | MapTap's globe | Live satellite, unlabeled — zoom out to space, zoom back to the region |
| Same puzzle | Yes, for that day's five | Fresh shuffle every visit; no-repeat until the pool cycles |
| Friend challenge | Daily shared link | Stateless `#c=mc1...` Globe link (5–10 places, 750 km radius, flag-gated under `friendChallenges`) |

MapTap's places are a checked atlas. Meridian's are too. A model does not invent the next place, so Safari and DuckDuckGo play the same trail as Chrome. If Chrome already has Gemini Nano installed, it may rewrite the story after a hit, using only the facts already written. It does not download a model, and it does not change the pin or the count.

## Design

The radius is 12% of the region's greater side: 25–160 km for a state, 40–450 km for a country, and 750 km on the globe. A pin exactly on the radius counts.

The order is a per-session seeded shuffle of that region's places — restarts open on different questions, and a reload resumes the same session's order.

Stories are short. They are shown on every reveal, right or wrong. The written design history is `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Contributing

Direct pushes to `main` are blocked — all work goes through branches and pull requests. The expected gates on a PR:

```sh
npx tsc --noEmit        # typecheck must be clean
npm test                # unit + pipeline tests must pass
node scripts/lint-cards.mjs  # card-content gate — must print GATE PASSED
npm run build:pages     # production build must succeed
npx playwright test --workers=1  # full E2E suite must pass (serial — parallel runs flake)
```

Every code change goes through two reviews: a technical-architecture review and a tone/docs/accessibility review. Nothing merges with a failing gate. Stage named files only (`git add -A` is banned while background jobs may be writing into the tree); push branches promptly — the VM is not durable storage for unpushed work.

## Deployment

The public site is GitHub Pages, from a static build. `GITHUB_PAGES=1` sets the asset and router base to `/Meridian/`, turns on a static shell, and skips the server. `.github/workflows/pages.yml` runs that build on `main`, copies the shell to `index.html` and `404.html`, and publishes it.

The same production build also ships to [meridian.knowledgetest.workers.dev](https://meridian.knowledgetest.workers.dev/) via a Cloudflare Workers build and deploy — both URLs serve the live app.

The Worker deploy shape is committed in this repo: a root `wrangler.jsonc` sets `main` to `src/server.ts`, Workers Builds deploys with that config, and the `@cloudflare/vite-plugin` wiring in `vite.config.ts` produces the bundle the deploy follows. The full record is [docs/reviews/2026-10-22-wrangler-config-entry.md](docs/reviews/2026-10-22-wrangler-config-entry.md).

`npm run build` is a different path. It still produces the server build. The live preview uses that. Pages does not.

### Build version stamping

Every build carries one build id — the deployed commit's short SHA (`scripts/build-id.mjs`: `GITHUB_SHA` on GitHub Actions, else `git rev-parse --short HEAD`, else a `local-<timestamp>` fallback for tarball builds). It appears in three places that must always agree: baked into the bundle (the staleness check in `src/game/build-staleness.ts`), as `VERSION` in the built `sw.js`, and served as `/build-meta.json`. The stamping runs **inside** the Vite build, not only in npm lifecycle hooks: `vite.config.ts` computes the id once (`BUILD_ID`) and passes it to `scripts/fingerprint-sw-plugin.mjs` (sw.js) and `scripts/build-meta-plugin.mjs` (writes `build-meta.json` into the output, including the Nitro `.vercel/output/static` tree). That matters because the Workers Builds deploy invokes the build directly, bypassing the `prebuild` hook that runs `scripts/write-build-meta.mjs` — on a fresh checkout there is no `public/build-meta.json` (it is gitignored), so the hook alone would leave the Workers site with no stamp. The Pages mirror under `/Meridian/` stamps the same way. Verify any built tree with:

```sh
node scripts/verify-build-stamp.mjs   # or: npm run verify:build-stamp
```

Production today proves the point and shows the host difference: the Workers site stamps the 7-char git short SHA, the Pages mirror the 12-char `GITHUB_SHA` prefix — each equals its own deployed commit, and within any one deploy all three copies agree.

### Production smoke check

After a deploy, run the owner smoke script against the live site:

```sh
node scripts/prod-smoke.mjs            # defaults to https://meridian.knowledgetest.workers.dev
node scripts/prod-smoke.mjs <baseUrl>  # any base URL; the checks describe the Workers surface
```

It uses only GET requests and exits non-zero on any failure. It checks: `/` returns 200 with the full security-header set (CSP, `X-Frame-Options`, Referrer-Policy, Permissions-Policy, `X-Content-Type-Options`, COOP, HSTS); `/_serverFn/` returns 404; `/.well-known/security.txt` returns 200; the manifest's `start_url` resolves to a 200; and `/build-meta.json` carries a `buildId`. The same script runs manually from GitHub Actions (**Actions → Production smoke → Run workflow**) — there is no schedule; the owner triggers it.

MapLibre's worker is a sibling file the bundler would otherwise drop. The Pages build copies `maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs` into `assets/` so the map can start. Without those files the canvas is blank.

```sh
npm run dev
npm test
npm run build:pages
```

### Privacy (kids first)

Meridian is directed to children, so every visitor is treated as a child. There are no accounts, no personal questions, and no cookies or persistent identifiers for analytics. Google Analytics and Microsoft Clarity were removed on 2026-10-21; the only analytics is optional, cookieless **Cloudflare Web Analytics**, injected only when the build has `VITE_CF_BEACON_TOKEN` set. Crash reports go to our own worker with a per-session random ID and coarse device buckets only. The full notice is the in-app **/privacy** page (linked from the home footer and the For grown-ups card); grown-ups reach the owner through the math-gated **/contact** form, which posts to `POST /api/contact` on the main `meridian` worker (`src/routes/api/contact.ts`; there is no separate contact worker). **Deploy TODO:** delivery for that form is parked. The handler defaults to a `NoopSink` that accepts messages and stores nothing, and the page says so. It forwards to Discord only when the `meridian` worker has its *own* secret `CONTACT_DISCORD_WEBHOOK_URL`; that is never the crash worker's `DISCORD_WEBHOOK_URL`, and the two use different channels. The form stays off until `public/flags.json` gets a `contactEndpoint`. Background: `docs/reviews/2026-10-21-p0-p2-remediation.md`.

### Security headers

The security headers (CSP, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, Referrer-Policy, Permissions-Policy denying camera/mic/geolocation/payment, nosniff, COOP, HSTS) come from one place: `src/lib/security-headers.ts`. They are delivered two ways. Server-rendered responses (every HTML page and `/api/contact` on the `meridian` worker) get them from the request middleware in `src/start.ts`. Cloudflare does **not** apply `public/_headers` to Worker-generated responses. Static assets get them from `public/_headers`, which also sets `immutable` caching for hashed `/assets/*` and `no-cache` for `sw.js` / `flags.json`. Server-rendered HTML also gets `Cache-Control: public, max-age=0, must-revalidate` from the same `src/start.ts` middleware (the constant `HTML_CACHE_CONTROL` in `src/lib/security-headers.ts`), because `_headers` never reaches Worker-rendered pages. A unit test fails if the two drift apart. See `docs/security-headers.md`.

### Installable (PWA)

Meridian ships a web manifest, app icons, and an offline page, so it can be installed from the browser. Updates never interrupt play: when a new version is detected, a toast offers "Update now" (applies the update and reloads once) or "Later" (dismisses; the update applies on the next fresh load). The service worker registers in production builds only. The manifest (`./` scope/start URL) and `sw.js` (base derived from its own URL) carry no hardcoded base path, so the same files work under `/Meridian/` on GitHub Pages and `/` on Cloudflare.

Imagery: `Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community`. The imagery host sees the area on screen. Your pin stays on the device. Place data: GeoNames (CC-BY 4.0). Wikipedia-derived history notes: CC BY-SA, via the in-app source links.
