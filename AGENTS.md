# AGENTS.md — Meridian

Geography quiz game (Vite + React + TypeScript). Guess places on a satellite
map; every reveal shows a kid-friendly story card.

## Constitution (standing rules for every agent — Veeresh, 2026-10-21)

1. **Do not refactor existing working code.**
2. **Do not create new branches or duplicate files.** Work on the branch you
   were assigned (or the one already checked out) and edit existing files in
   place. `main` stays protected, so the work still ships as a PR from that
   one branch.
3. **Edit only the targeted functions, in place.** Touch nothing outside the
   function or block the task names.
4. **Output only unified git diffs** when showing code changes — no whole-file
   rewrites, no pasted full files.

If a task cannot be done within these rules, stop and ask first.

## Agent council — match the process to the task

Routine work does not convene a council.

| Tier | Scope | Process |
| :--- | :--- | :--- |
| **0 — Direct** | Docs, `BRANCH_STATUS.md`, copy, config, a typo | Make the change, run the gates. |
| **1 — Solo TDD** | One bug, one function, a clear repro | Failing test first, then the minimal fix. |
| **2 — Council** | New feature or module, 3+ files, API/storage/schema, anything under `src/game/data/`, security or privacy | Full protocol: `docs/ops/agent-council-protocol.md` |

Unsure which tier → Tier 2. An owner-set tier overrides this table.

**Tier 2 in one line:** no implementation code until a signed Consensus
Manifest exists (ATDD scenarios → TDD contracts → adversarial challenge →
Chair sign-off), then RED, minimal GREEN, gates, unified diff.

## Quality gates (all mandatory for a PR)

- `npx tsc --noEmit` — clean
- `npm test` — full unit suite green
- `node scripts/lint-cards.mjs` — the prebuild card gate; must print GATE PASSED
- `npm run build:pages` — production build green
- Playwright E2E — `tests/e2e/` specs run against the built artifact via
  `serveBuiltArtifact` (serves on `127.0.0.1:4123/Meridian/`)

## Card content rules (Veeresh's standing principles)

1. **History first, modern identity second** — the story leads with the
   memorable hook/history, plain geography follows.
2. Plain-spoken geography kids can picture — never elevation or coordinates.
3. One memorable hook per card (person, quote, event, record).
4. Short, story-like; stats only when they teach.
5. **No fabrication, ever** — no LLM near place data. `history`/`fact` fields
   must come from curated notes or the verified pipeline.

## Working conventions

- `main` is protected: feature branch → PR → merge. `gh` CLI is authenticated.
- **Stage named files only, never `git add -A`.**
- **Push early and often** — the VM is not durable storage for unpushed work.
- Every feature branch carries `BRANCH_STATUS.md` at the repo root tracking
  done vs pending; update and push it with the work.
- **A merged branch is deleted, not left behind.** Cleanup is part of the task,
  not a follow-up someone has to ask for. Keep *Settings -> General -> Pull
  Requests -> Automatically delete head branches* switched on so this happens
  with nobody's attention. An agent in the cloud container cannot do it by hand
  — the proxy refuses ref deletion with HTTP 403 — so it names the leftover
  branch in its final report rather than going quiet.
- Do not touch `.scratch/` (gitignored crawl cache) or other branches' worktrees.
