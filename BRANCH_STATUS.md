# Branch status: swarm/capitals-content

Swarm Slice 2 of 4, story packs (issue #319). Base: main `193b57c`.
Scope: content only. All 72 capitals cases from `CAPITALS-PACK.md` authored as
`meridian.pack.case.v1` records under `scripts/packs/capitals/`, plus their
authoring inputs and the pack test. No runtime or engine code (Slices 1 and 3),
no `game-app.tsx`, `card-film.test.ts`, or `card-media.ts` (Track A). No PR and
no merge from this slice. The Stacker integrates.

## Done condition

- 72 case records, one per curated capital (44 countries, 28 US states).
- Every record passes the pack test: record shape, the repo clue validator run
  on a `meridian.loop.clues.v1` view with the case input, the Hyderabad gate
  through `validateGeneratedPlace` with the same boxes
  `check-generated-places.mjs` uses, and an exact coordinate match against the
  shipped chunk record for the same GeoNames id.
- Every clue carries a verbatim quote from the case's supplied Wikipedia
  extract. No case exists without a GeoNames row (fail closed).

## Status

- [x] Authoring inputs built and verified for 72 of 72 cases
  (`scripts/packs/capitals/inputs/`). Each input joins the pack doc row, the
  GeoNames extract row (exact id, name, coordinates), the shipped chunk
  record, and the Wikipedia lead plus climate section.
- [ ] Pack test written (`scripts/packs/validate-pack.mjs`,
  `scripts/packs/pack-records.test.mjs`).
- [ ] Pilot case (Paris) authored and sealed through every gate.
- [ ] Remaining 71 cases authored in tier batches.
- [ ] Final sweep: pack test green on all 72, completeness count checked.

## Record shape decisions (integration notes for the Stacker)

- Records follow DESIGN.md section 1.1 field for field. Two additions, both
  flagged for Slice 1: a `schema` field set to `meridian.pack.case.v1`
  (mirrors the `meridian.loop.clues.v1` convention), and a `directions` array
  listing the GeoDetective forms the case supports (`A`, `B1`, `B2`), with
  `direction` holding the primary form.
- `subject.subdivision` is the capital's first-order region for country cases
  (from the chunk record) and the state name for US state cases.
- Inputs are committed with their extracts. The original clue pipeline kept
  extracts in scratch; the pack commits them so the verbatim-quote gate stays
  reproducible for QA and CI.

## Workspace note

This branch began in `~/workspace/meridian-swarm/content`. A directory manager
removed other slices' workspaces under `meridian-swarm/`, so the clone moved to
`~/workspace/meridian-swarm-content/` on 2026-11-03. Same branch name.
