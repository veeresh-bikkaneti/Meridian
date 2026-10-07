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

The edition picker asks "How do you want to grow your map today?" — three learning paths, not gamer difficulty. **Easy** deals famous places (tiers 1–2), the must-know spots every explorer starts with: world-famous cities and capitals, the curriculum core. **Medium** (tiers 2–4) mixes the familiar with the thought-provoking. **Hard** (tiers 4–5) opens the hidden corners of the world — small towns and neighborhoods most people have never heard of — for explorers ready to discover more. Within your path, famous places deal first: the mental map gets built before the obscure places attach to it. Your choice persists across editions and reloads; switching paths starts a fresh run.

The share line carries the trail, not just a number:

```
meridian October 2
https://veeresh-bikkaneti.github.io/Meridian/
🎯🏆🌟👏🙂
1,240 over 14 places · 89 avg/place · 🔥 3 best streak · Nebraska
```

Sharing uses the device's native share sheet where available and falls back to the clipboard otherwise; the end-game summary screen shares session totals instead of the trail.

### GeoDetective — the daily edition

A fourth edition alongside Globe → Country → State, mounted outside the run machine: one mystery place per UTC day, five guesses. Clues unlock in a fixed ladder — Geography → Climate → History → Hook → Giveaway — one new clue per guess. Each guess is typed into a constrained typeahead (no free-text penalties: unknown or repeated picks never cost a guess) and answered with the distance, the direction toward the target, and warmer/colder against the previous guess. Progress persists per day under `meridian.loop.v1` (30-day archive), so a reload mid-game restores the board; the endless-run state is never touched.

The daily puzzle draws from **387 human-reviewed, validated clue sets** (`public/loop/clues/`, pool-indexed by UTC day). The share line reads `meridian geodetective <date>` with a proximity-graded emoji grid — no place names, no distances, no spoilers:

```
meridian geodetective October 3
https://veeresh-bikkaneti.github.io/Meridian/
🟥🟩⬜⬜⬜ solved in 2
```

## Where the stories come from

Story cards are built by pipelines, not written by hand at play time. Two are in flight:

**Wikipedia enrichment** (`scripts/enrich-wikipedia.mjs`, merged). A resumable, rate-limited crawler resolves each place to its Wikipedia article and extracts hook sentences matching the four principles — named-after stories, birthplaces, battles, foundings, firsts. Every candidate passes a no-fabrication validator: each content word must appear in the source extract, and coordinate/elevation/population/census patterns are banned outright. CLI: `node scripts/enrich-wikipedia.mjs <crawl [limit]|merge|report>`. Honest status: 285 places merged so far; the crawl is still running and further merges follow as it completes. Most cards still show the plain geographic blurb until then.

**Fact pipeline, Phase 1** (infrastructure on feature branches, not yet merged). Five tracks building the next layer: `feat/facts-qid-join` (map all 124,690 places to Wikidata IDs), `feat/facts-wikidata-extract` (pull referenced "named after" / "inception" statements via SPARQL), `feat/facts-wiki-text` (structured named-after/founded facts from article leads), `feat/facts-validator` (hardened no-fabrication gate: relational checks, hedge preservation, date-predicate binding), `feat/facts-eb1911` (1911 Encyclopaedia Britannica supplement for UK/IE places, public domain). Two independent research passes verified the bet: **Wikidata as the ID spine + Wikipedia text as the fact source** — with the honest caveat that structured facts cover only low single digits of small towns on a first pass, so a fallback fact ladder is part of the design.

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
npm run build:pages     # production build must succeed
npx playwright test     # full E2E suite must pass
```

Every code change goes through two reviews: a technical-architecture review and a tone/docs/accessibility review. Nothing merges with a failing gate. Stage named files only (`git add -A` is banned while background jobs may be writing into the tree); push branches promptly — the VM is not durable storage for unpushed work.

## Deployment

The public site is GitHub Pages, from a static build. `GITHUB_PAGES=1` sets the asset and router base to `/Meridian/`, turns on a static shell, and skips the server. `.github/workflows/pages.yml` runs that build on `main`, copies the shell to `index.html` and `404.html`, and publishes it.

`npm run build` is a different path. It still produces the server build. The live preview uses that. Pages does not.

MapLibre's worker is a sibling file the bundler would otherwise drop. The Pages build copies `maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs` into `assets/` so the map can start. Without those files the canvas is blank.

```sh
npm run dev
npm test
npm run build:pages
```

### Installable (PWA)

Meridian ships a web manifest, app icons, and an offline page, so it can be installed from the browser. Updates never interrupt play: when a new version is detected, a toast offers "Update now" (applies the update and reloads once) or "Later" (dismisses; the update applies on the next fresh load). The service worker registers in production builds only.

Imagery: `Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community`. The imagery host sees the area on screen. Your pin stays on the device. Place data: GeoNames (CC-BY 4.0). Wikipedia-derived history notes: CC BY-SA, via the in-app source links.
