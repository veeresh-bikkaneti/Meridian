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

## Pending

- [ ] Cache seeded from gap-view-reveal worktree — **PENDING, 0 entries seeded (not 15,156)**. The source cache at `~/workspace/meridian-worktrees/gap-view-reveal/.scratch/wikipedia-enrichment/crawl-cache.jsonl` is not present on this VM; no `crawl-cache.jsonl` exists anywhere on this VM (searched home + `/tmp` on 2026-10-02). See Blockers.
- [ ] Crawl running — **NOT started** (no PID, no start time). Deliberately not started: starting fresh from 0 would duplicate the ~15,156 places already crawled elsewhere and could conflict with seeding the real cache later. That decision belongs to Veeresh.
- [ ] Full 124,690-place coverage
- [ ] Final report (unique IDs / extracts / hook candidates) — no report numbers yet: cache is empty on this VM (0 unique cached IDs, 0 matched extracts, 0 hook candidates locally)
- [ ] Push to `origin/feat/wikipedia-crawl` — **PENDING auth**. See Blockers.

## Blockers

1. **Seed cache absent on this VM.** The delegation prompt states a cache with 15,156 unique entries exists in a `gap-view-reveal` worktree; that worktree and file do not exist on this machine. The crawl must not be started from scratch until Veeresh decides: supply/copy the real cache, or explicitly approve a fresh start.
2. **No GitHub push auth on this VM.** `gh auth status` = "You are not logged into any GitHub hosts", no `GH_`/`GITHUB` token environment variables, no `~/.config/gh`. The repo was cloned anonymously over HTTPS (readable), but pushing will fail until auth is provided by Veeresh. No PAT was requested or invented.

## Guardrails honoured

- `merge` was NOT run. No PR opened.
- No changes to `src/components` or `src/game`.
- No cache file created, edited, or compacted; no crawl started.
- Only this file (`BRANCH_STATUS.md`) is staged/committed on this branch, by name — never `git add -A`.
