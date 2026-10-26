# BRANCH_STATUS — feat/213-headers-simulation

**State: in progress (Coordinator B, SecOps & DevOps cluster, 2026-10-26). Owner merges only — do not merge.**
Base: `origin/main dbb83a3` (#225).

## What this branch does (#213)

Until now the only guard on `public/_headers` was a live post-merge
probe, plus literal pins that key rules by pattern and cannot prove
what a browser actually receives. This branch adds a parse-and-simulate
pin to `scripts/security-headers.test.mjs`:

- An order-preserving parser + a simulator of Cloudflare's documented
  semantics (every matching rule applies, in file order; detachments
  before sets within a rule; first set replaces, later sets append).
- Pins the single effective `Cache-Control` for every path class:
  hashed `/assets/*` = immutable; the 3 carved files = one
  `public, max-age=0, must-revalidate` value (the detach+set proof —
  a missing detach would comma-join and fail); `/sw.js`, `/flags.json`,
  `/build-meta.json`, `/manifest.webmanifest` = `no-cache`; `/` and
  `/index.html` = the `s-maxage=60` value; `/offline`, `/offline.html`,
  `/_shell.html` = the revalidate value; and **no rule at all** for
  `/audio/*` and other unlisted paths (they take the platform default
  and must never become immutable).
- Note vs the issue text: the unioned file's values win — `/flags.json`
  is `no-cache` (not the pre-union revalidate line) and `/` carries
  `s-maxage=60`; the pins follow the file on main.
- Docs: the `/_shell.html` Acceptance wording is now conjunctive and
  lives in the `_headers` comment itself (404 AND no ETag AND no
  CF-Cache-Status = expected-inert; an asset-served header-less 200 =
  FAIL) — the old pointer to an Acceptance definition in
  BRANCH_STATUS.md dangled. `docs/security-headers.md` gains the
  missing `/offline*` / `/_shell.html` and no-rule rows.

## Files

- `scripts/security-headers.test.mjs`
- `public/_headers` (comment only — no rule changes)
- `docs/security-headers.md`
- `BRANCH_STATUS.md` (this file)

## Gates

- `node --test scripts/security-headers.test.mjs` — 9/9 pass.
- Mutation check: deleting a detach line turns the suite red (2 fails);
  restored, green again.
- Full gates recorded in the PR / coordinator report.

## Pending

- Panel re-vote on the final tip, then the owner's merge call.
