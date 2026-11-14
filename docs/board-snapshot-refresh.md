# Board snapshot refresh

`src/board/snapshot.json` is the /board page's fallback data. Most of it
is hand-written; two fields are mechanical and are refreshed by
`scripts/board/refresh-snapshot.mjs`.

## What it refreshes

- `main` — set to `git rev-parse --short=8 origin/main` (8 characters,
  matching the existing value's style).
- `asOf` — regenerated as
  `Read from the repo <Mon D, YYYY, h:MM AM/PM Central>`, formatted in
  America/Chicago.

It also validates the hand-curated story `prs` lists against the public
GitHub pulls API: every referenced PR number must exist in the API
payload. The validation result (open / merged / closed-unmerged counts
for the referenced PRs) is printed, but no PR data is written.

## What it never touches

`next[]`, the lanes and their notes, and every story field — `title`,
`status`, `waitsOn` prose, `waitsOnIds`, `owner`, `prs`, `inferred` —
plus `donePath`. PR associations are hand-curated: the script never
adds, drops or rewrites one. The file is re-serialized as 2-space JSON
(the file's existing formatting), so a refresh diff shows only the
`asOf` and `main` lines.

## How to run

```sh
git fetch origin
node scripts/board/refresh-snapshot.mjs
```

Run from the repo root. The script reads local git state only — it
never fetches — so the `git fetch origin` step matters: without a local
`origin/main` it fails instead of guessing. It uses the unauthenticated
public GitHub API only; there are no tokens or secrets involved.

## Fail-loud behaviour

Any problem stops the run before anything is written: a malformed
snapshot, duplicate story ids, a `waitsOnIds` entry that is not an
existing story id or that disagrees with the PR-naming rule the board
tests use, a non-positive-integer `prs` entry, a referenced PR missing
from the GitHub payload, an unreachable / 403 / 429 GitHub API, or a
missing local `origin/main`. The problem is printed to stderr and the
exit code is non-zero. On success the write is atomic
(`snapshot.json.tmp` in the same directory, renamed over
`snapshot.json`), and a short summary is printed: old → new `main`,
the new `asOf`, the story count, and how many referenced PRs were
verified, split by live state.
