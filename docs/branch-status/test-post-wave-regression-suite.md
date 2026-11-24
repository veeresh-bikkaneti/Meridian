# Branch status — test/post-wave-regression-suite

**Job:** a clean, fast, repeatable post-wave regression profile. After a
wave merges, one command runs the targeted gates and suites that cover
the wave landings and prints a suite-by-suite table, so the next agent
does not have to reconstruct the command list from AGENTS.md and the CI
workflow by hand.

## What landed

- `scripts/test-regression-wave.mjs` — the runner (node builtins only,
  no new dependency). Process execution is injected, so the runner's
  own unit test stubs every child process.
- `scripts/test-regression-wave.test.mjs` — 14 unit tests pinning arg
  parsing, the ratchet verdicts, the table shape, the Playwright lone
  re-run rule, and the exit code. Run with
  `node --test scripts/test-regression-wave.test.mjs`.
- `package.json` — one new script, `test:regression:wave`.
  `package-lock.json` untouched.

## How to run

```sh
npm ci
npm run test:regression:wave
```

On this VM, use the hermetic e2e recipe (docs/e2e-hermetic.md): pin
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` to the cached Chromium, set
`VITE_KOFI_URL` in the environment, and hold `flock ~/workspace/.e2e.lock`
around the run so no second suite shares the machine.

## What it covers

Core gates: `npx tsc --noEmit`, `npm run lint:arch`, `npm run lint:nav`,
`npm run check:provenance`, `node scripts/lint-cards.mjs`,
`npm run build:pages`, `npm run check:entry-size`.

Ratchets are checked against the baseline counts, not just exit codes:
`noRawIo` <= 13 and `noUpwardImport` <= 129 (eslint/layer-baseline.json),
shell-ban <= 14 (eslint/shell-ban-baseline.json), entry JS gzip
<= 323,865 B with the exact byte count printed.

Contract suites: platform transport, storage, and voice contracts, plus
the home-globe contract. Wave-1 / board units: credits, and the kanban
board data + live suites.

Playwright smoke: the `kanban` project plus the Holmes/Watson smoke set
from AGENTS.md "Testing on a budget" (`detective-owner-spec`,
`detective-selection-read` , `detective-tapmode-selection`,
`detective-watson-walk`), `--workers=1`. A failed spec is re-run once,
alone; it counts as a regression only if the lone re-run fails too
(AGENTS.md section 9). If no Chromium is installed the row prints
NOT RUN with the reason — that is the only NOT RUN a green run may
contain. Exit code is 0 only when every other row is PASS.

## What it deliberately does not cover

- The full Playwright suite (267 specs). CI carries it; this profile is
  the targeted post-wave check, per "Testing on a budget".
- No spec is opened through a query-param shortcut, ever.
- No CI wiring: `.github/workflows/node.js.yml` keeps its own e2e list.
  Hooking this profile into CI is a follow-up, not this branch.
- No production code: zero `src/**` edits, so the entry bundle cannot
  grow from this branch (0 B delta by construction, verified by the
  entry-size row of the run below).
- No viewport captures: there is no product UI change.

## Results of the builder's run

Run on this branch in a clean worktree after `npm ci`, under the
hermetic recipe (pinned cached Chromium, `VITE_KOFI_URL` set, e2e lock
held). One run, no retries needed:

- Core gates: typecheck PASS; lint:arch PASS (noRawIo 13 <= 13,
  noUpwardImport 129 <= 129); lint:nav PASS (shell-ban 14 <= 14);
  provenance PASS; card lint PASS; build:pages PASS.
- Entry size PASS: entry JS gzip 323,460 B against the 323,865 B
  limit. This branch edits no `src/**` file and no build input, so the
  entry delta attributable to the branch is 0 B.
- Contract suites: transport, storage, voice, globe — all PASS.
- Wave-1 / board units: credits, kanban data + live — PASS.
- Playwright smoke (kanban + the four detective projects): PASS,
  projects green, no lone re-run needed.
- Runner unit test: 14/14 PASS.
- Profile total: 14/14 PASS, exit 0. The Playwright smoke is the long
  pole on this machine (the full profile took about 14 minutes here,
  most of it the five browser projects at `--workers=1`).

## Graph

This branch adds no knowledge-graph edges and changes none: it adds a
test runner and its documentation only, touching no game, subject, or
platform module. `docs/knowledge/graph.json` is integrator-owned and is
not modified here.
