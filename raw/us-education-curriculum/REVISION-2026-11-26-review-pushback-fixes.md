# Revision 2026-11-26 — Review Pushback Fixes & Council Finalization

This addendum records the verified corrections to `282dd44e` following
the 3rd-level review pushback on `research/us-education-curriculum`. Per
`AGENTS.md` §13, existing `raw/` files stay immutable; this dated
addendum states the exact corrections carried into `wiki/` and
`docs/branch-status/research-us-education-curriculum.md`.

## 1. Mechanical T2/T3 Count Correction (`src/subjects/shared/tier-tags.ts`)

Recounted mechanically via `Select-String '^\s+"([^"]+)":\s*"(T2|T3)"'`
on `src/subjects/shared/tier-tags.ts`:

| Subject | T2 | T3 | Total 10-18 |
|---|---:|---:|---:|
| Math | 14 | 14 | 28 |
| Physics | 5 | 4 | 9 |
| Chemistry | 5 | 3 | 8 |
| General Knowledge | 2 | 1 | 3 |
| Social Studies | 3 | 2 | 5 |
| Journals | 6 | 1 | 7 |
| **Subtotal (pre-existing)** | **35 (58.3%)** | **25 (41.7%)** | **60** |
| Biology (new) | 5 | 4 | 9 |
| **Total in `tier-tags.ts`** | **40 (58.0%)** | **29 (42.0%)** | **69** |

Plus `1` Grade 5 tag (`math-number:fractions:compare-unlike: "5"`).
This corrects the `42 T2 / 18 T3` arithmetic error in
`REVISION-2026-11-26-inventory-retag.md`.

**Runtime status (Deepening a):** `ITEM_TIER_TAGS` is **data-only** for
now; `SubjectCase` and `picker-rows.ts` do not yet filter or sequence
by `T2` vs `T3` at runtime.

## 2. H01–H03 Dual Status (Research vs. Runtime Inventory)

- **Research pack (`REVISION-2026-11-26-inventory-retag.md`):**
  Promoted `H01–H03` from `UNVERIFIED` to sourced using Lane 9
  NHTSA/MUTCD/DMV citations. This closes the **research benchmark**
  side of audit gap A5.
- **Live planning inventory (`docs/scaling/humanities/screened-topics.md:49`):**
  Still reads `PROPOSED, 2026-11-10` and notes `"US pedestrian content
  has a HIGH source (NHTSA); other countries are UNVERIFIED"`. **Zero**
  `H01–H03` items have been authored into `src/subjects/general-knowledge/items.ts`.
  Thus the **runtime inventory / authored item gap** remains open.

## 3. Kansas Envirothon & 2026 NCF-Envirothon Corrections (`lane11`)

- **§11.2 correction (KACD + KACEE):** Kansas Envirothon tests **5 core
  areas** (**Soils & Land Use, Forestry, Wildlife, Aquatic Ecology,
  Rangeland Management**) **PLUS** the annual **Current Environmental
  Issue** and **Oral Presentation** `[Moderate 2/2]`
  (`kacd.net/envirothon.cfm`, `kacee.org`). Rangeland Management does
  **not** replace the Current Issue.
- **§11.3 correction (St. John's Catholic School, Beloit, KS):**
  - 2024: KS State Champion; represented Kansas at NCF-Envirothon in
    Geneva, NY `[Moderate 2/2]` (`kacd.net/envirothon-past-winners.cfm`).
  - 2025: KS State Champion; represented Kansas at NCF-Envirothon in
    Calgary, Alberta (**24th of 51 teams**) `[Moderate 2/2]`.
  - 2026: KS State Champion (3rd consecutive); represented Kansas at
    NCF-Envirothon at Mississippi State University (July 19–25, 2026;
    overall champion: Mount Academy, NY). Official 2026 NCF scoresheet
    (`njacd.org` / `envirothon.org/2026-mississippi/`) records Kansas
    Team #2640: Soils 90, Aquatics 53, Forestry 63, Wildlife 70,
    Current Issue 81, Oral Presentation 142.00, Total **499.00**
    `[Moderate 2/2]`. The `"12th place"` rank claim is downgraded to
    `[Moderate]` ("2026 placement cited to KACD past winners; exact rank
    row in `2026-NCF-Scoresheets.pdf` not directly extracted").

## 4. Dangling Audit Reference (`meridian-audit-vs-plan-2026-11-26.md`)

`REVISION-2026-11-26-competition-anchored-rebuild.md` cites
`meridian-audit-vs-plan-2026-11-26.md`, which is **not present in this
repository** (`Data not available.` for its standalone text). All gap
mappings (A1–A5, P1–P5) cited from it remain traceable only via
`REVISION-2026-11-26-competition-anchored-rebuild.md` §1 until the
external audit file is ingested into `raw/`.

## 5. Owner-Decision Provenance (`AGENTS.md` §7)

Verbatim owner instructions of **2026-11-26** approving Option A
(Biology as 7th subject card, superseding the 2026-11-25 Living World
strand decision):

> "1. Promote Biology to its own 7th subject card:
> - Update `src/subjects/registry.ts` to add `biology` (`Biology`) as a standalone subject card alongside Math, Physics, Chemistry, Social Studies, Journals, and General Knowledge (keeping the 3 age bands: `7-10`, `10-18`, `18+`).
> - Update the research/wiki decision docs to record that Option A (7th category) is now approved, superseding the interim General Knowledge strand decision."

> "Biology (New Standalone 7th Card): Promoted out of General Knowledge so life sciences are clearly visible and never buried."

## 6. Deepening: Per-Wave Done-Conditions & Educator Review Checklist

- **Wave A (GK Pillars 3–5):** Author `H01–H03` road/bike/GDL items,
  `scan → assess → decide → act` situational items, and AMC/MATHCOUNTS/
  SciOly-calibrated riddles in `src/subjects/general-knowledge/items.ts`.
  *Done when:* `lint:subjects`, `lint:cards`, `tsc`, `build:pages`, and
  GK unit tests pass with `0` giveaway/measurement leaks.
- **Wave B (Environmental Studies):** Author NCF-Envirothon 5-station +
  Oral Presentation + Kansas Rangeland items (`T3`) and NGSS ESS/LS2
  (`T1–T2`). *Done when:* `lane11` station matrix is 100% covered and
  unit tests pass.
- **Wave C (HS STEM & Social Studies):** Author quantitative T3 Physics
  (`F=ma`/USAPhO), Chemistry (USNCO), and C3 Social Studies items.
  *Done when:* T3 inventory has non-zero Olympiad-ceiling items across
  all 3 subjects and unit tests pass.
- **Biology Educator Review (`src/subjects/biology/items.ts`):** All 14
  items currently have `provenance: "UNVERIFIED"`. Educator review must:
  (1) replace `"UNVERIFIED"` with `{ source, verifiedOn }` on each of
  the 14 records; (2) confirm age-band appropriateness (`4` T1, `5` T2,
  `4` T3, `1` T4); (3) confirm `read-the-label` (`18+`) gives no medical
  advice; (4) sign `educator-gate-rubric.md`.

## 7. Measured Verification Status (2026-11-26, local Windows workspace)

- `node --experimental-strip-types --test src/subjects/*/*.test.ts`:
  **PASS** (`342/342`, `59` suites, including `2/2` in `tier-tags.test.ts`).
- `npm run lint:subjects`: **FAIL (exit 1, `GATE FAILED (8)`)** across
  `subjects=biology,chemistry,general-knowledge,journals,math,physics,social-studies`
  (`leads=1021 journal-texts=338`). `biology` has **0** findings; all
  `8` failures are pre-existing `journals` caption/baseline mismatches.
- `npm run lint:nav`: **PASS**.
- `node scripts/lint-cards.mjs`: **PASS** (`GATE PASSED`).
- `npm run build:pages`: **PASS** (prerendered `1` page).
- `npx tsc --noEmit`: **0** errors in `src/subjects/`; pre-existing
  errors remain in `src/play-lab/` and `*.stories.tsx`.
- Full `npm test`: **3** pre-existing failures outside `src/subjects/`
  (`locked-tile-film.test.ts`, `storage.contract.test.ts`).
- Playwright E2E on the 7-card picker: **NOT RUN** in this pass.
