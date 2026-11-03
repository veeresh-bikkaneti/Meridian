# Story pack tooling — runbook

Everything that turns authored pack records into shipped game data
lives here. The design these tools implement is
`docs/story-packs.md` in this repo — read it first; this file is
only the operating sequence.

## The rebuild sequence (run in this order)

After any change to a record in `scripts/packs/capitals/cases/` or
its authoring input in `scripts/packs/capitals/inputs/`:

1. **Validate the records.**
   `npm run packs:validate` (all cases) — or
   `node --experimental-strip-types scripts/packs/validate-pack.mjs <caseId> …`
   for a few. Exit 0 or stop: nothing downstream is worth building
   on a record the gate rejects.
2. **Compose the loop artifacts.**
   `npm run packs:compose` — rewrites the pack's clue files, its
   manifest, and its sidecar. A re-run with no record changes must
   show no drift except the manifest's `generatedAt` timestamp;
   restore that one field rather than committing a new timestamp.
3. **Regenerate the Cold Trail deck.**
   `npm run packs:coldtrail` — rebuilds the Cold Trail pack deck
   from the records. The Capitals deck is 60 cases; a different
   count means the records or the generator changed, not a rounding
   error.
4. **Run the repo gates.** `npm test`, `npm run test:worker`,
   `npx tsc --noEmit`, `node scripts/lint-cards.mjs`,
   `npm run build:pages`. The build's own content gates
   (`check-generated-places`, `lint-content` via prebuild) run as
   part of `build:pages`.

## Generated files — never hand-edit

These files are outputs. Fix the record or the tool, then re-run
the sequence above:

- `public/loop/clues/387.json` … `public/loop/clues/458.json`
  (the Capitals pack's clue files; indexes 0–386 are core-owned and
  are not pack outputs)
- `public/packs/capitals/manifest.json`
- `public/packs/capitals/loop-meta.json`
- `src/game/coldtrail/cases.capitals.generated.json`

## Adding pack 2 — what is generic, what is Capitals-only

**Generic (reuse as-is):**

- `schema.mjs` — the `meridian.pack.case.v1` record contract and the
  shared record checks (shape, ladder, sources, leak rules). It is
  pack-agnostic; `validatePackRecord` is the one implementation
  every gate calls.
- `compose-packs.mjs` — takes a pack id as its argument and composes
  any pack's clue files, manifest, and sidecar from its records.
- The shelf and runtime (`src/components/pack-shelf*`,
  `src/game/loop/packs.ts`) read packs from their manifests; a
  second pack appears by shipping its manifest and sidecar.

**Capitals-only (expect to generalize or duplicate deliberately):**

- `validate-pack.mjs` — hardcodes the Capitals pack: the dataset
  identity checks, the Hyderabad wiring against the capitals
  chunks, and the capital/capitol blurb rules are written for this
  pack's category.
- `build-coldtrail-capitals.mjs` (repo root of `scripts/`) — the
  Cold Trail generator for the Capitals deck, including its curated
  fallback id list.
- The shelf's v1 wiring names the first pack directly
  (`FIRST_PACK_ID` and `CATEGORY_LABELS` in
  `src/components/pack-shelf-data.ts`); a second pack needs that
  list widened, not a second shelf.
