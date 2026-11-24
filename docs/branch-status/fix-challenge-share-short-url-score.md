# Branch status — fix/challenge-share-short-url-score

**Task:** Issue #590, AC1 only. Native share was sending the challenge (and session) link twice: `shareScore` passed both `text` and `url` to `navigator.share`, and every challenge/session text already ends with the same URL. WhatsApp, Messages, and the Android share sheet then append `url` after `text`. This branch omits `url` from the native payload when `text` already contains it. Draft PR only — the owner merges.

**What changed:**

- `src/game/share-action.ts` — `shareScore` now calls `navigator.share({ title, text })` when `input.text` already contains `input.url`, and still passes `url` when it does not. The clipboard fallback is unchanged: it still writes `text` only.
- `src/game/share-action.test.ts` — stubs `navigator.share` and pins the two payloads, plus the existing clipboard-once and `AbortError` → `cancelled` cases.
- No changes to `game-app.tsx`, `run-summary.tsx`, the text builders, `worker/**`, or `wrangler.jsonc`. AC2 (human-readable short URL) and AC3 (challenger score on a fresh-route share) stay open on #590, pending owner rulings.

**Gates (run in this worktree, on this tip):** recorded in the pull request body.

**Next step:** draft pull request is open for review; the owner merges.

**Open questions:** none on AC1. AC2 and AC3 remain owner decisions on #590 and are out of scope here.

**Ruled out:**

- A `/c/<id>` short-link worker or KV route (AC2). Manifest §6.2 already rejected readable-URL schemes; this needs a separate owner ruling.
- Hooking a score into fresh-route share text (AC3). A "New route" share is a route the player has not played (`winner = 0`), so there is no score to show unless the copy itself changes.

## Graph

- No graph nodes or edges added or changed. This is a payload-shape fix in the existing `shareScore` helper.
