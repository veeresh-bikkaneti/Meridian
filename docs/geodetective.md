# GeoDetective — the daily 5-guess edition

GeoDetective is Meridian's 4th edition (Globe → Country → State →
GeoDetective). One mystery place per day, five guesses, a narrowing clue
ladder. Built on branch `feat/meridian-loop`; internal names stay
`meridian.loop.v1` / `src/game/loop/`.

## Rules

- A new puzzle lands at **midnight UTC** every day.
- The player gets **5 guesses**. Each guess unlocks the next clue card and
  reports: distance to the target (km), the direction from the guess toward
  the target (8 winds), and warmer/colder vs. the previous guess.
- Guesses are **constrained**: the player picks from a typeahead over the
  `public/loop/names.json` index. Free text never submits. A repeated place
  never consumes a guess — the UI says so and announces it.
- Win: guess the exact place within 5. Loss: 5 wrong guesses — then the
  giveaway clue and the answer are shown, and every clue card is revealed.

## Clue ladder (positional)

`public/loop/clues/{index}.json` carries `clues` in this order:

1. Geography — plain-spoken, picture-able, never coordinates/elevation
2. Climate — landforms → weather intuition, non-redundant vs. geography
3. History — history first, one true memorable hook
4. The hook — person, event, record, quote; retellable or it failed
5. Giveaway — a landmark that names the place without naming it

The clue file **never** contains the place name or region tags. On a loss,
the answer name is looked up lazily from the shared guess index.

## Day index

```
index = Math.floor(Date.now() / 86400000) % manifest.size
```

The runtime (`src/game/loop/day.ts`) and the data pipeline
(`scripts/build-loop.mjs` → `dayIndexFor`) share this exact formula; the
build script assigns `clues/{index}.json` with the same computation.

**E2E seam:** `?loop-date=YYYY-MM-DD` pins the day the screen uses.
Malformed dates and rollover dates (2026-02-30) are rejected; the seam is
inert otherwise and production play always uses the real clock.

## Persistence

- Namespace `meridian.loop.v1` in localStorage, keyed by UTC date key
  (`YYYY-MM-DD`). The Loop **never** reads or writes `meridian.run` /
  `meridian.drop` (the endless-run keys).
- Reload mid-day restores the in-progress state (PR #31 pattern: restore
  on mount, never reset). A separate `meridian.loop.open` flag records
  whether the GeoDetective screen was open, so a mid-game reload reopens
  the screen — while an explicit "leave to editions" stays on the menu.
- The archive prunes to the last 30 days on write.

## Share text

Three lines, spoiler-free (no names, no distances):

```
meridian geodetective <Month D>
https://veeresh-bikkaneti.github.io/Meridian/
<5 emoji slots> <solved in N | not solved>
```

Each guess grades by proximity: 🟩 win · 🟨 <500 km · 🟧 <2000 km ·
🟥 farther; ⬜ for unused guesses.

## Accessibility

- Typeahead is a WAI-ARIA 1.2 combobox: arrow-key navigation, Enter picks,
  Escape closes, `aria-activedescendant`, live status announcements
  (loading / no-match / duplicate-guess notice).
- `prefers-reduced-motion`: clue/reveal entrances degrade to a 150 ms
  opacity fade — no translate, no rotation.

## Content gate (cleared 2026-10-05)

The content gate is **satisfied**: **387 validated clue sets** now ship in
`public/loop/clues/` on main (PR #59 merged, manifest `size:387`). The 12
hand-written engineering seeds from `feat/meridian-loop` were placeholders
and are retired — they were never carried onto this branch. The mode code
here consumes main's production content; no game code touches clue content.

## File map

- `src/game/loop/` — `types.ts` (shared contract), `engine.ts` (pure
  5-guess state machine), `store.ts` (persistence + 30-day pruning),
  `day.ts` (UTC index math + `?loop-date=` seam), `evaluate.ts` (input
  ranking/index), `guess-input.tsx` (combobox), `LoopScreen.tsx` (screen)
- `scripts/build-loop.mjs` — data pipeline (seed verification, name
  index, manifest); `scripts/build-loop.test.mjs` — 11 pipeline tests
- `public/loop/` — `manifest.json`, `names.json` (119,039-entry guess
  index, built by `build-loop.mjs`), `clues/{index}.json`
