# T1 Repair Certification — GeoDetective clue production (feat/geodetective-clues)

**Reviewer:** Independent Reality Checker (testing_reality_checker persona)
**Date:** 2026-10-04
**Scope:** Uncommitted T1 changes on branch `feat/geodetective-clues` @ `aab506b` in worktree `~/workspace/meridian-worktrees/geodetective-clues`
**Method:** Every claim re-derived from raw files by the reviewer. Default verdict was NEEDS WORK; each item below was certified only on the evidence quoted.

## Verdicts (summary)

| Item | Verdict |
|---|---|
| Palestina removal (gn-3673269) | **CERTIFIED** |
| Bremerhaven recomposed set (gn-2944368) | **CERTIFIED** |
| 387 assembly | **CERTIFIED** |

---

## Check 1 — records-tier2.jsonl records — PASS

Parsed the full file (8,690 lines, same count as `HEAD`) and diffed every record against `git show HEAD:scripts/clues/production/records-tier2.jsonl`. **Exactly two place_ids differ in the entire file: `gn-3673269` and `gn-2944368`.** No other record was touched.

### Palestina gn-3673269
- Exactly **1** line in the current file (and 1 in HEAD).
- Current line is a rejection record with the complete §6 shape (per `scripts/clues/generation-prompt.md` §6 template, plus the file's `schema` field):
  - `status`: `"rejected"`
  - `place_id`: `"gn-3673269"`
  - `rejection.tier`: `5`, `rejection.tier_name`: `"giveaway"`
  - `rejection.reason`: *"tier 5 repeats tier 3 payload: both clues rest on the same UNESCO \"Coffee Cultural Landscape\" World Heritage (2011) honor and cite the identical source quote; tier 5 must be a giveaway, not a summary or restatement of an earlier tier (locked prompt tier-5 hard rule). The supplied extract is too thin to source a distinct compliant giveaway. Fail-closed reject per repair work order (Chitti post-delivery verification; build plan T1, 2026-10-04) — set removed from the published assembly so no reassembly resurrects it."* — names the tier-3 duplication **and** the work order.
  - `rejection.missing`: *"a distinct giveaway fact for Palestina, sourceable verbatim from its extracts and not already used by tiers 1-4 (an iconic landmark or cultural marker)"*
- Independent confirmation of the underlying violation: in the HEAD (pre-repair) accepted record, tier 3's `source.quote` and tier 5's `source.quote` are **byte-identical strings**: *"Because of this, the historic center of the town and surrounding rural areas were named part of the \"Coffee Cultural Landscape\" UNESCO World Heritage Site in 2011."* The rejection is factually grounded, not asserted.

### Bremerhaven gn-2944368
- Exactly **1** line, `status`: `"accepted"`.
- Tiers 1–4: parsed objects **identical** to HEAD (tier-by-tier equality check returned true for all four). Every other top-level field (`schema`, `status`, `place_id`, `answer`) is also identical to HEAD; the only differences in the whole record are the tier-5 clue object and the added `repair_note` field.
- Tier 5 is exactly the claimed new object:
  - text: *"This port spent eight years as part of a bigger city, Wesermünde. It was made in 1924 when the port's rival town joined with the town next door, and this port was handed back in 1947."*
  - source quote: *"Geestemünde united with neighbouring Lehe [de] to form the city of Wesermünde [de] in 1924, and Bremerhaven was itself annexed to Wesermünde in 1939, but the entire conurbation was restored to Bremen in 1947."*
  - narrowing: *"confirms the port that was annexed into Wesermünde and restored in 1947"*
- `repair_note` is present and documents the T1 recomposition, the reason (original tier 5 restated tiers 3+4), and why the work-order climate records were not used.

## Check 2 — Validator + lead-extract verification — PASS

- Extracted the single Bremerhaven line to a temp file and ran the shipped validator myself:
  `node scripts/clues/production/revalidate-union.mjs --records /tmp/bremerhaven-only.jsonl --inputs $PWD/.scratch/geodetective/tier2-inputs-wave2.jsonl`
  Result (exit 0): `{"total": 1, "accepted": 1, "rejected": 0, "acceptedValid": 1, "acceptedInvalid": 0, "failures": []}`.
- Independent substring check against the §9 input for `gn-2944368` in `.scratch/geodetective/tier2-inputs-wave2.jsonl`: the tier-5 quote above **is a verbatim substring of `extracts[0].text` (the lead)** — Python `quote in lead` returned `True`. The lead also contains the supporting context for the clue text (Geestemünde described as the historical rival; annexation 1939 → restoration 1947 = the clue's "eight years").
- Work-order dates claim verified: `"20 July 2022"` and `"25 February 1956"` (and the bare years `2022`/`1956`) **do not appear in the lead text** (`extracts[0]`). They appear **only** in `extracts[1]` (the Climate section), in the sentence *"…The hottest temperature ever recorded was on 20 July 2022, and the coldest was on 25 February 1956."* The claim that they were not usable for a lead-sourced tier 5 is correct.

## Check 3 — Payload independence (reviewer's own reading) — PASS

- Tier 3 payload: founded in **1827 as a seaport for Bremen** (the busy-partner-port founding story).
- Tier 4 payload: Bremerhaven is an **exclave** — a detached scrap of the city-state of Bremen entirely surrounded by other land (the "odd split").
- New tier 5 payload: a **distinct later political episode** — Wesermünde was formed in 1924 by Geestemünde uniting with Lehe, Bremerhaven was annexed into it in 1939, and the conurbation was restored to Bremen in 1947.

In my own words: the new giveaway does **not** restate either earlier payload. It says nothing about the 1827 founding or about being Bremen's seaport, and nothing about the exclave/detached-territory oddity. It identifies the place through a separate, previously unused fact chain (1924 formation / 1939 annexation / 1947 restoration) that is unique to Bremerhaven and decisive as a giveaway. The only overlap is the place's general identity as a port, which is the ladder's shared subject, not a repeated payload. This is a genuinely distinct giveaway.

## Check 4 — Assembly (387) — PASS

- `ls public/loop/clues | wc -l` = **387**.
- `public/loop/manifest.json` = `{"v":1,"size":387,"generatedAt":"2026-10-04T23:14:20.160Z"}` — size **387**.
- `grep -rl "geonames:3673269" public/loop/clues/` → **0 files** (also 0 hits for `3673269` anywhere under `public/loop/`).
- `grep -ril "Palestina" public/loop/` → **0 files / no hits**.
- Published Bremerhaven file is `public/loop/clues/149.json` (`placeId: "geonames:2944368"`, index unchanged from the pre-repair 149). Its 5th clue is exactly the new tier-5 text quoted in Check 1.
- On-disk `scripts/clues/production/assembly-report.json` claims `published: 387`, leak scan `filesScanned: 387`, `clueTextsScanned: 1935`, `hits: 0`.
- **Independent re-assembly:** copied the worktree (minus `.git`/`.scratch`/`node_modules`) to `/tmp/reviewer-assembly`, deleted its `public/loop/clues` + manifest, and ran `node scripts/clues/production/assemble.mjs --records records-tier2.jsonl --report /tmp/reviewer-assembly-report.json` there (exit 0). My run independently produced `published: 387` and leak scan `387 files / 1935 clue texts / 0 hits`. `diff -r` of my regenerated clues directory against the branch's `public/loop/clues/` → **byte-identical, no differences**. Manifest and assembly report match the branch's in every field **except `generatedAt`** (mine `2026-10-04T23:15:47.122Z` vs branch `2026-10-04T23:14:20.160Z`), which is the expected run timestamp.

## Check 5 — Invariants — PASS

- `sha256sum scripts/clues/generation-prompt.md` = `7f19d3c5857639473b653e8495eb2088ef320ff77b69ca143c1bc0e3c3d2920a` — matches the required hash exactly.
- `sha256sum scripts/clues/production/validate-production.mjs` = `22c019599af15c56eaf277258e1a0b1951fc31a0ca82634bd0c21c02690411f4` — matches the required hash exactly.
- `git status --porcelain`: changes confined to `scripts/clues/production/records-tier2.jsonl`, `scripts/clues/production/assembly-report.json`, and `public/loop/**` (49 clue files modified — index 149 (Bremerhaven) plus 340–386 shifted by the Palestina removal — `public/loop/clues/387.json` deleted, and `public/loop/manifest.json`). **Zero changes under `src/`** and no other paths. (This certification file itself, under `scripts/clues/production/reviews/`, is the sole additional file, written by the reviewer per the work order.)

---

## Final verdicts

- **Palestina removal — CERTIFIED.** Fail-closed §6 rejection record is complete and factually grounded (identical tier-3/tier-5 quote verified in HEAD); the set is absent from records-as-accepted and from all published files.
- **Bremerhaven recomposed set — CERTIFIED.** Tiers 1–4 untouched, tier 5 exactly as claimed, quote verbatim in the lead extract, shipped validator reports `acceptedValid 1 / 0 failures`, dates claim verified, and the new giveaway is payload-independent of tiers 3 and 4.
- **387 assembly — CERTIFIED.** 387 files, manifest size 387, zero Palestina traces, and an independent re-assembly in a clean copy reproduced the published directory byte-for-byte with a 0-hit leak scan.

No discrepancies found. Nothing in this certification covers Veeresh's human sampling review, the merge/PR decision, or the 365 mode-code gate — those remain open per the build plan and are outside T1.
