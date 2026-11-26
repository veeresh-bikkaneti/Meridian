# Revision 2026-11-26 — Biology promoted to 7th subject card (Option A)

This revision records the owner's decision of 2026-11-26 to promote
Biology from the interim Living World strand inside General Knowledge
to its own standalone 7th subject card. It supersedes the interim
strand decision recorded in REVISION-2026-11-25-living-world.md §1.

Scope. Research decision document and code implementation. The Biology
subject module is now live at `src/subjects/biology/`.

## 1. Decision — Option A approved

> **Biology card decision (owner, 2026-11-26):** Biology is promoted
> to its own standalone 7th subject card. The six-category UI becomes
> seven: Math, Physics, Chemistry, Biology, General Knowledge, Social
> Studies, Journals. The interim Living World strand inside General
> Knowledge (adopted 2026-11-25) is superseded.

Rationale for the reversal.

- The Living World strand of 2026-11-25 was an interim decision to
  avoid splitting General Knowledge before enough Biology content
  existed. The owner determined on 2026-11-26 that Life Science
  content is fundamental enough to warrant immediate visibility as
  a first-class category, not buried inside General Knowledge.
- Trigger 3 from the 2026-11-25 decision (discoverability) was
  resolved by the owner's judgment: learners and parents should find
  Biology by name, not look for it under General Knowledge.
- The competition-anchored rebuild (2026-11-26) established USABO as
  the High School ceiling for Biology, paralleling USAPhO (Physics)
  and USNCO (Chemistry) — a 7th card is structurally consistent with
  the other science cards having their own olympiad benchmarks.

## 2. What changes from the 2026-11-25 decision

| Aspect | 2026-11-25 (superseded) | 2026-11-26 (current) |
|---|---|---|
| UI categories | 6 (Living World hidden inside GK) | 7 (Biology visible as a card) |
| Subject id | `life-science` strand tag inside `general-knowledge` | `biology` standalone subject |
| Picker position | N/A (embedded in GK) | 4th card: Math, Physics, Chemistry, **Biology**, GK, Social Studies, Journals |
| One-third GK rule | Active (T1–T2 GK allocation target) | Superseded — Biology items go to their own card |
| Seventh-category triggers | Not triggered | Triggered and approved by owner |
| NGSS coverage | Partial (LS1/LS2 only) | Partial but growing (Lane 6 Pass 2 adds LS3/LS4) |
| Competition ceiling | USABO mentioned, not positioned | USABO is the T3 ceiling for Biology |

## 3. Implementation completed

1. `src/subjects/biology/index.ts` — Biology subject module
   (`released: true`, `groups: ["7-10", "10-18", "18+"]`).
2. `src/subjects/biology/items.ts` — 14 records across 4 waves
   (4 T1 + 5 T2 + 4 T3 + 1 T4), anchored on NGSS with internal
   T2/T3 tier tags on the `10-18` items.
3. `src/subjects/biology/BiologyCase.tsx` — case flow component.
4. `src/subjects/shared/picker-rows.ts` — Biology added to
   PLANNED_SUBJECTS at position 4.
5. `src/subjects/shared/SubjectPicker.tsx` — Leaf icon and one-liner
   ("Why living things are built to survive") added.

## 4. General Knowledge after the split

General Knowledge retains its existing 10 items (5 at 7-10, 3 at
10-18, 2 at 18+). None of these were Life Science by the counting
rules of the 2026-11-25 inventory audit (§3: 0 primary Living World
items). General Knowledge now focuses on Earth & Space science,
interdisciplinary topics, road safety, situational awareness, and
educational riddles — per the finalized curriculum plan.

The one-third GK allocation target is superseded. Living World is
no longer a strand inside GK; it is the Biology card.

## 5. What stays from 2026-11-25

- The confidence standard (§2) remains in force.
- Lane 6 evidence records (LS-001 to LS-013) remain valid; their
  `product_mapping` changes from `General Knowledge / Living World`
  to `Biology`.
- The five-pillar competition anchors (2026-11-26) remain in force.
- The NGSS coverage statement remains cautious: Meridian has verified
  NGSS anchors for part of the strand, not full coverage.
