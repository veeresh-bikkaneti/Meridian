# ADR-0002: Detective audio manifests split per case

**Status:** Accepted
**Date:** 2026-11-24
**Deciders:** Veeresh (owner) — issue #377, the panel follow-up from PR #370

## Context

`public/audio/detective/manifest.json` is the hash-pinned record of every
pre-rendered Holmes and Watson line. On this tip it is 1,938,757 bytes
raw (408,181 bytes gzip). The speech player fetched that whole file on
the first detective line.

The bytes are not one blob of equal weight:

| Section | Raw bytes | What it is |
|---|---:|---|
| `cases` | ~1,159,907 | 497 cases, about 2.3 KB of text and hashes each |
| `names` | ~424,632 | 1,460 selection-name lines |
| `fixed` | ~8,632 | 26 shared lines (acks, decodes, win, debrief) |
| rest | small | `v`, voices, coverage lists |

A session speaks one case. The first line does not need every other
case's text. Rivers, Seas & Oceans, and Famous Seaports will add more
decks. Leaving the fetch as one file makes the first speech grow by
every new deck's clue text.

The player only reads `file` and `voice`. Text, hashes, pitch and pace
exist so `npm run check:detective-audio` can tell a stale render from
a current one. Those fields do not need to ride along on the speech
fetch.

## Decision

Keep `public/audio/detective/manifest.json` as the source of truth and
as the runtime fallback. A generator,
`scripts/detective/split-audio-manifest.mjs`, writes runtime shards
under `public/audio/detective/split/` and does not rewrite the monolith:

- `split/index.json` — `v: 1`, `split: 1`, the two voices, the fixed
  lines (`file` and `voice` only), and a deck catalog. Measured
  2,121 bytes raw, 426 bytes gzip.
- `split/cases/<index>.json` — that case's clues and answer, same slim
  shape. 497 files, 392–404 bytes raw each (about 132 bytes gzip).
- `split/names.json` — the selection-name table, slim. 96,028 bytes
  raw, 9,493 bytes gzip. Fetched on the first spoken place name, not
  on the first clue. A pick can name any catalogued place, so names
  are not a deck.

The deck catalog on this tip is `core` (cases 0–386) and `capitals`
(cases 387–496). The generator reads the core deck from the clue files
and every `public/packs/<id>/manifest.json`, so a new pack becomes a
catalog row and a set of case files without a loader change.

The player (`loadDetectiveManifestFor`) loads the index once, then the
case file for a clue or answer line. A fixed line, including the
summary celebration, uses the index alone. A name line loads the names
file.

Fallback, in order:

1. If the split index is missing, unreadable, or not `split: 1`, load
   `manifest.json` once and use it for the rest of the session.
2. If a needed shard fails for a reason other than HTTP 404 (network
   error, HTTP 500, a body that is not the shard shape), do the same.
3. HTTP 404 on a case or on the names file means that line was not
   rendered. The line stays silent, which is the existing coverage
   rule. A 404 does not download the monolith, or a missing name
   would pull 1.9 MB back onto the common path.

Measured first-clue fetch: index + one case is at most 2,525 bytes
raw, against 1,938,757 bytes before. Adding a deck adds case files and
a few dozen catalog bytes. It does not add those cases' text to another
deck's first fetch.

`check-audio-manifest.mjs` fails when a shard drifts from a fresh
split of the monolith. `render-audio.mjs` rewrites the shards after
the monolith, at the end of a render run.

## Options considered

| Option | Complexity | Risk | Verdict |
|---|---|---|---|
| A. Keep one file | None | First speech grows with every deck | Rejected |
| B. One file per deck | Low | Core alone is most of the case bytes, so an "All cases" session still fetches on the order of a megabyte, and that file still grows as core grows | Rejected as the cut |
| C. One file per case, plus a shared index and a names file; monolith kept as fallback (chosen) | Low | Two copies can drift | Accepted — the gate fails on drift |

## Consequences

- Easier: a new deck does not enlarge the first fetch of an existing case.
- Easier: the staleness gate still has one hash record, the monolith.
- Harder: a render that updates the monolith and dies before the split
  step leaves shards stale. The audio gate fails closed until the
  generator is run again.
- Watch: `split/names.json` is the next file that can grow, with the
  name tier rather than with decks. It is not on the first-clue path.

## Follow-ups

1. [ ] Split `names.json` per place id if a spoken name becomes the
   dominant fetch. Not needed for the deck programme: names are not
   deck-scoped, and the file is 96,028 bytes raw against the old
   1,938,757 byte first fetch.
2. [ ] The deck catalog picks up Rivers, Seas & Oceans, and Famous
   Seaports when those packs land under `public/packs/`. No loader
   change is required for that.
