# BRANCH_STATUS — fix/chimney-rock-citation (Journal Q6 citation fix)

**State: MERGED 2026-10-21 — PR #198, squash `0c73aee`, on the
owner's merge word.** The full panel pipeline on the final tip
`6c1fb58` returned READY — APPROVE ×12 / BLOCK ×0, DevEx
PASS-WITH-NITS — satisfying the standing rule that the panel
approves the final tip itself. The panel's one MAJOR DevEx nit
(the journal generator's one-line `src()` parser gotcha) was
filed as issue #200 on the owner's instruction. This header was
cured by the follow-up branch-status PR; the record below stands.

Base: `origin/main 33a28fe`. Scope: one citation href in
`src/game/catalog.ts` + the regenerated journal dataset
(`src/components/home-journal.data.ts`) + this record. No note
text, no label, no other citation changes.

## The ruling (owner's words, cited)

Journal Q6 — the Chimney Rock note's source link
`https://www.nps.gov/chro/` is dead. A verification crew
live-checked the candidates and presented four picks on
2026-10-21; **Veeresh ruled: "1 — NPS Places page
(recommended)"** (option tap + typed confirmation, 2026-10-21).

## The change

- `src/game/catalog.ts` (chimney-rock): href
  `https://www.nps.gov/chro/` →
  `https://www.nps.gov/places/000/chimney-rock-national-historic-site.htm`.
  Label stays "National Park Service"; story text unchanged.
- Dataset regenerated with the documented generator
  (`node scripts/build-journal-dataset.mjs`). Proof: the
  regenerated file differs from the previous one in **exactly
  one line** (the chimney-rock `sourceHref`). Generator report:
  106 notes included, 0 excluded, **tiers verified=49 /
  cited=57 — unchanged** (the tier is computed mechanically
  from the host; the new href stays on `nps.gov`, so the note
  keeps its "verified" tier).

## Evidence

- Dead link, re-verified 2026-10-21 from this worktree:
  `GET https://www.nps.gov/chro/` → 302 →
  `https://www.nps.gov/chro/index.htm` → **404**. The NPS unit
  site was retired (Chimney Rock is an NPS affiliated area
  operated by History Nebraska; NPS now routes it via its
  Places system).
- Replacement, re-verified 2026-10-21: **HTTP 200**. It is
  NPS's canonical successor page for the site and supports all
  three of the note's claims (western-Nebraska spire; the
  Oregon Trail landmark emigrants watched for; still standing
  above the North Platte valley near Bayard).
- Repo-wide sweep for `nps.gov/chro`: exactly two references
  existed — the catalog line (fixed) and the generated data
  line (regenerated). No docs, tests, or handbook pages name
  the old URL.

## Gotcha recorded for the next editor

The generator's catalog parser matches `source: src("label",
"href")` on one line (regex in
`scripts/build-journal-dataset.mjs`); wrapping the call across
lines silently drops the place from the parse and the art
manifest then aborts on the "unknown" id. Long source lines are
the catalog's existing convention (several exceed the 100-char
print width); keep them on one line.

## Gates (this tip)

- `npx tsc --noEmit` — clean (run record in the PR body)
- `npm test` — green; journal tier-count assertions pass
  unchanged (no test hardcoded the old href)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green
