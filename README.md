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

The edition picker asks "How do you want to grow your map today?" — three learning paths, not gamer difficulty. **Easy** deals famous places (tiers 1–2), the must-know spots every explorer starts with: world-famous cities and capitals, the curriculum core. **Medium** (tiers 2–4) mixes the familiar with the thought-provoking. **Hard** (tiers 4–5) opens the hidden corners of the world — small towns and neighborhoods most people have never heard of — for explorers ready to discover more. Within your path, famous places deal first: the mental map gets built before the obscure places attach to it. On Easy that rule is strict: the pool is hand-curated starters plus tier-1 places with a verified history hook, falling back to all tier-1 places and then the full 1–2 band only when a region is too small to fill a run (`src/game/easy-curation.ts`). The home hero itself is animated: two overlays slice the mountain painting — `HeroTrailOverlay` (the dotted trail) and `HeroTrekkerOverlay` (the trekking kid) — in a 6-layer stack: the painted art, the marching dots, the climbing pulse, the summit flag, the drifting clouds, and the trekker. One shared still gate governs both overlays: players who prefer reduced motion, who are saving data, or whose device has little memory get the still scene (static trail, trekker paused mid-climb) instead of the loops. The hero's **Begin exploring** button starts a Globe expedition at the path you picked — it no longer just scrolls the page. Your choice persists across editions and reloads; switching paths starts a fresh run.

### Start over

Every miss lands in a review deck on the edition picker, so you can practise the places that beat you — and the deck only ever grows. When it gets too big, or you simply want a clean slate, **Start over** (on the review card and the review-complete screen, behind a confirm that lists exactly what goes) wipes your game history: the deck, your learning growth, the places the game remembers you have seen, your GeoDetective and Cold Trail progress, today's score, and any game left half-finished. Your badges and settings stay. And because the game forgets what you've seen, familiar places can be dealt again — a true fresh start.

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

The header's **End game** button ends a session with a summary — cases closed, streaks, and deck progress, with Holmes and Watson celebrating on it. Mid-case it offers a choice: end the case for good (it counts for nothing and can't be resumed), or pause it exactly as it stands and pick it up later from Home.

### Capitals & Flags — the first story pack

New geography content arrives as **story packs**: extra case sets that plug into the editions above instead of standing alone. The first pack is **Capitals & Flags** — 110 cases (60 country capitals, all 50 US state capitals), each written to the same standard as the core mysteries: a five-rung ladder whose history rung is the moment the place became a capital, one retellable hook, a giveaway that names the seat of government, and a reveal card that ends with the plain pairing ("Accra is the capital of Ghana."). Every clue traces to a verbatim Wikipedia quote in its authoring record — no invented facts.

Each case also teaches its land's **flag**: the flag appears beside the land's name in the briefing, at the Giveaway rung, next to Cold Trail witnesses, and on both reveals with one sourced flag-story line. Every flag is sourced per-file from Wikimedia Commons with its licence verified and pinned (`docs/flags-curation.md`); a land whose flag can't be licence-verified inside the size budget simply plays without one — flags are never drawn or invented here.

Both mystery editions grow a **deck shelf**. In GeoDetective, the Capitals & Flags deck deals all 110 cases through the same clue ladder (clue files 387–496, beside the 387 core files); finishing the cycle earns its own celebration — "All 110 Capitals & Flags case files closed." In Cold Trail, the pack becomes an 85-case triangulation deck whose witness cities are the pack's anchor capitals. Each edition keeps its own deck progress and its own store, switching decks never loses a case in progress, and reopening an edition resumes the deck you left mid-case. Players pick the Capitals deck on the shelf inside each edition — that shelf is the pack's only entry point. (Home carried a Capitals & Flags strip for a day — first with a door into each edition, then as a signpost beside the About card — until the owner removed it, Veeresh, 2026-11-05: "card is not clickable. if its not clickable then there is no point of putting it on home page.") The design lives in `docs/story-packs.md`; the rebuild runbook is `scripts/packs/README.md`.

### The Journal

The home page carries a Journal: 106 place notes rotating in 36 sets over 2-hour windows. Since 2026-10-17 every note is illustrated — each of the 106 places has its own storybook drawing (warm gouache-and-watercolor picture-book style, no text). Every note carries its source citation and a confidence label — **Verified** (government or university source) or **Cited** (named source recorded) — and the footer reads "Entry X of 36" with a countdown to the next set. Art integrates only through `scripts/journal-art-manifest.json` + the dataset generator (`scripts/build-journal-dataset.mjs`); the generated data file is never hand-edited.

### The storyteller and Grandpa's tasting tour

The home page opens with a storyteller mascot who greets visitors with a spoken line (a new greeting each day) and reacts when tapped. Grandpa runs a tasting tour of the home screen — a sip-sized walkthrough of the difficulty picker, the edition cards, and GeoDetective for first-time visitors.

The two game cards carry short animated pictures. The GeoDetective card plays a four-beat film: a map on a table, a magnifying glass, then the detective herself, alive at her desk. The Cold Trail card shows Jolly, the cream plush mascot, walking the footprint trail toward a lit cabin while the young tracker follows with her flashlight, then the film rewinds her walk back to the start. Each film starts when its card nears the viewport and loops from there. A film pauses while its card is off screen, so the page never decodes a loop nobody can see. Players who prefer reduced motion, who are saving data, or whose device has little memory never download a film at all. They see the still picture instead. The films, their posters, and their stills all swap through one module (`src/assets/home-v5/card-media.ts`), so a future re-animation replaces files, not code.

Both game card pictures feather into their card instead of ending at a hard line. A mask on the picture itself holds the scene at full strength until near the bottom of the box, then fades it out over a thin strip, and a sliver of card colour under the strip lands the last rows exactly. The mask sits on the picture, so the film, the poster, and the still all feather the same way. An earlier build painted a cream gradient over the scene to get this blend. The owner found the cloud of cream too harsh on the eyes, and the softer versions still read too heavy, so the painted gradient is gone.

The three illustrated cards below (Review, Journal, and For grown-ups) carry films of their own in wide picture banners at the top of each card, made the same way: each card's existing illustration was animated. In Review, a magnifying glass sweeps over the satchel, overshoots, and settles in the wrong place, then the film rewinds and pauses at the start, as if rethinking a miss. In Journal, wind moves through the tree and warm light shifts over the hills, and the end of the film crossfades back into its start. In Grown-ups, the binoculars rise as if lifted to watch over the kids, and the hat tips once, with the same crossfade at the join. All five films share the one CardFilm component and its rules: loop near the viewport, pause off screen, no play or pause button on any card, and the plain still with no download at all under reduced motion, Save-Data, or low memory. The films carried a pause/play button until 2026-11-03, when the owner ordered it removed and the films set to loop. An earlier round gave the three smaller cards a CSS motion pass instead; the owner replaced it with these films, and the CSS pass is gone, so the home page has one motion system, not two.

For the youngest players (Little Explorer, ages 5–7), GeoDetective is locked, and its tile carries a picture of its own: the detective asleep on her map, magnifying glass set down. She breathes twice, slowly, and then the film loops back to the same resting picture and breathes again — the owner's 2026-11-04 ruling gave this tile the card films' loop-forever rule (before that ruling the picture played once and rested). The tile stays locked in every way that matters — no play button, no pause button, nothing in the picture to tap — and the same reduced-motion, Save-Data, and low-memory rules apply: those players see the resting still, and the film is never downloaded. Its media swaps through its own module (`src/assets/home-v5/locked-tile-media.ts`).

Two of the card films come in a second version, picked by the player's age band through two small selector functions in the same `card-media.ts` module. Little Explorer players (ages 5–7) see a softer Cold Trail film: the same walk out along the footprint trail and back, at a slower, gentler pace. Trail Scout players (ages 8–10) see a different Review film: the magnifying glass sweeps out and back over the satchel and settles on the usual picture, where the standard Review film overshoots, rewinds, and pauses to rethink. Every other player — including anyone who has not set a band, who gets the standard films — sees the films described above. The choice is exact and fails safe: only the one band named for each variant ever downloads it, the card boxes and the component never change, and the same reduced-motion, Save-Data, and low-memory rules apply to the variants too.

### Detective audio (Holmes & Watson)

GeoDetective has two spoken companions — Holmes on the map, Watson at the clue card — behind the `detectivePair` feature flag (live: `public/flags.json` carries it as `true` since the owner flipped it on 2026-11-06, PR #356). Their voices are **pre-rendered on purpose**: every line is recorded ahead of time with the two pinned voices, because a live text-to-speech voice on the player's device cannot hold the characters' measured pitch or pace. Lines live as plain MP3 files under `public/audio/detective/`, fetched only when a case plays — never bundled, never precached.

The render pipeline lives in `scripts/detective/`. One command re-renders a case end to end (five clue reads plus the answer read):

```bash
node scripts/detective/render-audio.mjs --case 137
```

Each render is measured (pitch and words-per-minute) and recorded in `public/audio/detective/manifest.json` with a hash of its exact words, voice, speed and gain. If a clue's words change later, that line's hash no longer matches, and the staleness gate — `npm run check:detective-audio`, also wired into every build — fails and names the stale line until it is re-rendered. Case 137 ships with its renders as the development/test case; the Capitals & Flags cases are the first claimed coverage.

### Holmes & Watson on the case

When the pair is switched on, two companions join GeoDetective. Watson stands by the clue card and reads each clue aloud. Holmes acknowledges, adds a short decode, then waits on the map: when a player pauses to think, he walks over and thinks beside the pause — never pointing, never hinting, because he never sees the answer, any guess score, or even which case is being played. A chosen place gets its name read back with one and the same suspicion line for every pick. A solve ends in a jump, a high-five with real hand contact, and a short deduction speech; a loss ends with Holmes reading the answer the game itself just revealed, and both of them pouting.

A player can also ask Watson to say the current clue again: while Watson is on screen for a clue or during the guessing that follows it, his figure carries a small ↻ badge, and tapping him — or focusing his "Ask Watson to repeat this clue" button and pressing it — replays that clue's read, acknowledgement, and decode from the start, even mid-read. This works whether clues play by themselves or only on tap; with sound off there is nothing held to replay, and the badge steps away with the speech.

Sound can be muted and unmuted from inside every edition — the speaker button sits on the game screen itself, never buried in a menu. All of these buttons are the same one switch (stored as `meridian.sound`), so they always agree. In GeoDetective the pair carries a small speaker chip of its own, and tapping Holmes flips the same switch; tapping Watson still only asks him to repeat the clue. Muting stops a line that is speaking right away, in the same tap, and a small crossed-out speaker badge shows on the pair while the sound is off — Holmes and Watson themselves look exactly as cheerful as ever.

Ending a game celebrates too, in every edition. When the pair is switched on and a player ends a game — State, Country, Globe or GeoDetective — Holmes and Watson appear on the summary card and run the same celebration around the final score: jump, high-five, claps. The session total and its per-edition split are shown inside their celebration frame, and Holmes says one fixed line ("What a game! Well played, everyone!"). He deliberately does not read the number aloud: early renders of a word-by-word spoken score measured pitch-unstable from one render pass to the next, so the score lives in the frame as text — exactly the number the card itself shows — and a spoken line can never disagree with it. While the celebration plays, the summary's storyteller narration waits its turn, exactly as it does for the game's other celebrations. On reduced-motion, Save-Data or low-memory setups the pair instead stands still at the high-five and stays silent; with the flag off, the summary card is unchanged.

The pair ships **behind the `detectivePair` feature flag** (`public/flags.json` carries it as `true` — the owner flipped it on 2026-11-06, PR #356). With the flag off, none of their code mounts and the game is exactly the game described above. Turning them off again is a flags change, not a new release.

Before a case's questions load, the pair wait on a bench under the map (the `hostsStaging` flag): Holmes glances at his watch, both sip coffee, and they speak the case-open lines from the bench. When the questions arrive they rise — Watson reads each clue from the gutter beside the clue card, never over its words, and Holmes stands in the bench slot until your first map interaction walks him onto the map. The coffee cups stay behind on the bench. Turning `hostsStaging` off restores the shipped pair — the pair as it first shipped, apart from two small permanent deltas that stay in both modes: Holmes's dock tap-to-mute area is his full figure width, and the pair's host mounts under the map section. With the `watsonWalk` flag on, Watson now walks down the gutter to each clue card and starts reading only when he arrives — turning the flag off, or using a reduced-motion or resource-constrained setup, puts him beside the card at once and the reading starts straight away.

On smaller or quieter setups the pair steps back instead of getting in the way:

| What the device asks for | What the pair does |
| --- | --- |
| Reduced motion | No walks — Holmes appears beside a thinking pause by an instant cut, after a longer 600 ms pause. Sound is unchanged. |
| Save-Data, little memory (≤ 4 GB), or battery saver | Holmes stays at his dock instead of walking, and clues no longer play by themselves — a **Listen** button beside the clue card plays the current clue's read, acknowledgement, and decode when tapped. |
| Sound off | No speech at all; the pair is pictures only, and every fact stays on screen as text. |
| Read-aloud set to "never" or "sometimes" | Same Listen button — it is never hidden, because it is the player's own tool. |

The decision itself is one small pure function, `resolveDetectiveDegradation` in `src/game/loop/detective/detective-degradation.ts`, and the voices follow the pre-rendered pipeline in [Detective audio](#detective-audio-holmes--watson) above.

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
| Friend challenge | Daily shared link | Stateless links in three formats: `#c=mc1...` Globe links (5–10 places, 750 km radius), `#c=mc2...` links for any edition, and the compact `#c=mc3...` links the game sends today — the same route packed into raw bytes instead of text (a 10-place state route is a 52-character payload, not 274), carrying a winner block — the sender's score, the stops they landed, their completions of the route, and the route's best score yet (flag-gated under `friendChallenges`). A challenge with a winner block opens with the target on the welcome card ("🎯 Beat {best}") under an honest note that a score in a link is the sender's word; the run shows the target on a small chip; and finishing brings a verdict screen — you beat it, dead heat, so close, or better luck next time — topped by a short looping cartoon, "Grandpa Was Already There" (Comet arrives doing finger-guns; Grandpa is already in the deck chair, coffee in hand, returning one lazy finger-gun), with a stop-by-stop comparison against the friend who sent it. The cartoon is decoration only — it never covers the score, and players who prefer reduced motion see the still picture instead of the movie. Passing the route along mints your own block (the best only ever rises, and from your third completion of the same route your score can't raise it), and you can always share just the route with no scores attached. Old mc1 and mc2 links still open exactly as before; new links are mc3, except a played Globe route, which still shares in its original mc1 form. Create one from Home, mid-game from the run menu, on a reveal card, at the end of a game, or from the screen at the end of a review (a fresh route from a map you pick — never dealt from your review deck, so the link is not a copy of your misses); a finished challenge passes its exact route along |

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

Meridian is directed to children, so every visitor is treated as a child. There are no accounts, no personal questions, and no cookies or persistent identifiers for analytics. Google Analytics and Microsoft Clarity were removed on 2026-10-21; the only analytics is optional, cookieless **Cloudflare Web Analytics**, injected only when the build has `VITE_CF_BEACON_TOKEN` set. Crash reports go to our own worker with a per-session random ID and coarse device buckets only. The full notice is the in-app **/privacy** page (linked from the home footer and the For grown-ups card); grown-ups reach the owner through the math-gated **/contact** form, which posts to `POST /api/contact` on the main `meridian` worker (`src/routes/api/contact.ts`; there is no separate contact worker). Delivery forwards each message to a private Discord channel when the `meridian` worker has its *own* secret `CONTACT_DISCORD_WEBHOOK_URL` — declared by name in the root `wrangler.jsonc` (issue #220), read from the worker's runtime bindings, and never the crash worker's `DISCORD_WEBHOOK_URL` (the two use different channels). When the secret is not set, the handler falls back to a `NoopSink` that accepts messages and stores nothing — and the page says so honestly instead of showing a thank-you, and keeps the visitor's draft so their words are not lost. The form's endpoint comes from `contactEndpoint` in `public/flags.json`. Background: `docs/reviews/2026-10-21-p0-p2-remediation.md`.

### Security headers

The security headers (CSP, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, Referrer-Policy, Permissions-Policy denying camera/mic/geolocation/payment, nosniff, COOP, HSTS) come from one place: `src/lib/security-headers.ts`. They are delivered two ways. Server-rendered responses (every HTML page and `/api/contact` on the `meridian` worker) get them from the request middleware in `src/start.ts`. Cloudflare does **not** apply `public/_headers` to Worker-generated responses. Static assets get them from `public/_headers`, which also sets `immutable` caching for hashed `/assets/*` and `no-cache` for `sw.js` / `flags.json`. Server-rendered HTML also gets `Cache-Control: public, max-age=0, must-revalidate` from the same `src/start.ts` middleware (the constant `HTML_CACHE_CONTROL` in `src/lib/security-headers.ts`), because `_headers` never reaches Worker-rendered pages. A unit test fails if the two drift apart. See `docs/security-headers.md`.

### Installable (PWA)

Meridian ships a web manifest, app icons, and an offline page, so it can be installed from the browser. Updates never interrupt play: when a new version is detected, a toast offers "Update now" (applies the update and reloads once) or "Later" (dismisses; the update applies on the next fresh load). The service worker registers in production builds only. The manifest (`./` scope/start URL) and `sw.js` (base derived from its own URL) carry no hardcoded base path, so the same files work under `/Meridian/` on GitHub Pages and `/` on Cloudflare.

Imagery: `Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community`. The imagery host sees the area on screen. Your pin stays on the device. Place data: GeoNames (CC-BY 4.0). Wikipedia-derived history notes: CC BY-SA, via the in-app source links.
