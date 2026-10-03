# feat/wikipedia-crawl — status

Base: `origin/main` at `7593a87288727ce3930c336db7c6ddb31c697718`
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

## Pending

- [ ] Full coverage: 124,312 crawl-eligible places (124,690 dataset denominator)
- [ ] Final report (unique IDs / extracts / hook candidates) — from `node scripts/enrich-wikipedia.mjs report` when the crawl completes
- [x] Push to `origin/feat/wikipedia-crawl` — **DONE** via `gh`-authenticated git push (see Done). Note: the crawl cache itself is gitignored by design and can never be committed — progressive pushes protect this status file and any script work; the cache survives VM replacement in `~/workspace` and is resumable. Latest crawl snapshot (2026-10-03 04:37 CDT): process RUNNING — PID 2132 (verified via ps after restart this run; previous process was dead — confirmed by ps showing no node process). Restarted losslessly: log shows `places to crawl: 48,604 (75,708 cached)`. `report` — unique non-error IDs 75,773 / 124,312, matched extracts 44,583, hook candidates 4,811; breakdown: matched 44,583, title-mismatch 23,479, no-article 3,606, no-extract 4,105.

## Blockers

1. ~~Seed cache absent~~ — **resolved by decision**: Liz directed a fresh start from 0 (2026-10-02); the old cache is forgone.
2. ~~Push path~~ — **resolved**: the GitHub App API path was approval-gated and its branch creation got a 403 (app installation lacks Meridian repo selection — that selection is still outstanding for the *connector*, but no longer needed for pushing). Liz instead authenticated the `gh` CLI (device flow), which is now the working push path.

## Guardrails honoured

- `merge` was NOT run. No PR opened.
- No changes to `src/components` or `src/game`.
- The cache is append-only via the script; it was created by this fresh crawl run (not edited or compacted by hand).
- Only this file (`BRANCH_STATUS.md`) is staged/committed on this branch, by name — never `git add -A`, including while the crawl writes into the tree.
