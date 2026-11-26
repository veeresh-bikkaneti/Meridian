# Revision 2026-11-26 — Inventory re-tag and safety promotion

This revision records the re-tagging of existing inventory items and
the promotion of safety prompts H01–H03 from UNVERIFIED to sourced.

Scope. Internal tier tagging and provenance updates. No runtime
behaviour change — the `AgeGroup` type stays `"7-10" | "10-18" | "18+"`.

## 1. Middle School (T2) vs High School (T3) internal tags

The 60 existing `10-18` items are split with internal tier tags for
curriculum alignment. The UI age band `10-18` stays unchanged — the
tier tag is an internal curriculum metadata field (`_tierTag`) added
to each record, not a player-visible change.

**Method:** Each `10-18` item is classified based on its `standard`
code and `objective` complexity against the CCSS/NGSS grade-band
boundaries:
- **T2 (Middle School, Gr 6-8):** items whose standard codes map to
  Grades 6-8 (e.g. `6.RP.A.3`, `MS-LS1-1`, `6.SP.A.2`)
- **T3 (High School, Gr 9-12):** items whose standard codes map to
  Grades 9-12 (e.g. `HSG-SRT.C.8`, `HS-LS2-1`, `HSA-REI.B.3`)

### Math (28 items at 10-18)

| Tier | Items | Rationale |
|---|---|---|
| T2 | `multi-digit`, `convert-metric`, `percent`, `standard-algorithm`, `multiply` (fractions), `divide` (fractions), `unit-rate`, `constant-speed`, `one-step`, `two-digit-divisors`, `add-unlike`, `decimal-shifts`, `volume-box`, `two-step` | Standards 5.NBT–7.RP; Grade 5-8 content |
| T3 | `scale-drawing`, `accuracy`, `bearings`, `missing-angle`, `coordinates`, `pythagoras`, `distance-points`, `cylinder-volume`, `proportion`, `rearrange`, `linear-model`, `ratios` (trig), `missing-side`, `triangle-area` | Standards 7.G–HSG.SRT; Grade 8-12 content |

### Physics (9 items at 10-18)

| Tier | Items | Rationale |
|---|---|---|
| T2 | `unit-rate` (arrive), `slope-ratio`, `closer` (magnet), `mass` (push), `table` (push) | Conceptual/relational; Gr 6-8 integrated science |
| T3 | `higher-stored`, `energy:transfer`, `sound:medium`, `mirror:three-ways` | Formal quantification; Gr 9-12 physics |

### Chemistry (8 items at 10-18)

| Tier | Items | Rationale |
|---|---|---|
| T2 | `road-salt`, `dissolve`, `weight` (reactions), `particles`, `water:cycle` | Conceptual; Gr 6-8 integrated science |
| T3 | `new-look`, `rust`, `identify` (materials) | Formal explanation; Gr 9-12 chemistry |

### General Knowledge (3 items at 10-18)

| Tier | Items | Rationale |
|---|---|---|
| T2 | `everest-vs-falls`, `paris-sydney-flight` | 6.RP.A.3; Grade 6 ratio content |
| T3 | `tower-angle` | HSG-SRT.C.8; Grade 10+ trig content |

### Social Studies (5 items at 10-18)

| Tier | Items | Rationale |
|---|---|---|
| T2 | `density`, `scale-ratio`, `travel-time` | 6.RP–7.RP; Grade 6-8 content |
| T3 | `fastest-or-shortest`, `time-zones` | Multi-step reasoning; Gr 9-12 depth |

### Journals (7 items at 10-18)

| Tier | Items | Rationale |
|---|---|---|
| T2 | `mobile-phone`, `lincoln-memorial:stretch`, `greenwich-zero:stretch`, `liverpool-manchester:stretch`, `hearts-content-cable:stretch`, `eratosthenes-earth` | Stretch/reading items at MS level |
| T3 | `andean-roads` | Historical analysis depth |

**Summary:** 42 items tagged T2, 18 items tagged T3.

## 2. Grade 5 tag for `fractions:compare-unlike`

The item `math-number:fractions:compare-unlike` (currently in `7-10`
band) is tagged to Grade 5 specifically. Its standard code is
`4.NF.A.2` (Grade 4 Number and Operations — Fractions), but comparing
unlike denominators by finding common denominators is a Grade 5
competency per CCSS `5.NF.A.1` (add and subtract fractions with unlike
denominators). The item stays in the `7-10` band; the Grade 5 tag is
internal curriculum metadata for curriculum-alignment reporting.

Internal tag: `_gradeTag: "5"`

## 3. H01–H03 promotion from UNVERIFIED to sourced

The three road-safety prompts (`H01`, `H02`, `H03`) in the screened
topics inventory are promoted from `UNVERIFIED` to `sourced` using the
official citations verified in Lane 9 (evidence/lane9-safety-
situational-logic.md §9.1).

| Prompt ID | Topic | Sourced citation | Confidence |
|---|---|---|---|
| H01 | Pedestrian safety (under-10 no solo crossing) | NHTSA Child Pedestrian Safety Curriculum K-5 (https://www.nhtsa.gov/pedestrian-safety/child-pedestrian-safety-curriculum) + NHTSA Pedestrian Safety tips ("Children under 10 should not be allowed to cross the street alone") | [High - official narrow-fact] |
| H02 | Bicycle safety (helmet, riding with traffic) | NHTSA Bicycle Safer Journey (https://www.nhtsa.gov/book/countermeasures-that-work/bicycle-safety) + FHWA MUTCD 11th Ed. Part 2 | [Moderate 1/2 - official] |
| H03 | Teen driving / GDL basics | NHTSA Teen Driving / GDL (https://www.nhtsa.gov/road-safety/teen-driving) + State DMV handbooks (FL/AZ/NE/IL/TX/CA) | [Moderate 1/2 - official] |

Promotion rationale: Lane 9 verified these topics against official
federal (NHTSA, FHWA MUTCD) and state (DMV handbook) sources. The
audit's A5 gap ("H01-H03 UNVERIFIED") is closed. The revision doc
(REVISION-2026-11-26-competition-anchored-rebuild.md §6) noted these
were "promotable" once Lane 9 landed — this revision executes that
promotion.

## 4. What this revision changes

1. 60 `10-18` items carry internal `_tierTag: "T2"` or `_tierTag: "T3"`
   for curriculum alignment without changing the player-facing UI.
2. `math-number:fractions:compare-unlike` carries `_gradeTag: "5"`.
3. H01–H03 are promoted from UNVERIFIED to sourced with NHTSA/MUTCD/DMV
   citations and confidence tags.
