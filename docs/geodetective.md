# GeoDetective — the unlimited 5-guess mystery edition

GeoDetective is Meridian's 4th edition (Globe → Country → State →
GeoDetective). **Fully unlimited play** — mysteries are dealt from a
shuffled deck over the clue pool; no daily puzzle, no midnight-UTC
reset. Five guesses, a narrowing clue ladder. Internal names stay
`meridian.loop` / `src/game/loop/`.

The clue directory now ships **459 files**: the 387 core sets plus
the Capitals story pack's 72 sets at indexes **387–458**. The pack
deals as its own deck from the shelf (see "Persistence" and
`docs/story-packs.md`); the core deck is unchanged.

## Rules

- Mysteries are dealt from a **shuffled deck** over the clue pool; when
  the deck is exhausted it reshuffles. There is no daily puzzle and no
  UTC-day keying — the day-pinning era is retired (see "The day-formula
  era is retired").
- The player gets **5 guesses**. Each guess unlocks the next clue card
  and reports: distance to the target (km), the direction from the
  guess toward the target (8 winds), and warmer/colder vs. the previous
  guess.
- Guesses are **map taps**: tap a labeled place to open the bottom-sheet
  confirm; unlabeled or ocean taps are legitimate guesses too, scored as
  "Open Water". A repeated place never consumes a guess — the UI says
  so and announces it.
- Win: guess the exact place within 5. Loss: 5 wrong guesses — then the
  giveaway clue and the answer are shown, and every clue card is
  revealed.
- Solve streaks persist as `bestStreak` and appear on the share line
  once they reach 2.

## Clue ladder (positional)

`public/loop/clues/{index}.json` carries `clues` in this order:

1. Geography — plain-spoken, picture-able, never coordinates/elevation
2. Climate — landforms → weather intuition, non-redundant vs. geography
3. History — history first, one true memorable hook
4. The hook — person, event, record, quote; retellable or it failed
5. Giveaway — a landmark that names the place without naming it

The clue file **never** contains the place name or region tags. On a loss,
the answer name is looked up lazily from the shared guess index.

## The day-formula era is retired

The old model keyed puzzles by UTC day:

```
index = Math.floor(Date.now() / 86400000) % manifest.size
```

That day-pinning is **gone**: no puzzle lands at midnight UTC anymore.
`dayIndexFor` (in `scripts/build-loop.mjs`) and the `?loop-date=` seam
are legacy.

**E2E seam:** `?loop-puzzle=<index>` pins the dealt puzzle for the
mount, so specs can target a known mystery without the real clock.

## Persistence

- Namespace `meridian.loop.v2` in localStorage — one JSON blob for the
  whole store, with no UTC-day keying. The v1 daily-era archive is kept
  untouched. The Loop **never** reads or writes `meridian.run` /
  `meridian.drop` (the endless-run keys).
- Reload mid-game restores the in-progress state (PR #31 pattern:
  restore on mount, never reset). A separate `meridian.loop.open` flag
  records whether the GeoDetective screen was open, so a mid-game
  reload reopens the screen — while an explicit "leave to editions"
  stays on the menu.
- Pack decks live in the same blob, in their own fields: `packDecks`
  (one deck state per pack, keyed by pack id) and `activeDeckId`
  (which deck the shelf last selected). The core deck's fields keep
  their pre-pack shape; a deck switch never writes another deck's
  state, and opening the edition resumes the deck holding an
  unrevealed current case ahead of the stored selection.
- Cold Trail keeps its pack progress separately, under
  `meridian.coldtrail.pack.capitals.v1`. Resetting one edition never
  touches the other's pack state; the shelf selection itself lives
  under `meridian.pack-shelf.v1` and is cleared by either edition's
  full reset.

## Share text

Three lines, spoiler-free (no names, no distances):

```
meridian geodetective <Month D>
https://meridian.knowledgetest.workers.dev/
<5 emoji slots> <solved in N | not solved> · 🔥 N best streak
```

Each guess grades by proximity: 🟩 win · 🟨 <500 km · 🟧 <2000 km ·
🟥 farther; ⬜ for unused guesses. The streak line appears when the
best streak reaches 2. Solving all 387 mysteries earns the
full-collection celebration.

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

Indexes **387–458 are pack-owned**: they are generated from the
Capitals pack records by the composer and gated by
`scripts/packs/validate-pack.mjs`, not by the core content gate.
Never hand-edit them — fix the record and re-run the pack rebuild
(`scripts/packs/README.md`).

## File map

- `src/game/loop/` — `types.ts` (shared contract), `engine.ts` (pure
  5-guess state machine), `store.ts` (persistence under `meridian.loop.v2`),
  `day.ts` (legacy UTC index math, no longer used for dealing),
  `evaluate.ts` (input ranking/index), `guess-input.tsx` (combobox),
  `LoopScreen.tsx` (screen), `packs.ts` (pack manifest/sidecar loading
  and validation, pack deck dealing)
- `scripts/build-loop.mjs` — data pipeline (seed verification, name
  index, manifest); `scripts/build-loop.test.mjs` — pipeline tests
- `public/loop/` — `manifest.json`, `names.v2.json` (119,038-entry guess
  index as packed columns, built by `build-loop.mjs`, decoded by
  `src/game/loop/names-codec.ts`), `clues/{index}.json`
- `public/packs/` — per-pack `manifest.json` + `loop-meta.json` sidecar
  (Capitals: indexes 387–458), generated by the pack composer
- `scripts/packs/` — pack authoring records, inputs, validator,
  composer, and the rebuild runbook (`scripts/packs/README.md`);
  design of record: `docs/story-packs.md`
