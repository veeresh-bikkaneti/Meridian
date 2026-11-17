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

## Done — P2 sweep (owner approved 2026-11-16)

- **Item 28:** one name — "Ask for something new" — everywhere. The flow is
  a feature request, not a tip jar: the form's own words are "you can
  request a feature! Tell us what your child would love to play or learn
  next", it posts via `sendFeatureRequest`, and its heading, the section
  aria-label, the board footer button, the grown-ups nav and the Home
  grown-ups link already used that name. The board nav button was the one
  outlier ("Send a tip") → renamed. Surfaces checked: board.tsx (nav +
  footer + section), feature-request-form.tsx, grownups/info-page.tsx,
  game-app.tsx grown-ups link — no third name anywhere. A unit pin fails
  if "Send a tip" returns to board.tsx or the form. (The internal view
  key stays `tip`; not player-visible.)
- **Item 29:** structure-view feature labels were clipped by atoms. Two
  causes: the chip floated only 1.2 units above its bubble, leaving its
  bottom edge level with the highest atom tops (story centres reach
  0.7425 × radius, plus the 0.72 atom radius — clearance ≈ 0.01 on the
  smallest bubble), and the sprite material depth-tested, so any atom in
  front punched a hole in the text. Fix: `LABEL_LIFT` 1.2 → 2.2 (now in
  status-core beside computeLayout, with the derivation) and the label
  material is `depthTest: false` with `renderOrder = 10`, so no mark can
  ever clip a chip. Pinned by a measured layout assertion over the real
  published board (every chip's bottom edge above every atom top in its
  bubble) plus a source pin for the material flag.

## Done — Review Round 2 (bugs 7 + 9)

- **Bug 9, spec updates:** the board e2e spec still expected the pre-fix
  board. Measured against the published file and the rendered board, then
  updated in place: counts line "13 not started yet" → "9 not started yet"
  (snapshot test + live-feed test; counts are 24/4/9 since item 25, and
  22/6/9 with record 430 re-opened); the life pill reads "1 of 3 steps
  done" (item 26's wording); two pills now read 100% (Maths 5/5 and Story
  Journals 4/4 — item 25's data fix finished the Journals feature);
  group rows follow item 26 (see below); the grown-ups shell test scopes
  its "What's coming" locator to the Grown-ups nav — the credits page
  legitimately carries two board doors (nav + body), so the unscoped
  locator hit a strict-mode duplicate.
- **Bug 9, empty-group behaviour in the spec:** only groups with stories
  render (item 26). Snapshot board: 18 of 36 possible group rows exist,
  Blocked is not one of them (every recorded wait is satisfied). Live-feed
  test: exactly one Blocked row renders — the waiting story's own.
- **Bug 9, empty-group unit test:** `src/board/trail-view.test.ts` pins
  the render the way this repo pins render behaviour its unit harness
  cannot mount (the strip-types runner cannot import .tsx; same pattern
  as the depthTest source pin): the empty-group early return must sit
  inside the group map before the section is created, and no empty-group
  line may render. Verified red on main (2/2 fail in the hermetic
  worktree, main's src) and green here. The unreachable empty-line
  ternary the item-26 fix left behind in trail-view.tsx is removed,
  with the now-unused GROUP_EMPTY table.
- **Bug 7 / A.7, label-vs-dot bounding boxes:** new test in
  status-core.test.ts asserts no feature chip's 3D bounding box
  overlaps any atom's 3D bounding box — every chip against every atom,
  not just its own bubble. Chip width is now one shared constant
  (`LABEL_WIDTH = 9` in status-core; molecule-map scales the sprite
  from it instead of a bare 9). Measured on the real published board:
  3D overlaps = 0. In the x/y projection there is exactly 1 crossing
  pair ("Why Do We Learn This?" chip vs a Physics & Chemistry atom) —
  the pair is separated by ~5 units in z, and no lift value clears the
  projection (scan: 2 crossings at lift 1.2, 1 at 2.2, 2 at 3.0/3.5 —
  the two bubbles stack 11.9 apart with radii summing 10.6, a 1.3 gap
  the 2.25-tall chip cannot fit). `LABEL_LIFT` stays 2.2: it is the
  scan's minimum and the z separation plus depthTest-off rendering is
  what keeps dots off labels in the scene. Honest limit: the 3D test
  also passes on main — it pins the geometry against future layout
  drift rather than catching a main defect; the projection count is
  the part that improved (2 → 1).
- **E2E evidence (hermetic recipe, complete installs, pinned Chromium):**
  main baseline 18/18 pass (main's spec vs main's board); this branch
  before the spec updates 14/18 — the 4 failures were exactly the
  deltas above; after the updates 18/18 pass. No app-behaviour delta:
  the only runtime-code change is the dead-code removal and the
  LABEL_WIDTH constant (same value, 9).
- **Merge-train note:** this branch carries PR 516's commit `0cf46af8`
  ("Board copy: the What's Coming header keeps only its Updated
  stamp") in its history. When the train rebases onto merged 521, drop
  that commit (or wait for 516 to merge first) — do not rebase or drop
  it before then.

## Gates

- Board unit tests: 61/61 (`node --experimental-strip-types --test src/board/**`).
- `npx tsc --noEmit`: clean. `npm run lint:nav`: clean.
  `npm run check:provenance`: PASSED.
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

- Done: items 23 (answers + guard verified), 24, 25, 26, 27, 28, 29;
  Review Round 2 bugs 7 + 9 (spec updates, empty-group unit test,
  chip-vs-atom 3D bounding-box test).
- Next: merge train — 521 lands first on the owner's word, then this
  branch rebases onto merged 521 and drops 516's commit `0cf46af8`.
  Screenshots at 2560/1280/390 still owed.
- Open: none for the owner inside this stream's share.
