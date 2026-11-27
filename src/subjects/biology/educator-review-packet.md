# Biology Educator Review Packet

**Status:** GATED — all 14 items in `src/subjects/biology/items.ts` currently carry `provenance: "UNVERIFIED"`. Per `docs/scaling/educator-gate-rubric.md`, only a qualified human educator may sign off; no agent or builder may sign or backfill `verifiedOn`.

## 1. Provenance Replacement Table (14 Items)

Upon human educator sign-off, replace `provenance: "UNVERIFIED"` on each record in `src/subjects/biology/items.ts` with `{ source, verifiedOn }` using the exact `source` below and the actual `YYYY-MM-DD` sign-off date.

| # | Item ID | Band / Tier | Standard Code | Current `standard.source` (`items.ts`) | Evidence Record & Direct URL | Proposed `provenance` on Sign-Off |
|---|---|---|---|---|---|---|
| 1 | `biology:life-matter:seed-diary` | `7-10` / T1 | `5-LS1-1` | `https://www.nextgenscience.org/search-standards` | `LS-004` (`lane6-life-science.md`) | `{ source: "https://www.nextgenscience.org/search-standards", verifiedOn: "<YYYY-MM-DD>" }` |
| 2 | `biology:life-cycles:whose-baby` | `7-10` / T1 | `3-LS1-1` | `https://www.nextgenscience.org/search-standards` | `LS-002` (`lane6-life-science.md`) | `{ source: "https://www.nextgenscience.org/search-standards", verifiedOn: "<YYYY-MM-DD>" }` |
| 3 | `biology:life-structure:built-for-job` | `7-10` / T1 | `4-LS1-1` | `https://www.nextgenscience.org/search-standards` | `LS-003` (`lane6-life-science.md`) | `{ source: "https://www.nextgenscience.org/search-standards", verifiedOn: "<YYYY-MM-DD>" }` |
| 4 | `biology:life-ecosystems:dry-summer` | `7-10` / T1 | `3-LS4-3` | `https://www.nextgenscience.org/search-standards` | `LS-006` (`lane6-life-science.md`) | `{ source: "https://www.nextgenscience.org/search-standards", verifiedOn: "<YYYY-MM-DD>" }` |
| 5 | `biology:life-structure:one-cell-many-jobs` | `10-18` / T2 | `MS-LS1-2` | `https://www.nextgenscience.org/search-standards` | `LS-007` (`lane6-life-science.md`) | `{ source: "https://www.nextgenscience.org/search-standards", verifiedOn: "<YYYY-MM-DD>" }` |
| 6 | `biology:life-health:team-inside-you` | `10-18` / T2 | `MS-LS1-3` | `https://www.nextgenscience.org/search-standards` | `LS-008` (`lane6-life-science.md`) | `{ source: "https://www.nextgenscience.org/search-standards", verifiedOn: "<YYYY-MM-DD>" }` |
| 7 | `biology:life-ecosystems:grass-runs-short` | `10-18` / T2 | `MS-LS2-1` | `https://www.nextgenscience.org/search-standards` | `LS-009` (`lane6-life-science.md`) | `{ source: "https://www.nextgenscience.org/search-standards", verifiedOn: "<YYYY-MM-DD>" }` |
| 8 | `biology:life-heredity:family-resemblance` | `10-18` / T2 | `MS-LS3-1` | `https://www.nextgenscience.org/search-standards` | `LS-014` (`https://www.nextgenscience.org/dci-arrangement/ms-ls3-heredity-inheritance-and-variation-of-traits`) | `{ source: "https://www.nextgenscience.org/search-standards", verifiedOn: "<YYYY-MM-DD>" }` |
| 9 | `biology:life-evolution:peppered-moth` | `10-18` / T2 | `MS-LS4-6` | `https://www.nextgenscience.org/search-standards` | `LS-018` (`https://www.nextgenscience.org/dci-arrangement/ms-ls4-biological-evolution-unity-and-diversity`) | `{ source: "https://www.nextgenscience.org/search-standards", verifiedOn: "<YYYY-MM-DD>" }` |
| 10 | `biology:life-ecosystems:valley-wolves` | `10-18` / T3 | `HS-LS2-1` | `https://www.nextgenscience.org/dci-arrangement/hs-ls2-ecosystems-interactions-energy-and-dynamics` | `LS-010` (`lane6-life-science.md`) | `{ source: "https://www.nextgenscience.org/dci-arrangement/hs-ls2-ecosystems-interactions-energy-and-dynamics", verifiedOn: "<YYYY-MM-DD>" }` |
| 11 | `biology:life-matter:follow-carbon` | `10-18` / T3 | `HS-LS2-3` | `https://www.nextgenscience.org/dci-arrangement/hs-ls2-ecosystems-interactions-energy-and-dynamics` | `LS-011` (`lane6-life-science.md`) | `{ source: "https://www.nextgenscience.org/dci-arrangement/hs-ls2-ecosystems-interactions-energy-and-dynamics", verifiedOn: "<YYYY-MM-DD>" }` |
| 12 | `biology:life-heredity:molecular-inheritance` | `10-18` / T3 | `HS-LS3-1` | `https://www.nextgenscience.org/dci-arrangement/hs-ls3-heredity-inheritance-and-variation-of-traits` | `LS-019` (`lane6-pass2-heredity-evolution.md`) | `{ source: "https://www.nextgenscience.org/dci-arrangement/hs-ls3-heredity-inheritance-and-variation-of-traits", verifiedOn: "<YYYY-MM-DD>" }` |
| 13 | `biology:life-evolution:speciation-islands` | `10-18` / T3 | `HS-LS4-5` | `https://www.nextgenscience.org/dci-arrangement/hs-ls4-biological-evolution-unity-and-diversity` | `LS-025` (`lane6-pass2-heredity-evolution.md`) | `{ source: "https://www.nextgenscience.org/dci-arrangement/hs-ls4-biological-evolution-unity-and-diversity", verifiedOn: "<YYYY-MM-DD>" }` |
| 14 | `biology:life-health:read-the-label` | `18+` / T4 | `"UNVERIFIED"` (no K-12 standard) | `N/A` (`standard: "UNVERIFIED"`) | `LS-013` (`lane6-life-science.md`: product-designed adult biological literacy) | `{ source: "Educator sign-off on LS-013 biological literacy item (no national 18+ standard)", verifiedOn: "<YYYY-MM-DD>" }` |

*Note:* Items #1–#9 currently store `https://www.nextgenscience.org/search-standards` in `items.ts`; educators should verify whether to keep that URL or point #8–#9 to the specific MS DCI arrangement URLs from `lane6-pass2-heredity-evolution.md`.

## 2. Age-Band Appropriateness Check (`4` T1, `5` T2, `4` T3, `1` T4)

| Tier & Band | Count | Items | Appropriateness Notes for Educator Check |
|---|---|---|---|
| **T1 (`7-10`, Grades 2–5)** | 4 | `seed-diary`, `whose-baby`, `built-for-job`, `dry-summer` | Observable phenomena only (sprouting bean seed, chick vs. hen, woodpecker skull, waxy leaves). No cellular or molecular mechanisms, consistent with NGSS 3–5 boundaries. |
| **T2 (`10-18`, Middle School)** | 5 | `one-cell-many-jobs`, `team-inside-you`, `grass-runs-short`, `family-resemblance`, `peppered-moth` | Relational/system explanations (organelle function, interacting body systems, resource limits, genes/alleles on chromosomes, natural selection). Tagged `"T2"` in `src/subjects/shared/tier-tags.ts`. |
| **T3 (`10-18`, High School)** | 4 | `valley-wolves`, `follow-carbon`, `molecular-inheritance`, `speciation-islands` | Quantitative carrying capacity (`~30` wolves), carbon cycling (`CO₂ ↔ glucose`), DNA complementary base pairing (`A-T-C-G` → `T-A-G-C`), and adaptive radiation. Tagged `"T3"` in `src/subjects/shared/tier-tags.ts` with USABO competition ceiling. |
| **T4 (`18+`, Adult)** | 1 | `read-the-label` | Adult statistical/biological literacy: distinguishing relative risk (`×2`) from absolute risk (`1 in 10,000` → `1 in 5,000`). |

## 3. `read-the-label` (`18+`) No-Medical-Advice Verification

Inspected `src/subjects/biology/items.ts` lines 428–452:
- **why:** *"A headline says a food 'doubles your risk.' That sounds alarming — but what does 'doubles' actually tell you if you don't know the starting rate? Reading like a scientist means checking the baseline."*
- **prompt:** *"A headline says a food 'doubles the risk' of a disease. The baseline risk is 1 in 10,000. What is the new absolute risk per person?"*
- **choices / correct:** `"1 in 5,000 (still very small)"` (distractors: `"1 in 2 (50% chance)"`, `"It depends on how much you eat"`).
- **derivation:** *"Doubling a 1-in-10,000 baseline gives 2 in 10,000 = 1 in 5,000. Relative risk (×2) is scary; absolute risk (0.01% → 0.02%) is small. No medical advice given."*
- **Verification:** The item tests arithmetic interpretation of relative vs. absolute risk only. It names no real food, disease, symptom, diagnosis, treatment, or dietary recommendation, and satisfies the `LS-013` boundary (`No diagnosis, treatment, or medical advice`).

## 4. Card Media & ClueScene Status

- **Media (`BIOLOGY_RECORDS[*].media`):** All 14 records keep `media: []`. Verified against `public/images/journal/` (all `.webp` stills are geographic/landmark stills) and `public/videos/journal-manifest.json` (no biology clips exist).
- **ClueScenes:** `src/subjects/biology/BiologyCase.tsx` currently passes no `scene` prop. All 60 existing `ClueSceneDescription` kinds in `src/subjects/shared/clue-scene-types.ts` render domain-specific SVG scenes for Math, Physics, Chemistry, General Knowledge, or Social Studies; adding biology scenes requires adding new kinds in `src/subjects/shared/`.

## 5. Educator Gate Rubric Checklist (`docs/scaling/educator-gate-rubric.md`)

Mark each item **Pass**, **Fix**, or **Fail** with a one-line note.

**A. Content correctness and fit**
- [ ] 1. Every fact is correct and sourced; nothing taught is wrong or misleading.
- [ ] 2. Each item's content fits the stated band (`4` T1, `5` T2, `4` T3, `1` T4).
- [ ] 3. Standard codes (`5-LS1-1` through `HS-LS4-5`, plus `LS-013` T4) are the right ones for each item.
- [ ] 4. Sensitive topics: N/A or handled neutrally and gently for the band.

**B. Learning design**
- [ ] 4a. Each unit shows how it connects (`buildsOn`) and applies to a real-life setting.
- [ ] 4b. Each unit names a valid cross-subject connection (`useElsewhere`).
- [ ] 4c. Why first: each `why` opens with a real problem before the skill/question.
- [ ] 5. Each objective uses an observable verb (`argue from evidence`, `compare`, `explain`, `analyse`, `evaluate`) paired with `shown by`.
- [ ] 6. The player attempts a choice before seeing `derivation`.
- [ ] 7. Feedback / derivation explains *why* in band-level words.
- [ ] 8. Misses return in review deck (shared `SubjectCase`).
- [ ] 9. Mastery bar is fair: not luck, not grind (shared `SubjectCase`).

**C. Child-appropriate engagement**
- [ ] 10. Motivation comes from mastery and curiosity (no shaming or forced timers).
- [ ] 11. Session length suits the band.
- [ ] 12. A learner of the band can tell what to do just by looking.

**D. Access**
- [ ] 13. Read-aloud and captions cover prompts; a 7-year-old can follow every `7-10` item.
- [ ] 13a. Audience fit across `7-10`, `10-18`, `18+` (`read-the-label` stays adult).
- [ ] 14. No fast reflexes or precise dragging required.
- [ ] 15. Reduced-motion / Flat tier teaches the same content.

**E. Safety and privacy**
- [ ] 16. No personal information asked for or possible to enter.
- [ ] 17. No content a school would object to for the band; `read-the-label` gives no medical advice.
- [ ] 17a. Content screen: no religion as belief, mythology, sexuality/gender identity, or contested politics.

```text
EDUCATOR SIGN-OFF
Spec: src/subjects/biology/items.ts + src/subjects/biology/educator-review-packet.md at commit [ ]
Signer: [name], [role], [band(s)], [subject]
Date: [YYYY-MM-DD]
Result: Approved / Approved after fixes / Not approved
Fixes: [list with owner]
Signature (typed name is fine): [ ]
```
