# Tier-2 expansion run — state (coordinator working file)

Branch feat/geodetective-clues · run start HEAD 0f8bec9
Hashes at start (reviewer re-checks every milestone):
- generation-prompt.md sha256 7f19d3c5857639473b653e8495eb2088ef320ff77b69ca143c1bc0e3c3d2920a (matches directive)
- validate-production.mjs sha256 22c019599af15c56eaf277258e1a0b1951fc31a0ca82634bd0c21c02690411f4

Population accounting (coordinator-derived from raw records):
- records.jsonl (Phase 2, short-extract inputs): 2,189 attempted / 63 accepted
- records-full.jsonl (Option A, fuller leads): 8,200 attempted / 123 accepted
  - climate tier rejections: 7,998 lines = 7,997 worker + 1 validator-converted
    (Cockermouth gn-2652676, CLIMATE_NO_SIGNAL — NOT in wave population)
- records-scope.jsonl: 200 sampled (all from the 7,997) / 43 accepted (folded in)
- WAVE POPULATION: 7,997 - 200 sampled = 7,797, fame order = pool.jsonl rank
- Baseline union target: 63 + 123 + 43 = 229

Scratch inputs (never committed): .scratch/geodetective/
  full-inputs.jsonl (10,582), scope-inputs.jsonl (200),
  climate-sections.jsonl (200 at start; waves append),
  tier2-inputs.jsonl (wave union inputs, built incrementally)

## Milestones
- [x] M0 baseline 229: revalidate-union -> records-tier2.jsonl (union) ->
      assemble -> leak scan -> reviewer certify -> commit/push
      M0 assemble commit 24e6080; prep commit 991507a.
      REVIEWER: CERTIFIED (reviews/milestone-0-review.md) — strata
      63/123/43 disjoint, union 229, revalidation 0 invalid, own leak
      scan 0/1,145, scope regeneration byte-identical (all 200 lines).
- [ ] Waves T2-1..n over the 7,797 until assembled >= 365 or pool exhausted
      WAVE 1 (200 places, pool ranks 1-217): jobs built + sections fetched
      (175/200). Worker delivery channel fault: depth-2 worker shell
      writes land in a private overlay — outputs recovered via reply-JSONL
      or muse.write; EVERY file id-verified position-by-position vs job
      file before use. Two wrong-job deliveries (jobs 3, 7 — content for
      places in no tier2 job, though internally coherent w/ real section
      extracts) caught by id check and DISCARDED; redelivery ordered.
      Verified on disk so far: jobs 1,2,4,6,8,10 (53 worker-accepted
      pre-validation). Pending redelivery: 3, 5, 7, 9.
- [ ] Finish: gates + full-run report + BRANCH_STATUS + final reviewer cert

## Standing generation-worker brief (per job: 20 places)
Read in full first: scripts/clues/generation-prompt.md (locked spec).
Job file: tranches/tier2-jobs/wave<W>-job<J>.json — each entry has the
§9 input (extracts[0]=fuller lead; extracts[1]=Climate/Geography
section when present), evidence, banned_terms.
Emit exactly one record per place, in job order, to
tranches/tier2-out/wave<W>/wave<W>-job<J>.jsonl:
- accepted: prompt §10 shape (schema meridian.loop.clues.v1, answer
  block w/ difficulty int 1-5 guessability, 5 clues each with
  narrowing + source{article,url,quote}).
- rejected: §6 shape, nested rejection{tier,tier_name,reason,missing},
  first failing tier in ladder order.
Rules checklist (prompt governs): facts ONLY from extracts; each
quote a verbatim span (>=24 chars) of the extract whose article label
it cites — cite the label EXACTLY as in the input. Tier 2 may cite
lead or section; tiers 1/3/4/5 cite the LEAD only. NEVER the place
name / name parts / aliases / demonyms in text or narrowing (see
banned_terms); no wordplay or name-meaning translations. Each clue
15-40 words, 1-2 sentences, <=25 words/sentence, FK<=6.0 reading
level, NO decimal numbers in clue text. Climate must state a
place-specific mechanism / extreme / record / seasonal rhythm /
paradox traceable to its quote — a classification label alone fails;
one-off weather events, tides, wind-as-power do NOT qualify; climate
must not repeat what geography implies. History = one discriminating
detail (year+founder or one defining event). Hook = one retellable
near-decisive fact. Giveaway = single most confirming fact, NOT a
summary. Aliases only when the extract itself attests another name.
Any tier unsourceable -> reject the whole set at that tier.
Report: accepted/rejected counts + rejection tier histogram.

## Repair protocol (validator text-failures)
Coordinator extracts validator-failed records; repair worker rewrites
ONLY the flagged tiers' text (quotes/answer unchanged unless the
validator flagged them), writes full records to
tranches/tier2-repairs/wave<W>-repair.jsonl; coordinator swaps them
into the wave out files by place_id and re-folds until
validatorRejected = 0.

