**State: re-gating 2026-10-23 after a sixth rebase (below); awaiting push via the owner route, then the owner's merge word. Only the owner merges.**
Base: `origin/main d03ba4cd` (after the PR #222, #226, #212, #229, #230, #232, #235, #219, #225 and #238 merges).
Rebases: onto `76630ba`, `62b960a`, `d77ee52` (2026-10-22), then `55ff0b50` (2026-10-23, ×4), then `dbb83a3b` (2026-10-23, ×5), then `d03ba4cd` (2026-10-23, ×6 after #238); the
only conflict each time was this file, resolved by keeping this
branch's own record (the repo pattern). Feature code is byte-identical
to the pre-rebase tip `b55f859`. The #230 merge (server-side HTML
Cache-Control) and the #232 merge (root wrangler.jsonc + Cloudflare
Vite plugin) pass through untouched — this branch does not touch
their files. One real conflict on the 4th rebase: patch 0005's
3-line CSS/class hunks (WI-9 audit gaps) needed manual application
against the moved context; the applied content is byte-identical to
the branch's own tip (verified by content). The 5th rebase needed
no hand-application: commits 1–4 replayed clean and the audit-gap
commit's feature hunks applied cleanly; only this file conflicted.
Full write-up: `docs/reviews/2026-10-21-wave2-kid-ux-shell.md`
(2026-10-22 rebase addendum at the end).
## Commits (post-rebase SHAs, base dbb83a3b)
- `1555f6b` WI-11: honest map wording
- `5bfc8de` WI-10: top nav honesty
- `db1f15d` WI-9: bubble clearance + readability floors
- `ed29de8` WI-8: Back/history + the three new e2e specs
- `59975cd` WI-9 audit gaps: 16px + 44px floors
- (docs tip) review doc + this file
## Gates (rebased head on d03ba4cd, re-run 2026-10-23, ×6)

- `npx tsc --noEmit` — clean
- `npm test` — scripts 825 pass / 0 fail / 9 skip; src 1486 pass /
  0 fail (includes the 7 new screen-history tests)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green; `dist/client/_headers` byte-identical
  to `public/_headers` (this branch does not touch headers)
- Playwright (new specs): wave2-history 1/2 in batch (one flake —
  see below; passes standalone), wave2-nav 1/1, wave2-readability
  6/6 — including @1280px (bubble overlap 0px² at 320/375/768/1280).
  Effective 9/9.
- Batch-contention flake (adjudicated, 3rd): wave2-history
  "Back walks picker drill-down" failed in the parallel batch on
  clicking the "Next place →" button (183 retries, never a
  behavior violation); the identical case passes standalone (1/1,
  1.3m). Same sandbox-instability signature as the two earlier
  adjudicated flakes.

## Gates (rebased head on d77ee52, re-run 2026-10-22)
- `npm test` — scripts 809 pass / 0 fail / 9 skip; src 1486 pass /
  0 fail (main grew by 6 with #230's header tests; includes the 7
  new screen-history tests)
- `npm run build:pages` — green; `dist/client/_headers` byte-identical
  to `public/_headers` (this branch does not touch headers)
- Playwright (new specs): wave2-history 2/2, wave2-nav 1/1,
  wave2-readability 6/6 — 9/9 on this run, including @1280px
  (bubble overlap 0px² at 320/375/768/1280; the @1280px timing
  race documented in Addendum 3)
- `mobile-home-overlap` standalone adjudication (on the `62b960a`
  rebase, carried over — code byte-identical since): branch 20F/4P
  vs unmodified main 20F/4P, identical error classes
  count-for-count → pre-existing sandbox flake, NOT a regression

- `npx tsc --noEmit` — clean
- `npm test` — scripts 808 pass / 0 fail / 9 skip; src 1480 pass /
  0 fail (includes the 7 new screen-history tests)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green; `dist/client/_headers` byte-identical
  to `public/_headers` (this branch does not touch headers)
- Playwright (new specs): wave2-history 2/2, wave2-nav 1/1,
  wave2-readability 6/6 (bubble overlap 0px² at 320/375/768/1280)
- `mobile-home-overlap` standalone adjudication (on the `76630ba`
  rebase, carried over — code byte-identical since): branch 20F/4P
  vs unmodified main 20F/4P, identical error classes
  count-for-count → pre-existing sandbox flake, NOT a regression

- `npx tsc --noEmit` — clean
- `npm test` — scripts 808 pass / 0 fail / 9 skip; src 1480 pass /
  0 fail (includes the 7 new screen-history tests)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green; `dist/client/_headers` byte-identical
  to `public/_headers` (this branch does not touch headers)
- Playwright (new specs): wave2-history 2/2, wave2-nav 1/1,
  wave2-readability 6/6 (bubble overlap 0px² at 320/375/768/1280)
- Playwright (neighboring regression batch: home visual layout,
  visual baselines, dismiss-overlap, storyteller audible + home,
  home badges/read-aloud, mobile-home-overlap) — 52 passed /
  9 skipped / 0 failed
- `mobile-home-overlap` standalone re-run: 20 failed / 4 passed —
  **adjudicated pre-existing**: the identical standalone run on
  unmodified main `76630ba` fails 20/4 with the identical error
  classes, count-for-count (8× element-not-visible, 8× element not
  found, 4× strip geometry, 4× the known "Take the tour"
  strict-mode duplication). Sandbox browser instability, not a
  branch regression; the same spec passed inside the parallel
  batch above, as it did pre-rebase.
- Result/story card content (Branch 4). Security headers (shipped
  separately as PR #212, merged 2026-10-22).
