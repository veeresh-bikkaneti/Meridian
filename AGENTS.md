# AGENTS.md — Meridian

Geography quiz game (Vite + React + TypeScript). Guess places on a satellite
map; every reveal shows a kid-friendly story card.

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
- Do not touch `.scratch/` (gitignored crawl cache) or other branches' worktrees.
