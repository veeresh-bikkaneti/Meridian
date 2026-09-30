# Meridian

Pin the place. The run lasts until the pin misses.

Play it at [veeresh-bikkaneti.github.io/Meridian](https://veeresh-bikkaneti.github.io/Meridian/). The capital M is part of the address. The lowercase path is not this site.

## How a round goes

You pick **State**, **Country**, or **Globe**. A state is any of the 50. A country is one of thirteen. The globe is one shared trail.

The prompt is a place name. The map is unlabeled satellite imagery. It opens on your region — pinch out any time for the whole Earth, pinch back in and the map locks onto the region again. Tap to place a pin — tap again to move it. Double-tap (or double-click) to drop the pin, or press **Drop pin** when you're sure: that's your one guess, and the pin locks in. Pinch to zoom. Inside the close-enough radius, a short story appears and the next name follows. Outside it, the run ends. Either way the map draws the line from your pin to the spot, labels the distance, and shows the close-enough circle. There is no fifth round. If the list runs out, the run ends with the count you already earned.

Every round opens the same way: the globe spins once in the dark, then the camera dives onto your region and the region lights up gold. Pinch out any time for Earth from space — the gold outline stays on your region so you never lose it. Pinch back in and it re-locks.

The same region on the same UTC date starts in the same order for everyone. A reload in the same tab resumes. A new visit starts at the beginning. There is no account.

The share line is how far you got, not a score out of 1,000:

```
meridian September 28
Nebraska · 14
```

## Inspired by MapTap, not a copy

[MapTap](https://maptap.gg/) is the daily that suggested a pin on a map and a line you can share. Meridian keeps that feeling and leaves the rest.

| | MapTap | Meridian |
|---|---|---|
| Length | Five rounds, then the card is over | Until the first miss, or the list ends |
| Result | Weighted scores and an emoji row | How many places you placed |
| Prompt | A clue, then the map | The place name, then the story |
| Where | One daily world (and practice sets) | Any state, a short country list, or the globe |
| Map | MapTap's globe | Live satellite, unlabeled — zoom out to space, zoom back to the region |
| Same puzzle | Yes, for that day's five | Yes, for that region on that UTC date |

MapTap's places are a checked atlas. Meridian's are too. A model does not invent the next place, so Safari and DuckDuckGo play the same trail as Chrome. If Chrome already has Gemini Nano installed, it may rewrite the story after a hit, using only the facts already written. It does not download a model, and it does not change the pin or the count.

## Architecture

The game in the browser is four pieces.

- **Atlas.** `src/game/starters.ts` is the whole trail: name, coordinate, story, and a source link. At least five places for each state and launch country, and twelve for the globe.
- **Rules.** `src/game/radius.ts` decides the close-enough circle. `src/game/trail.ts` orders a region's places from the UTC date. `src/game/run.ts` continues until a miss or the end of the list. `src/game/share.ts` writes the share line.
- **Map.** `src/map/satellite-map.tsx` draws Esri World Imagery with MapLibre. State and country cameras open inside that region's box — pinch out and the box releases to a full Earth-from-space view, pinch back in and it re-locks. The globe is the same imagery on a sphere. Tiles are requested by the browser. They are not bundled. The pin is not sent anywhere.
- **Story rewrite.** `src/game/rewrite.ts` asks Gemini Nano only when the browser reports the model is already available. Otherwise the written story is what you read.

Nothing about a guess is stored on a server. The in-progress run lives in `sessionStorage`.

## Design

The radius is 12% of the region's greater side: 25–160 km for a state, 40–450 km for a country, and 750 km on the globe. A pin exactly on the radius counts. Landing outside the border does not end the run by itself.

Latitude is 110.574 km per degree. Longitude is 111.32 km per degree times the cosine of the center latitude. The greater of those two sides is the one the percentage is taken from.

The order is a seeded shuffle of that region's authored places. Two people who open Nebraska on the same UTC date begin at the same place.

Stories are original and short. They are shown after a hit, not before the pin. United States country places are country-scale features, not a second copy of the state names.

The written design is `docs/superpowers/specs/2026-09-28-state-editions-design.md`. The build steps are `docs/superpowers/plans/2026-09-28-state-editions.md`.

## Deployment

The public site is GitHub Pages, from a static build. `GITHUB_PAGES=1` sets the asset and router base to `/Meridian/`, turns on a static shell, and skips the server. `.github/workflows/pages.yml` runs that build on `main`, copies the shell to `index.html` and `404.html`, and publishes it.

`npm run build` is a different path. It still produces the server build. The live preview uses that. Pages does not.

MapLibre's worker is a sibling file the bundler would otherwise drop. The Pages build copies `maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs` into `assets/` so the map can start. Without those files the canvas is blank.

```sh
npm run dev
npm test
npm run build:pages
```

Imagery: `Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community`. The imagery host sees the area on screen. Your pin stays on the device.
