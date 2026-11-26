# Wiki log

Append-only record of what happened and when. Each entry starts with a
consistent prefix so the timeline is easy to scan.

## [2026-11-24] init | Wiki scaffold

Created the `raw/` and `wiki/` folder layout, including empty
`sources/`, `entities/`, `concepts/`, and `analyses/` folders. No
sources have been ingested yet beyond the `raw/` README, which states
that files in `raw/` are never modified. (source: raw/README.md)

## [2026-11-24] ingest | U.S. education curriculum research pack

First ingest. Added the dual-cohort curriculum research pack to
`raw/us-education-curriculum/` (design document, source index, 5
evidence lanes, 4 council memos), wrote the summary at
[[us-education-curriculum]], and added the concept page
[[why-learn-tiers]]. No entity pages were created: the sampled
districts and standards bodies are catalogued in the pack's sample
justification table, and no reader needs them as standalone pages
yet. (source: raw/us-education-curriculum/CURRICULUM-DESIGN.md)

## [2026-11-25] ingest | Living World revision of the U.S. curriculum pack

Revision ingest. Added the dated revision document and the Lane 6
Life Science evidence file to `raw/us-education-curriculum/`, and
updated [[us-education-curriculum]] and [[why-learn-tiers]]. The
revision adopts the Living World strand inside General Knowledge,
replaces the confidence standard, records the inventory audit (78
items, 0 Living World), and rules 10 confidence corrections. The
corrections are stated in the revision document rather than edited
into the original raw files, which stay immutable.
(source: raw/us-education-curriculum/REVISION-2026-11-25-living-world.md)
