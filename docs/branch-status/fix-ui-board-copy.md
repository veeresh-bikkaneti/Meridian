# Stream B — the board ("What's coming")

Branch `fix/ui-board-copy`. **Base: PR 516's tip** (`origin/fix/board-updated-copy`,
`0cf46af8` — main `2ce6757a` after 508, plus 516) per owner condition 3, so
nothing 508/516 did is redone. Stream S cherry-picked: `a0458929`, `cc745790`.

## Done

- **Item 23 leftovers:** no code builds "Live from GitHub" anymore (grep over
  src, tests excluded: only the banned-token guard at `status-core.ts:294`
  and its test pin remain — that guard is the enforcement of 516's wording,
  kept deliberately; deleting it would weaken the gate). Two mysteries answered:
  - *31 vs 37:* the live check counts **distinct linked records** in
    `board-links.json` (31), the board counts **stories** (37). Different
    denominators, both right — the old header put the record count in a
    story-shaped sentence. [measured from the published JSONs]
  - *6:26 AM at 2 PM:* the snapshot's `updatedAt` is `2026-11-16T12:26:19Z`
    = 6:26 AM CST. `formatUpdated` renders it with the viewer's own zone and
    clock (`toLocaleString(undefined, …)`) — the stamp is when the board
    data was published, not the current time; at 2 PM the newest published
    snapshot was still the 6:26 AM one. No code change needed. [measured]
- **Item 24:** one name — "What's coming" — H1, page title, nav link
  (grown-ups nav + tip-form thank-you link), the default view button, the
  loading line. "See what we're making next" and "the trail" are gone from
  player-visible text.
- **Item 25:** fixed at the data source. `src/board/curation.json` carried
  `not-started` for four shipped stories with no linked records (status-core:
  record-less stories keep their carried status): "Tap the card and go
  straight into a subject", "The Physics & Chemistry screens", "Short film
  clips for the journals", "The journals open to everyone" → `done`, and the
  publisher regenerated the four published files. Counts: 24 done / 4 in
  progress / 9 not started (was 20 / 4 / 13). Test pins updated in the same
  commit (status-core, live-feed).
- **Item 26:** one status per item (groups are exclusive by construction);
  empty groups no longer render — no "Blocked 0" rows; parent summaries say
  "steps" (header counts line, feature-card aria-labels, feature toast).
- **Item 27:** the control panel is now two labelled rows — Views and
  Settings. Calm mode is a labelled switch: `role="switch"`, visible
  "Calm mode" + On/Off, MapModeToggle's 44×24 track / 20px knob recipe in
  board.css's own `--hv5-forest` colours.

## Deferred (recorded, not silent)

- Item 28 ("Send a tip" vs "Ask for something new") — per Phase 2 re-price.
- Item 29 (structure-view labels clipped by dots) — per Phase 2 re-price.

## Gates

- Board unit tests: 58/58 (`node --experimental-strip-types --test src/board/**`).
- `npx tsc --noEmit`: clean. `npm run lint:nav`: clean.
- Screenshots: NOT taken — this sandbox's node_modules is a borrowed tree
  from an older checkout, so a local build would not prove the board's
  pixels. CI + Phase 3 screenshot check carry it.
- E2E pins updated (counts line 24/22 of 37 steps, page-name strings); the
  22 is inferred from the same recompute path the live-feed unit pin (22)
  proves.

## Graph

- Node: branch `fix/ui-board-copy` (stream B, items 23–27), base PR 516 tip,
  stacks on PR 516; board.tsx also touched by PR 517 — merge order is the
  owner's call.

## Handoff

- Done: items 23 (answers + guard verified), 24, 25, 26, 27.
- Next: Phase 3 combined review; screenshots at 2560/1280/390 still owed.
- Open: none for the owner inside this stream's share.
