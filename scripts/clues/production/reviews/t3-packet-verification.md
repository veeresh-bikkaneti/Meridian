# T3 Sampling-Packet Verification — GeoDetective clue batch (387 sets)

**Reviewer:** Independent Reality Checker (testing_reality_checker persona)
**Date:** 2026-10-04
**Document under review:** `scripts/clues/production/reviews/t3-sampling-packet.md`
**Branch / HEAD verified first-hand:** `feat/geodetective-clues` @ `f58b16192e2388ebb797d67386702c5c0425d213`
**Method:** Default verdict was NEEDS WORK. Every claim below was re-derived by the reviewer from raw files (published JSON, `records-tier2.jsonl`, `git show aab506b:…`, and the cited branch documents) with the reviewer's own scripts in `/tmp`. No number or text was taken from the packet's own claims.

## Verdict

**CERTIFIED**

All 16 index claims, all deep-sampled clue texts and quotes, all six §2 flag representations, the batch-facts table, and both locked hashes reproduced exactly from the raw files. No exact mismatches were found. One non-blocking attribution nuance is recorded under Check 3 (Puerto San José); it does not misstate the flag's substance, its source, or any clue/quote text.

---

## Check 1 — Indices — PASS (16/16)

For each entry I opened `public/loop/clues/{claimed current index}.json` and compared its `placeId` field to the packet's placeId:

| Packet § | placeId | Claimed current index | File's placeId | Result |
|---|---|---|---|---|
| 2.1 Puerto San José | `geonames:3591060` | 361 | `geonames:3591060` | PASS |
| 2.2 Karaj | `geonames:128747` | 20 | `geonames:128747` | PASS |
| 2.3 Gaziantep | `geonames:314830` | 125 | `geonames:314830` | PASS |
| 2.4 Mohali | `geonames:6992326` | 138 | `geonames:6992326` | PASS |
| 2.5 Cavite City | `geonames:1717641` | 140 | `geonames:1717641` | PASS |
| 2.6 Mostar | `geonames:3194828` | 116 | `geonames:3194828` | PASS |
| 3.1 Denton | `geonames:4685907` | 44 | `geonames:4685907` | PASS |
| 3.2 Imphal | `geonames:1269771` | 48 | `geonames:1269771` | PASS |
| 3.3 Nairobi | `geonames:184745` | 74 | `geonames:184745` | PASS |
| 3.4 Alor Setar | `geonames:1736309` | 85 | `geonames:1736309` | PASS |
| 3.5 Khartoum | `geonames:379252` | 89 | `geonames:379252` | PASS |
| 3.6 El Obeid | `geonames:379003` | 136 | `geonames:379003` | PASS |
| 3.7 Birmingham | `geonames:4049979` | 151 | `geonames:4049979` | PASS |
| 3.8 Brownsville | `geonames:4676740` | 154 | `geonames:4676740` | PASS |
| 3.9 Bsharri | `geonames:276359` | 315 | `geonames:276359` | PASS |
| 3.10 Seward | `geonames:5873776` | 377 | `geonames:5873776` | PASS |

Pre-repair tree (`git show aab506b:public/loop/clues/…`):

- Puerto San José: `aab506b:…/362.json` → `placeId` `geonames:3591060` — pre-repair 362 → current 361 confirmed.
- Seward: `aab506b:…/378.json` → `placeId` `geonames:5873776` — pre-repair 378 → current 377 confirmed.
- Palestina: `aab506b:…/340.json` → `placeId` `geonames:3673269`; in the live tree a scan of all published files for `3673269` returned **0 hits** — Palestina (`geonames:3673269`) is absent, as claimed.
- "Unchanged by the repair shift" claims: for the other 14 entries I also checked the same index in the `aab506b` tree — all 14 carried the same placeId at the same index pre-repair. The two shifted entries are exactly the two the packet marks as shifted.
- §3 provenance: the packet's stated pre-repair index list (44, 48, 74, 85, 89, 136, 151, 154, 315, 378) maps, through the `aab506b` tree, to exactly the 10 placeIds in §3, in order.
- Tree shape: 387 published files, indices 0–386 contiguous; `public/loop/manifest.json` = `{"v":1,"size":387,"generatedAt":"2026-10-04T23:14:20.160Z"}`.

## Check 2 — Deep sample — PASS (all 16 entries, exceeding the required 5)

Required minimum was 5 entries spread across §2 and §3. I deep-sampled **all 16**: §2.1 Puerto San José, §2.2 Karaj, §2.3 Gaziantep, §2.4 Mohali, §2.5 Cavite City, §2.6 Mostar, §3.1 Denton, §3.2 Imphal, §3.3 Nairobi, §3.4 Alor Setar, §3.5 Khartoum, §3.6 El Obeid, §3.7 Birmingham, §3.8 Brownsville, §3.9 Bsharri, §3.10 Seward.

Method per entry: published file (by placeId-verified index) → the matching line in `scripts/clues/production/records-tier2.jsonl` (matched on `place_id`, e.g. `geonames:3591060` → `gn-3591060`; I verified the file holds 8,690 lines, one per place_id, 387 with `status` `"accepted"`, and all 16 sampled records are the accepted lines) → byte-identity (exact string equality / verbatim substring within that entry's own packet section) across all three sources.

Results, per entry and in aggregate:

- Published `clues[]` == record `clues[].text` (all 5 tiers, tier order): **16/16 entries, 80/80 texts**.
- Every packet clue text is byte-identical to both the published file and the record: **80/80 texts present verbatim in the packet, in the correct entry's section**.
- §2 quotes: every packet source quote is byte-identical to the record's `clues[].source.quote`: **30/30 quotes** (6 entries × 5 tiers).
- §3 tier-2 quotes: the one printed quote per entry is byte-identical to the record's tier-2 `source.quote`: **10/10**. Spot-check of other tiers (in fact, all tiers): all §3 clue texts verified as above; the other tiers' quotes are, by the packet's stated §3 design, not printed — the per-entry presence pattern was exactly tier-2 only, which matches the packet's own description, not a discrepancy.

## Check 3 — Flag fidelity — PASS

- **2.1 Puerto San José** — `tier2-source-expansion-scope.md` §5 calls it the thinnest pass, quote = Köppen label plus season boundaries, qualifying under *seasonal rhythms qualify*, "the floor of that class — the one sample set a human reviewer should look at first"; the packet quotes this faithfully. `reviews/milestone-0-review.md` Check 2 describes the same quote as "thin but verbatim and traceable" — the packet's concurrence quote is verbatim. `tier2-run-report.md` carries it as the first bullet of "Flags carried forward". Index history in the packet (203 at milestone 0 → 362 pre-repair → 361 now) matches milestone-0 Check 3 (idx 203) and the run report (362).
  - *Non-blocking observation (not a mismatch):* the packet sentence "`tier2-run-report.md` carries it in "Flags carried forward" as Karaj-adjacent" slightly conflates two sources. The run-report bullet reads verbatim: "**Puerto San José gn-3591060** — one of the folded 43 sample sets; assembled like the others, NO rule change; **current published index 362** (203 at milestone 0; wave insertions in pool fame order shifted it)." — it does not use the words "Karaj-adjacent"; that descriptor is from the scope document ("**Thinnest pass — Puerto San José gn-3591060 (flagged, Karaj-adjacent).**"). The descriptor is true of the set and sourced in the packet's own cited §5 document; the flag's substance is unaffected.
- **2.2 Karaj** — `validation-report.md` Gap 2: the tier-2 clue "passes every mechanical check but is semantically hollow. Flagged for Veeresh's sampling review; semantic climate substance is a documented validator gap, not a silent pass." The packet reproduces this faithfully, and `tier2-run-report.md` does carry it as a standing prior semantic flag ("Karaj gn-128747 (hollow climate)").
- **2.3 Gaziantep** — `reviews/milestone-2-review.md` §4 ruling is **PASS (narrow)** with the quantified snow regime (4.6 snowy days/winter, 10 days of snow cover, 2.5 hail days) and "Weakness noted: the stats are 1966 vintage" — the packet matches, including the watch-item carry in `tier2-run-report.md`.
- **2.4 Mohali — resolution verified.** One set, `geonames:6992326`, at index 138 (verified in Check 1; also same index pre-repair). Both flags trace to `reviews/milestone-2-review.md`: Flag A to §6 (independent stricter scan, 29 raw hits all adjudicated non-leaks; tier 5 names Sahibzada Ajit Singh; ruling **not a leak under the locked rule** — I independently confirmed the record's `answer.aliases` are `["Sahibzada Ajit Singh Nagar", "Ajitgarh"]`, so the recorded alias is the full string the packet names, and it never appears in the tier-5 text); Flag B to §4 (tier 3 = 2006 district carve-out, "the weakest passing history class, same class as Cavite City's 1614 tenure, and a class the wave's own workers rejected elsewhere when it was *all* a lead offered"; tier 2 = explicit "seasonal rhythm" quote with winter frost). "Mohali-138" = this set's published index — confirmed against the build plan's T3 input list (see below), which literally lists both "Mohali" and "Mohali-138".
- **2.5 Cavite City** — `reviews/milestone-2-review.md` §4 random spot-reads (12/12 PASS): T2 "Aw label + pronounced wet/dry seasonal rhythm — "seasonal rhythm" is an accepted category, and the months are exact" and T3 "provincial-seat tenure from 1614 — a dated institutional event, not a superlative" — packet matches; carried as a watch item ("soft spots") in `tier2-run-report.md`.
- **2.6 Mostar** — `reviews/milestone-2-review.md` §4 ruling **PASS** with the non-blocking notes the packet reproduces (tiers 3/4 both rest on the Old Bridge with acceptable separation; tier 5's name-meaning statement accurate under the narrowing's parse; Stari Most does mean Old Bridge). "Mostar-116" = published index 116 — verified.
- **For-completeness note** — the four older prior flags the packet names (Kawambwa gn-176555, Sisimiut gn-3419842, Torquay gn-2635650, San Antonio Oeste gn-3837980) are all in `tier2-run-report.md`'s "Prior semantic flags stand" list, verbatim placeIds.
- **Provenance of §2/§3 lists** — cross-checked against the build plan's T3 input (outside the branch, `~/workspace/user/files/geodetective-build-plan.md`): "the flagged sets (Puerto San José idx 362, Karaj, Gaziantep, Mohali, Cavite City, Mostar-116, Mohali-138) + the 10 quote-coverage sets (indices 44, 48, 74, 85, 89, 136, 151, 154, 315, 378)" and the batch-wide call "quote-widening (~97 sets) or accept the disclosure + future guidance" — the packet's lists and the ~97 figure match this exactly. A grep of the branch production documents (excluding the packet) for the ~97 / quote-widening enumeration returned no hits, confirming the packet's disclosure that the branch docs do not contain a set-by-set enumeration of the 97.
- **Batch-facts table** — against `reviews/t1-repair-certification.md` and `reviews/t2-rebase-integrity-certification.md`: 387 published sets (T1 Check 4; T2 Claim 2) ✓; manifest size 387, with T2 Claim 2's 388/388 sha256 OK including the manifest ✓; leak scan 0 hits / 1,935 clue texts (T1 Check 4 independent re-assembly; T2 Claim 6 independently re-derived, byte-identical reassembly) ✓; gates `npm test` 567/567 · `tsc --noEmit` clean · `lint-cards` GATE PASSED · `build:pages` green · clue suites 70/70 (T2 Claim 5 table) ✓; run history 388 assembled → T1 repair → 387 ✓. (I verified the table against the certifications as instructed; I did not re-run the gates myself.)

## Check 4 — Locked hashes — PASS

Recomputed by me with `sha256sum`:

- `scripts/clues/generation-prompt.md` = `7f19d3c5857639473b653e8495eb2088ef320ff77b69ca143c1bc0e3c3d2920a` — matches the required hash exactly.
- `scripts/clues/production/validate-production.mjs` = `22c019599af15c56eaf277258e1a0b1951fc31a0ca82634bd0c21c02690411f4` — matches the required hash exactly.

## Check 5 — Docs-only scope — PASS

Before writing this report: `git status --short --branch` on `feat/geodetective-clues` showed exactly one entry — `?? scripts/clues/production/reviews/t3-sampling-packet.md` — and `git diff` / `git diff f58b161` were empty. No clue file, record, script, prompt, or validator differs from `f58b161`. The only file added by this review is this verification report itself. Nothing was committed or pushed, and the packet was not modified.

## Mismatches

**None.** No exact mismatch was found in any index, placeId, clue text, source quote, flag representation, batch fact, or hash. The single non-blocking attribution nuance (Puerto San José "Karaj-adjacent", Check 3) is quoted verbatim there for the record; it does not affect any verdict Veeresh is asked to make, since the clue and quote texts he will judge are byte-identical to the published files and production records.

---

**Reviewer:** TestingRealityChecker (independent)
**Assessment date:** 2026-10-04
**Evidence:** all numbers and texts above derived first-hand in this session from the published JSON files, `records-tier2.jsonl`, `git show aab506b:…`, the cited branch documents, and `sha256sum` runs; intermediate scripts written only to `/tmp`. No file modified except this verification report.
