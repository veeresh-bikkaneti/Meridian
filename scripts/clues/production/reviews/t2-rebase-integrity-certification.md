# T2 — Rebase Integrity Certification (independent reviewer)

**Reviewer:** TestingRealityChecker persona (independent; default verdict NEEDS WORK, reversed only on first-hand evidence)
**Date:** 2026-10-04
**Branch:** `feat/geodetective-clues`
**Verified at HEAD:** `df346186ee3bb0c6e4dcac57fff8a19d328f084e` (post-rebase; pre-rebase HEAD was `3faa9dc`)
**Method:** every claim below was re-derived by the reviewer with their own commands in the worktree. No brief numbers were trusted.

## Claim 1 — BASE — PASS

- `git rev-parse HEAD` → `df346186ee3bb0c6e4dcac57fff8a19d328f084e` (`df34618 fix(clues): T1 repair — Palestina fail-closed reject, Bremerhaven tier-5 recompose (387 sets)`)
- `git log --oneline -1 origin/main` → `650065e Merge pull request #57 from veeresh-bikkaneti/fix/result-card-edition-header` (`650065e95f01fa33034c77ed35d7cbdce42d7130`)
- `git merge-base --is-ancestor origin/main HEAD` → exit 0 (HEAD descends from origin/main)
- `git status --porcelain` → empty (0 lines); tree clean before and after all gate runs

## Claim 2 — PUBLISHED CONTENT BYTE-IDENTICAL — PASS

- `/tmp/pre-rebase-loop-sha256.txt`: 388 lines (manifest.json + 387 clue files)
- `(cd public/loop && sha256sum -c /tmp/pre-rebase-loop-sha256.txt)` → exit 0, **388/388 `: OK`**, zero non-OK lines
- `ls public/loop/clues/*.json | wc -l` → **387**
- `public/loop/manifest.json` → `{"v":1,"size":387,...}` — manifest size **387**

## Claim 3 — RECORDS/REPORTS INTACT — PASS

- `git diff --stat 3faa9dc HEAD -- scripts/clues public` → **empty** (0 lines). The rebase changed no branch content under `scripts/clues` or `public`.
- Full `git diff --stat 3faa9dc HEAD` touches only main-line files (expected from the new base): `playwright.config.ts`, `src/components/game-app.tsx`, `src/components/question-bubble{,.test}.tsx/ts`, `src/components/result-card.tsx`, `src/game/question-label{,.test}.ts`, `tests/e2e/question-card-header.spec.ts` — 8 files, all from origin/main PR #57 lineage, none branch-owned.
- Prompt: `sha256sum scripts/clues/generation-prompt.md` → `7f19d3c5857639473b653e8495eb2088ef320ff77b69ca143c1bc0e3c3d2920a` — matches claimed hash exactly.
- Validator: `sha256sum scripts/clues/production/validate-production.mjs` → `22c019599af15c56eaf277258e1a0b1951fc31a0ca82634bd0c21c02690411f4` — matches claimed hash exactly.

## Claim 4 — T1 OUTCOME SURVIVED — PASS

- Palestina `gn-3673269`: `grep -rl "3673269" public/loop/` → no matches (exit 1); `grep -rl "Palestina" public/loop/` → no matches; no clue file for the place. Absent from all published files.
- Its `scripts/clues/production/records-tier2.jsonl` line is the rejection record: `"status":"rejected"`, `"place_id":"gn-3673269"`, tier 5, reason citing the tier-5 hard rule (tier 5 repeats tier 3's UNESCO "Coffee Cultural Landscape" payload; fail-closed reject per Chitti post-delivery verification / build plan T1).
- Bremerhaven `geonames:2944368` at published index 149 (`public/loop/clues/149.json`), tier 5 (clues[4]) verbatim: *"This port spent eight years as part of a bigger city, Wesermünde. It was made in 1924 when the port's rival town joined with the town next door, and this port was handed back in 1947."* — the recomposed Wesermünde text, not the pre-repair restatement.
- `BRANCH_STATUS.md:68` contains `- [x] **T1 — 2-set repair EXECUTED + CERTIFIED 2026-10-04** ...` — the BRANCH_STATUS rebase conflicts were resolved in the branch's favor; the T1 section survived.

## Claim 5 — GATES (run by reviewer) — PASS

| Gate | Command | Result |
|---|---|---|
| Unit/integration | `npm test` | exit 0 — **567 tests, 567 pass, 0 fail** (36 suites) |
| Types | `npx tsc --noEmit` | exit 0, no output (clean) |
| Card lint | `node scripts/lint-cards.mjs` | exit 0 — prints `lint-cards: GATE PASSED` (chunk audit: 124,690 records, 0 curated-note violations) |
| Build | `npm run build:pages` | exit 0 — prerendered 1 page; `fingerprint-sw: stamped buildId=df34618` (matches HEAD) |
| Clue suites | `node --test scripts/clues/*.test.mjs scripts/clues/production/*.test.mjs` | exit 0 — **70 tests, 70 pass, 0 fail** |

Note: `npm test` count is 567, up from 563 pre-rebase — consistent with origin/main's added tests (`question-label.test.ts`, expanded `question-bubble.test.ts`) arriving via the rebase, not with branch content loss (Claim 3's empty diff rules that out).

## Claim 6 — LEAK RE-DERIVED INDEPENDENTLY — PASS

- Fresh temp copy (`/tmp/t2-leak-check`: `scripts` + `public` + `package.json` copied from the worktree), then `node scripts/clues/production/assemble.mjs --records records-tier2.jsonl` → exit 0.
- Assembler stdout report: `"published": 387`, leakScan: `filesScanned 387`, `clueTextsScanned 1935`, **`hits: 0`** (folded substring scan of every published clue text against name + aliases + curated aliases, plus whole-file scan with source href scrubbed).
- `diff -r /tmp/t2-leak-check/public/loop/clues <branch>/public/loop/clues` → exit 0, 0 diff lines — **reassembled clues byte-identical to the branch's published clues**.
- Manifests match on `v` and `size` (387); only `generatedAt` differs (run timestamp, expected nondeterminism).

## Verdict

**CERTIFIED**

All six claims reproduced exactly from first-hand runs at `df34618`. The rebase onto `origin/main` @ `650065e` preserved the branch's published content byte-for-byte (388/388 checksums OK), left `scripts/clues` + `public` untouched relative to pre-rebase `3faa9dc`, kept the prompt and validator hashes identical, preserved both T1 repair outcomes (Palestina rejected/absent; Bremerhaven tier-5 Wesermünde recompose at index 149) and the branch's BRANCH_STATUS T1 section, and all gates pass on the rebased tree with an independently re-derived leak scan of 0 hits over 387 published sets.

No discrepancies found. This certification covers rebase integrity only; it does not clear the 365 mode-code gate, Veeresh's sampling review, or any merge/PR decision.
