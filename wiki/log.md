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

## [2026-11-26] ingest | Competition-anchored five-pillar rebuild of the U.S. curriculum pack

Revision ingest responding to the external audit
(`meridian-audit-vs-plan-2026-11-26.md`) of this branch @ 447ff41.
Added `REVISION-2026-11-26-competition-anchored-rebuild.md` and four
new evidence lanes under `raw/us-education-curriculum/evidence/`
(lane7 competitions/olympiads, lane8 young-scientist + environmental
competitions, lane9 safety/situational-awareness/riddles, lane10
district pacing-guide pass with the NCES CCD federal layer). Every
audit gap A1-A5 and P1-P5 is mapped to its closing lane; the five
pillars are mapped to T1-T4 tiers with official competition
eligibility rules (MAA AMC 8/10/12, MATHCOUNTS, Science Olympiad
Div A/B/C, USAPhO, USNCO, USABO, 3M Young Scientist, Thermo Fisher
JIC, Regeneron ISEF, NCF-Envirothon, NOSB) and to NHTSA/MUTCD/state
DMV safety sources. Updated [[us-education-curriculum]] and
[[why-learn-tiers]]. No existing raw file was edited.
(source: raw/us-education-curriculum/REVISION-2026-11-26-competition-anchored-rebuild.md)

## [2026-11-26] decision | Biology promoted to 7th subject card (Option A)

Owner decision: Biology is promoted from the interim Living World
strand inside General Knowledge to its own standalone 7th subject
card. The six-category UI becomes seven. Option A (rejected on
2026-11-25) is now approved, superseding the interim strand decision.
Biology subject module created at `src/subjects/biology/` with 14
records across 4 waves (4 T1 + 5 T2 + 4 T3 + 1 T4). Picker updated
with Leaf icon and one-liner.
(source: raw/us-education-curriculum/REVISION-2026-11-26-biology-7th-card.md)

## [2026-11-26] ingest | Lane 6 Pass 2 — Heredity (LS3) and Evolution (LS4) at T2/T3

Closes the LS3/LS4 gap identified in Lane 6 Pass 1. Added 12 new
evidence records (LS-014 to LS-025) covering MS-LS3, MS-LS4, HS-LS3,
HS-LS4 with state-standard corroboration from TX (TEKS), FL (B.E.S.T.),
and CA (NGSS-aligned). USABO confirmed as T3 competition ceiling for
Biology. NGSS coverage now spans all four Life Science DCIs at T1-T3.
(source: raw/us-education-curriculum/evidence/lane6-pass2-heredity-evolution.md)

## [2026-11-26] ingest | Lane 11 — NCF-Envirothon & Kansas Envirothon benchmark

Anchors High School Environmental Studies to NCF-Envirothon's 5 station
categories + Oral Presentation and Kansas Envirothon's 5 content areas
(Soils & Land Use, Forestry, Wildlife, Aquatic Ecology, Rangeland
Management). St. John's Catholic School (Beloit, KS) added as a
verified state-to-international benchmark: 3 consecutive Kansas state
championships (2024-2026), international representation including 12th
place at the 2026 NCF-Envirothon.
(source: raw/us-education-curriculum/evidence/lane11-envirothon-benchmark.md)

## [2026-11-26] update | Inventory re-tag and safety promotion

Split the 60 existing `10-18` items into internal T2 (42 items) vs
T3 (18 items) tier tags based on CCSS/NGSS grade-band boundaries.
Tagged `fractions:compare-unlike` to Grade 5. Promoted H01-H03 from
UNVERIFIED to sourced using NHTSA/MUTCD/DMV citations from Lane 9.
(source: raw/us-education-curriculum/REVISION-2026-11-26-inventory-retag.md)

## [2026-11-26] update | Citation verification and content authoring waves

Verified primary citations for g = 9.8 m/s² (NIST), CCSS 6-8
standard text (CCSSO ADA-Compliant PDF), and Eanes ISD on TEA
([Moderate 2/3]). Recorded 4-wave content authoring: Wave 1 (4 T1
Biology + road safety + Grade 5 fractions), Wave 2 (5 T2 Biology),
Wave 3 (4 T3 Biology + Envirothon), Wave 4 (1 T4 Biology literacy).
All open register items closed except the national T4 standard (none
exists).
(source: raw/us-education-curriculum/REVISION-2026-11-26-citations-and-authoring.md)
