# Waymark

A daily geography game you can play in the browser. Lincoln is the first home edition. The world game is open to everyone.

This is the open-source cut of a larger plan. It is deliberately small.

## What this version is

- **World**, five places on a globe, the same set for every player on a local date.
- **Home Turf**, five places that widen from Lincoln to the surrounding lakes, Nebraska, and the United States. Players outside Lincoln get Nebraska and the United States until another city is added.
- The map has **no labels** until a guess is locked. Roads can be turned off.
- Scoring follows the [MapTap](https://maptap.gg/faq) curve: an exponential drop to 0 at 16,250 km, a country or continent lift on World and United States rounds, then round weights ×1 ×1 ×2 ×3 ×3 out of 1,000. Home Turf uses the same curve on a shorter reach. The share text includes each score, its weight, and any lift, and never a place name.
- **No account.** Your name and guesses stay in this tab (`sessionStorage`). A reload, or the end of the browser session, treats you as a new player. Guesses are not sent to a server, and the session cookie stores no name or location.

## What was left out on purpose

Login, friends, streaks that survive a reload, server-side scoring, hosted map tiles, and in-browser model quizzes. Those need accounts or third parties. This build keeps the puzzle on the device so a deploy can be a static site, including GitHub Pages.

Map shapes for the world and the United States come from [Natural Earth](https://www.naturalearthdata.com/) via the `world-atlas` and `us-atlas` packages (public domain). Lincoln streets, parks, and the rivers around the city are simplified [OpenStreetMap](https://www.openstreetmap.org/copyright) extracts bundled with the app (ODbL). Nothing is requested from a tile server while you play, so a guess is not sent anywhere. Stories are original and short. Place coordinates are geographic facts. The game code in this repository is MIT; the bundled OpenStreetMap extract is not.

## Play

```sh
npm run dev
```

The app serves the game for local development. `npm run build` produces the static bundle.
