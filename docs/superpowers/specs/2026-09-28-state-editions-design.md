# Meridian editions: state, country, globe

Date: 2026-09-28
Status: approved 2026-09-28

Lincoln was a sample of scale, not the product. This design replaces city and street play, the five-round card, and the MapTap-style weighted share.

## Outcome

A player picks one edition, sees a place name, and drops a pin on real satellite imagery. A pin inside that place's radius continues the run. The first pin outside it ends the run. The shared result is how many places they placed, not a score out of 1,000.

Success looks like this:

- All 50 states are playable, plus a short country list, plus one globe.
- Two people who open the same state on the same UTC day start on the same trail.
- The run does not stop at five.
- The map is satellite, unlabeled, locked to the region they opened.
- The model is not called to redraw a place the cache already holds.

## Editions

| Edition | What you open | Trail |
|---|---|---|
| State | Any of the 50 US states | Shared per state per UTC date |
| Country | One country from the launch list | Shared per country per UTC date |
| Globe | The earth. Nothing to pick. | One shared trail per UTC date |

Launch countries, in this order: United States, Canada, Mexico, Brazil, United Kingdom, France, Germany, Italy, Egypt, India, China, Japan, Australia.

The United States country pack is country-scale places (a river system, a range, a coast), not a second copy of the state catalogs. The District of Columbia is not a state pack. No city packs, no street grid, no Lincoln-only mode. Other countries wait until this list is actually good.

## A round

1. The prompt is the place name. No clue-instead-of-name, no multiple choice.
2. The player drops one pin on the satellite map.
3. Distance is measured in kilometers.
4. If the distance is less than or equal to that place's radius, the pin is a hit. The short story is shown, then the next name.
5. If the distance is greater than the radius, the run ends. The real spot is marked. No further places are offered.

Landing outside the state or country does not end the run by itself. A border place can be hit from across the line when the pin is still inside the radius. Leaving the border only matters when that also means leaving the radius.

There is no round cap and no "one more chance."

## Radius

The radius scales with the region. It is computed from the greater side of the region's bounding box, in kilometers.

| Edition | Rule | Clamp |
|---|---|---|
| State | 12% of the greater side | 25 km to 160 km |
| Country | 12% of the greater side | 40 km to 450 km |
| Globe | Fixed | 750 km |

The same radius is used for every place in that region. It does not change from round to round.

Each hit still shows the distance, so a near center and a pin on the edge of the circle feel different. Neither ends the run. The published result is the count of hits only.

## Trail order

The order is computed, not stored. It has to be the same for everyone and it must not change under a player who is mid-run.

- Take the places in that region's pool that already existed at 00:00 UTC on the trail date.
- Order them with a seed of `UTC date + edition + region id`. The same set always produces the same order.
- Places added after 00:00 UTC that day are appended in insertion order for the rest of that date. They join the normal seeded order on the next UTC date.
- Two players who start the same region on the same UTC date both begin at position 0.
- A session remembers the index, so a reload in the same session resumes the next place.
- A new session starts again at position 0. The game does not remember which places this person has seen across sessions. There is no account.

## Share

No place names. No emoji row. No total out of 1,000.

```
meridian September 28
Nebraska · 14
```

```
meridian September 28
Japan · 9
```

```
meridian September 28
Globe · 6
```

The date is the UTC trail date, written as an English month name and day. The current year is omitted. A zero-hit run still shares, as `Nebraska · 0`.

## Map

State and Country use a slippy satellite map (MapLibre), locked so the camera cannot wander off that region's bounds. The player can zoom and pan inside it. The globe edition is a satellite sphere of the same imagery, not a crawl of street-level tiles.

Imagery is Esri World Imagery, requested live:

`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`

Attribution, always visible: `Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community`

Tiles are not downloaded for offline use and are not bundled. Esri's license does not allow exporting them.

The imagery host sees the area on screen. The pin is not sent to a server and is not stored. The UI says this in one line near the map.

The hand-drawn road basemap, the city camera, and the WebGPU street presenter are not used for these editions. USGS NAIP is a possible later public-domain replacement for state imagery. It is not part of this version.

Place names are not drawn on the map. The real spot and the player's pin appear only after a hit or a miss.

## Places

A place is a name, a longitude, a latitude, a short story of two or three sentences, and a source label with a URL.

Starter catalogs, so a run can begin without the model:

- At least 5 authored places for each of the 50 states.
- At least 5 authored places for each launch country.
- At least 12 authored places for the globe.

Stories are original and short. They are the trivia. They are shown after a hit, not before the pin. Sources are real pages about that place.

## Model and cache

The model runs only on the server, on the owner's key. It is not called from the browser, not called on page load, and not called to regenerate a stored place.

A new place is requested only when a player asks for the next pin and the permutation has no further stored place. One place is requested. Output is capped. If the request fails, it is tried once. If it still fails, the run ends with a plain "no further places" message and the count already earned. It does not repeat an earlier place.

A generated place is stored only when:

- It has a name, coordinates, and a story.
- The name is not already in that region's pool.
- For a state or country, the point falls inside that region's polygon.
- For the globe, the point falls on land.

A point that fails the check is discarded. It is not shown. One replacement may be requested. A second failure ends the extension and keeps the hits already earned.

Stored fields are the place itself. Pins, names of players, and how far a run got are not written to the database.

The database is on, accounts stay off. Pool rows are unowned. There is no user id on them.

Two players reaching the end of the pool together must not create two copies. The unique key is edition + region + normalized place name. The loser of that race reads the stored row.

## What this retires

- Home Turf, Lincoln streets, the region ring, and the visitor-versus-local home choice.
- Five fixed rounds and the weights ×1 ×1 ×2 ×3 ×3.
- The emoji share line and the final score out of 1,000.
- Country and continent score lifts. The radius replaces them.
- The drawn vector basemap as the thing the player pins on.

Session behavior that stays: no login, the in-progress run lives in session storage, and a hard reload or a dead session starts a new player at the beginning of today's trail.

## Out of scope

Accounts, streaks that survive a session, friends, leaderboards, flags, voyage checklists, timed gauntlets, and a personal "never show this place again" memory. Those need an identity this game does not have.
