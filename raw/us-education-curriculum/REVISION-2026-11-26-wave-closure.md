# Revision 2026-11-26 — Waves A–C Closure, Biology Hardening & Runtime T2→T3 Wiring

This dated revision records the curriculum implementation and planning-state closure landed on `research/us-education-curriculum` (`57cc3a64`..`53eaf071`, 2026-11-26). Per `AGENTS.md` §13, earlier `raw/` files remain immutable.

## 1. Wave A — General Knowledge Pillars 3–5 (`57cc3a64`, lead cure `e5517c16`)

Authored **11** new items in `src/subjects/general-knowledge/items.ts` (bringing GK from 10 to 21 items before Wave B), each with `{ source, verifiedOn: "2026-11-26" }` from Lane 9:
- **Pillar 3 (`H01–H03` road/bike/MUTCD/GDL safety, 4 items):** `general-knowledge:safety:pedestrian-crossing` (`7-10`), `bicycle-traffic-rules` (`10-18`), `mutcd-yield-sign` (`10-18`), `teen-gdl-driving` (`10-18`). Non-US country traffic rules remain `UNVERIFIED` in `docs/scaling/humanities/screened-topics.md`.
- **Pillar 4 (`scan → assess → decide → act`, 3 items):** `general-knowledge:awareness:parking-lot-scan` (`7-10`), `multiple-threat-crossing` (`10-18`), `storm-road-triage` (`18+`).
- **Pillar 5 (competition-calibrated riddles, 4 items):** `general-knowledge:riddles:wall-climb-days` (`7-10`), `mislabeled-crates` (`10-18`), `sciolympiad-alibi-deduction` (`10-18`), `tournament-knockout` (`18+`).

## 2. Wave B — Environmental Studies & NCF-Envirothon (`e5517c16`)

Authored **14** new items in `src/subjects/general-knowledge/items.ts` (bringing GK to **35** items: `11` `7-10`, `20` `10-18`, `4` `18+`):
- **NGSS ESS / LS2 (6 items):** 3 at T1 (`7-10`: `ESS1.C`, `5-LS2-1`, `ESS2.C`) and 3 at T2 (`10-18`: `MS-ESS2` ×2, `MS-LS2-1`).
- **Lane 11 Envirothon Matrix at T3 (`10-18`, 8 items, 100% coverage):** Soils & Land Use, Aquatic Ecology, Forestry, Wildlife, Current Environmental Issue, Oral Presentation, and Kansas Rangeland Management (2 items, preserving Current Issue and Oral Presentation per `REVISION-2026-11-26-review-pushback-fixes.md` §3).

## 3. Wave C — Quantitative T3 Olympiad-Ceiling Items (`42951e6d`)

Authored **6** quantitative T3 (`10-18`) items (2 per subject) with measurement-free `why` leads and `{ source, verifiedOn: "2026-11-26" }`:
- **Physics (`https://aapt.org/physicsteam/`):** `physics:dynamics:atwood-acceleration`, `physics:momentum:inelastic-climb`.
- **Chemistry (`https://www.acs.org/education/olympiad/rules-and-eligibility.html`):** `chemistry:stoichiometry:limiting-reactant-yield`, `chemistry:solutions:neutralization-molarity`.
- **Social Studies (`https://www.socialstudies.org/system/files/2021-12/se-85062021332.pdf`):** `social-studies:economics:real-purchasing-power`, `social-studies:region:water-demand-projection`.

## 4. Biology Hardening (`bade5445`)

- Added `src/subjects/biology/validate.ts` and `src/subjects/biology/records.test.ts` (`11/11` PASS; validates all `14` `BIOLOGY_RECORDS`).
- Added `src/subjects/biology/educator-review-packet.md` covering all `14` `provenance: "UNVERIFIED"` items (4 T1 / 5 T2 / 4 T3 / 1 T4), `read-the-label` (`18+`) no-medical-advice verification, and unchecked `educator-gate-rubric.md` sign-off block.
- **ClueScenes deferred:** Existing `60` `ClueSceneDescription` kinds in `src/subjects/shared/` render domain-hardcoded SVGs/formulas and cannot represent biology items without adding new kinds in `src/subjects/shared/`.

## 5. Runtime T2→T3 Sequencing & Verification (`53eaf071`)

- Updated `src/subjects/shared/tier-tags.ts` with all `23` new `10-18` item IDs from Waves A–C, bringing `ITEM_TIER_TAGS` from `69` to **`92`** `10-18` tags (`47` T2, `45` T3) plus `1` Grade 5 tag.
- Implemented `sequenceByCurriculumTier(items, band)` and wired it into `src/subjects/shared/SubjectCase.tsx:227` so `10-18` players encounter `T2` items before `T3` items (`7-10` and `18+` unchanged).
- Updated `tests/e2e/subjects-picker.desktop.spec.ts` for all 7 subject cards (`7/7` PASS).
- **Remaining external dependency:** `meridian-audit-vs-plan-2026-11-26.md` is not present in the repository (`Data not available`); ingest remains blocked until the owner supplies the file.
