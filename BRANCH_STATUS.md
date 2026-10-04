# feat/wikipedia-crawl — status

Base: `origin/main` at `7593a87288727ce3930c336db7c6ddb31c697718`; **rebased onto `origin/main` `e18c3cf` (PR #46) on 2026-10-03** — the branch's only tracked change vs its old base was this file, so the rebase carried this file onto the new main in a single commit (`258c5c3`), then the merge commit follows.
Primary clone: `~/workspace/meridian-worktrees/meridian`
Worktree: `~/workspace/meridian-worktrees/wikipedia-crawl`

## Done

- [x] Branch + worktree created from origin/main (`git worktree add ~/workspace/meridian-worktrees/wikipedia-crawl -b feat/wikipedia-crawl origin/main`, from an anonymous HTTPS clone — see Blockers)
- [x] Script verified on origin/main: `scripts/enrich-wikipedia.mjs` exists (781 lines) with `crawl [limit]`, `merge`, and `report` subcommands; Hyderabad title-match rule (`pickArticle`: exact normalized base-name match, then geographic-parenthetical pass, fail-closed) and `isDoneRecord` logic (only `matched` / `no-article` / `title-mismatch` / `no-extract` / `too-far` count as done; `error` records are never done and are retried; torn lines are skipped in `readCache`) confirmed by reading the code
- [x] Tests verified: `node --test scripts/enrich-wikipedia.test.mjs` — 56 tests, 56 pass, 0 fail
- [x] Typecheck verified: `npx tsc --noEmit` — exit 0, no errors (run in the primary clone after `npm ci` from `package-lock.json`; no new dependencies added)
- [x] Place count confirmed: 124,690 places — `src/game/data/geonames/manifest.json` `meta.total` / `meta.keptRows` = 124,690, and the sum of `places` across the 64 chunk files in `src/game/data/geonames/chunks/` = 124,690
- [x] Crawl-eligible count (verified by executing `loadPlaces()`'s filtering logic): 124,312 — `loadPlaces()` excludes 93 curated notable places (`src/game/data/notable-notes.json`) and 285 places already carrying a `history` string (PR #30), with 0 overlap. A crawl on this clone would print `places to crawl: 124,312 (0 cached)`. 124,690 remains the dataset denominator.
- [x] Fresh-start decision (Liz, 2026-10-02): start the crawl from 0 on this VM and forget the old `gap-view-reveal` cache — the seed step is superseded, not pending.
- [x] **Crawl RUNNING** — PID 4724, started 2026-10-02 ~15:00 CDT, `node scripts/enrich-wikipedia.mjs crawl`, log at `.scratch/wikipedia-enrichment/crawl.log`. Startup line: `places to crawl: 124,312 (0 cached)`. First progress snapshot (15:10 CDT): 1,500+ places in ~9 min (~2.8/s), cache ~1,890 records and growing. Resumable: killing/restarting loses nothing — the JSONL cache is the resume point.
- [x] GitHub App connected (Liz, via Muse connector): OAuth authorized as `veeresh-bikkaneti`; Meridian read access verified via API (`get_file_contents` on `scripts/enrich-wikipedia.mjs`). Standing instruction (Liz, 2026-10-02): keep pushing progressively to the remote branch so a VM crash loses no work.
- [x] **`gh` CLI authenticated (Liz, device flow, 2026-10-02)** as `veeresh-bikkaneti` (scopes: repo, read:org, gist); `gh auth setup-git` done — plain `git push` now works from this VM.
- [x] **Branch PUSHED** to `origin/feat/wikipedia-crawl` (first push 2026-10-02 ~15:31 CDT, remote at `80f1faa`). Progressive pushes continue at milestones. No PR opened (Veeresh decides).
- [x] **CRAWL COMPLETE — 2026-10-03 ~09:55 CDT.** The final segment's log line: `crawl done: 2797 places`. Final `report` (verified first-hand by the parent agent): **124,312 unique cached IDs** (the full crawl-eligible set; 124,690 dataset denominator, 378 places excluded upstream as 93 notable + 285 already carrying history), **71,957 matched extracts**, **9,129 hook candidates**. Full breakdown: matched 71,957, title-mismatch 41,425, no-article 5,234, no-extract 5,696 (sums to 124,312). Cache: `.scratch/wikipedia-enrichment/crawl-cache.jsonl`, 36 MB, on this VM (gitignored by design — it was never committed; it lives in the worktree for the merge decision). The crawl process died and was restarted losslessly by the watch cron many times across 2026-10-02–03 (runtime/VM restarts); every restart resumed from the cache with zero data loss. No crawl process is running now — none is needed.

## Pending

- [x] Full coverage: 124,312 crawl-eligible places (124,690 dataset denominator) — **DONE, see above**
- [x] Final report (unique IDs / extracts / hook candidates) — **DONE: 124,312 / 71,957 / 9,129**
- [x] **MERGE RUN — 2026-10-03 ~20:45 CDT, on Liz's explicit directive** (superseding the delegation prompt's "merge is Veeresh's separate decision" hold: the decision was made on Veeresh/Chitti's side; only this VM holds the cache, so only this team could run it; Chitti's review gates + PR to main start from this push). Pre-merge `report` re-verified live: cached 124,312 {matched 71,957, title-mismatch 41,425, no-article 5,234, no-extract 5,696}, 9,129 hook candidates. `node scripts/enrich-wikipedia.mjs merge` → **8,579 places enriched**. Skipped: no-hook-pattern 62,712, title-mismatch 41,425, no-article 5,234, no-extract 5,696, too-long 325, banned-pattern invalids 339 total (population 169, people-count 134, census 14, measurement 12, elevation 6, ° 4), too-short 1. Changed files: exactly 65 — the 64 chunk JSONs + `manifest.json`, which now records `enrichment: {source: "Wikipedia article intros (CC BY-SA) via the MediaWiki API", historySentences: 8579, generated: "2026-10-04"}` (UTC date). Spot-check verified first-hand: Birmingham, Alabama (gn-4049979) carries the exact hook sentence + `wiki: "Birmingham,_Alabama"`. Gates after merge, all run first-hand: enrich tests **56/56**, `lint-cards` **GATE PASSED** (chunk audit: 124,690 records, 8,958 with hook, 115,732 hook-missing, **0 violations**), full `npm test` **515 pass / 0 fail**, `tsc --noEmit` clean. (8,958 with-hook = 8,579 new + 379 pre-existing hooks among the 378 crawl-excluded places — a 1-place category overlap, consistent with the merge skip-sum; no records corrupted, audit clean.)
- [ ] **Chitti's part (starts from the merge push):** review gates + PR from `feat/wikipedia-crawl` to main. Not opened by this team.
- [x] Push to `origin/feat/wikipedia-crawl` — **DONE** via `gh`-authenticated git push (see Done). Note: the crawl cache itself is gitignored by design and can never be committed — progressive pushes protected this status file throughout; the cache survived every VM replacement in `~/workspace` and was resumable.

## Blockers

1. ~~Seed cache absent~~ — **resolved by decision**: Liz directed a fresh start from 0 (2026-10-02); the old cache is forgone.
2. ~~Push path~~ — **resolved**: the GitHub App API path was approval-gated and its branch creation got a 403 (app installation lacks Meridian repo selection — that selection is still outstanding for the *connector*, but no longer needed for pushing). Liz instead authenticated the `gh` CLI (device flow), which is now the working push path.

## Guardrails honoured

- `merge` was NOT run during the crawl phase. It was run once, on 2026-10-03, only after Liz's explicit directive that the decision had been made and this push is what Chitti's review + PR start from. No PR opened by this team.
- No changes to `src/components`; the merge's writes are confined to `src/game/data/geonames/` chunks + manifest, produced by the repo's own verified pipeline script.
- The cache is append-only via the script; it was created by this fresh crawl run (not edited or compacted by hand).
- Only this file (`BRANCH_STATUS.md`) is staged/committed on this branch, by name — never `git add -A`, including while the crawl writes into the tree.
