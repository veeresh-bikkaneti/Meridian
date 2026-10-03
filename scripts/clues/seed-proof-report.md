# GeoDetective seed proof — Phase 1

Date: 2026-10-03 (America/Chicago)

## Method

- Runner: `node scripts/clues/seed-proof.mjs` (from the worktree root, branch `feat/geodetective-clues`).
- Seed inputs read read-only via `git show origin/feat/meridian-loop:scripts/loop-seed.json` and `git show origin/feat/meridian-loop:public/loop/clues/<i>.json` for i in 0..11. That branch is never modified.
- Crawl cache (read-only reference, never copied or committed): `/home/hatch/workspace/meridian-worktrees/wikipedia-crawl/.scratch/wikipedia-enrichment/crawl-cache.jsonl`
- Pass 1 — strict production validation: each raw seed clue file through `validateClueSet(set, { placeName, bannedTerms: seed.banned + seed.eponyms, extractText: undefined })`.
- Pass 2 — content-only view: pass-1 reasons filtered to the content-code classes NAME_LEAK, TIER1_COORDS, CLIMATE_*, READING_LEVEL, CLUE_TOO_LONG, SENTENCE_TOO_LONG, separating content failures from old-schema failures.
- Pass 3 — composer pipeline: `loadCacheExtract` / `runComposer` against the real cache. For matched seeds, the seed's own clue texts are submitted as candidate drafts with the clue texts themselves as snippets. Hand-written paraphrases are not verbatim extract spans, so SOURCE_UNTRACEABLE is the expected outcome — this exercises the fail-closed path honestly. Difficulty and aliases are omitted, which also exercises those rejections. No snippets were mined or invented to force a pass.
- This report contains no extract text — place names, GeoNames ids, cache statuses, verdicts, and reason codes only.

## Totals

- Checked: 12
- Pass 1 (strict production validation): accepted 0 / rejected 12
- Pass 2 (content-only): 12 of 12 seeds have at least one content-code reason
- Pass 3 (composer pipeline): cache matched for 3 of 12 seeds; composer accepted 0 / rejected 3 / not run 9

> **0 accepted is the expected honest result.** The 12 seeds are old-schema engineering placeholders (no per-clue sources, no difficulty, no aliases), so strict production validation rejects every one of them. Nothing was adjusted, mined, or invented to force a pass.

## Per-seed results

| #   | Place          | GeoNames ID | Cache status   | Pass 1 verdict | Pass 1 reason codes                                                | Content-only codes (Pass 2) | Composer outcome (Pass 3)                                                         |
| --- | -------------- | ----------- | -------------- | -------------- | ------------------------------------------------------------------ | --------------------------- | --------------------------------------------------------------------------------- |
| 0   | Paris          | 2988507     | absent         | rejected       | DIFFICULTY_MISSING, ALIASES_MISSING, SOURCE_MISSING, READING_LEVEL | READING_LEVEL               | not run — extract stage: EXTRACT_NOT_FOUND                                        |
| 1   | Tokyo          | 1850147     | matched        | rejected       | DIFFICULTY_MISSING, ALIASES_MISSING, SOURCE_MISSING, READING_LEVEL | READING_LEVEL               | rejected — DIFFICULTY_MISSING, ALIASES_MISSING, READING_LEVEL, SOURCE_UNTRACEABLE |
| 2   | Cairo          | 360630      | absent         | rejected       | DIFFICULTY_MISSING, ALIASES_MISSING, SOURCE_MISSING, READING_LEVEL | READING_LEVEL               | not run — extract stage: EXTRACT_NOT_FOUND                                        |
| 3   | Sydney         | 2147714     | matched        | rejected       | DIFFICULTY_MISSING, ALIASES_MISSING, SOURCE_MISSING, READING_LEVEL | READING_LEVEL               | rejected — DIFFICULTY_MISSING, ALIASES_MISSING, READING_LEVEL, SOURCE_UNTRACEABLE |
| 4   | Rio de Janeiro | 3451190     | title-mismatch | rejected       | DIFFICULTY_MISSING, ALIASES_MISSING, SOURCE_MISSING, READING_LEVEL | READING_LEVEL               | not run — extract stage: EXTRACT_STATUS                                           |
| 5   | New York City  | 5128581     | absent         | rejected       | DIFFICULTY_MISSING, ALIASES_MISSING, SOURCE_MISSING, READING_LEVEL | READING_LEVEL               | not run — extract stage: EXTRACT_NOT_FOUND                                        |
| 6   | London         | 2643743     | absent         | rejected       | DIFFICULTY_MISSING, ALIASES_MISSING, SOURCE_MISSING, READING_LEVEL | READING_LEVEL               | not run — extract stage: EXTRACT_NOT_FOUND                                        |
| 7   | Beijing        | 1816670     | absent         | rejected       | DIFFICULTY_MISSING, ALIASES_MISSING, SOURCE_MISSING, READING_LEVEL | READING_LEVEL               | not run — extract stage: EXTRACT_NOT_FOUND                                        |
| 8   | Moscow         | 524901      | title-mismatch | rejected       | DIFFICULTY_MISSING, ALIASES_MISSING, SOURCE_MISSING, READING_LEVEL | READING_LEVEL               | not run — extract stage: EXTRACT_STATUS                                           |
| 9   | Cape Town      | 3369157     | matched        | rejected       | DIFFICULTY_MISSING, ALIASES_MISSING, SOURCE_MISSING, READING_LEVEL | READING_LEVEL               | rejected — DIFFICULTY_MISSING, ALIASES_MISSING, READING_LEVEL, SOURCE_UNTRACEABLE |
| 10  | Mumbai         | 1275339     | absent         | rejected       | DIFFICULTY_MISSING, ALIASES_MISSING, SOURCE_MISSING, READING_LEVEL | READING_LEVEL               | not run — extract stage: EXTRACT_NOT_FOUND                                        |
| 11  | Mexico City    | 3530597     | absent         | rejected       | DIFFICULTY_MISSING, ALIASES_MISSING, SOURCE_MISSING, READING_LEVEL | READING_LEVEL               | not run — extract stage: EXTRACT_NOT_FOUND                                        |

## Pass 1 reason-code histogram

| Code               | Occurrences |
| ------------------ | ----------- |
| READING_LEVEL      | 52          |
| ALIASES_MISSING    | 12          |
| DIFFICULTY_MISSING | 12          |
| SOURCE_MISSING     | 12          |

## Pass 2 content-code histogram

| Code          | Occurrences |
| ------------- | ----------- |
| READING_LEVEL | 52          |
