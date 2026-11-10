# BRANCH_STATUS — feat/phase0-shell-split

**Branch:** `feat/phase0-shell-split`
**Synced:** `origin/main` at `b8ab5bfe` (docs #392) before slice 2
**Scope:** P2 — Phase 0 shell split. This slice is contract I1 only:
`src/subjects/registry.ts` discovers subject folders and lists `released: true`
modules. No behaviour change to the geography game. No educator sign-off.

## Done

- [x] Slice 0 — spec file `docs/scaling/phase0-shell-split-spec.md` (head `34297527`).
- [x] Slice 1 — pure helpers moved verbatim into `src/game/shell-helpers.ts`
      (head `2f0578e9`). Gates recorded in the spec slice log.
- [x] Slice 2 — contract I1 registry.
      - `selectReleased` keeps only `released === true`, `id` equal to the
        folder, a non-empty age-group list drawn from `7-10` / `10-18` / `18+`,
        a non-empty title, an array of units, and a `load` function.
      - `load()` is not called. One bad module does not blank the list.
      - Discovery is `import.meta.glob("./*/index.ts")` inside a function
        (same pattern as `src/lib/flag-registry.ts`). No `eager` flag.
      - `game-app.tsx` does not import the registry. No subject folder exists,
        so the live list is empty.
      - Load baseline recorded in the spec §1b (measured, not a wired CI gate).

## Gates for slice 2 (run in this worktree)

- [x] `npx tsc --noEmit` — PASS
- [x] `npm test` — PASS. Script suite 1,160 pass / 11 skipped / 0 fail.
      `src` suite 2,363 pass / 0 fail (includes 9 registry tests).
- [x] `npm run test:worker` — PASS (145)
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `VITE_KOFI_URL=https://ko-fi.com/thesaltandpepperguy npm run build:pages` — PASS
      (build id stamped `384ea735`, parent of this slice)
- [ ] Playwright — 24 pass / 1 fail, `--workers=1`, headless shell
      Chromium 156. The failure is
      `grownups-privacy-contact.desktop.spec.ts` full-stack contact
      (local Discord sink threw `Unexpected end of JSON input`; the
      screenshot is still Home). That spec is not an owned file. Home,
      hydration, and GeoDetective boot passed. Full `tests/e2e/` was NOT RUN.
- [x] Screen recording — built app, phone viewport. Splash, then a Globe
      round ("Chai Wan Estate, Eastern District, Hong Kong") with the map
      canvas up. No page errors. Not committed: the mp4 is outside the
      owned paths. Integrator can add a home for it if the PR should
      carry the file.

## Open (rest of the shell split)

- [ ] Wire the shell so a chosen subject loads its own chunk. three.js still
      loads on the Easy globe path today (`three.module` 166,063 B gzip,
      requested during the measured journey). The registry does not import it.
- [ ] Storage helpers, prefetch helpers, per-game screen components.
- [ ] `Question` / `Result` in use for geography.
- [ ] Thin progression contract.
- [ ] Import-boundary test for the shell (the registry source pin is only I1).
- [ ] CI load gate. Budgets are recorded; workflow files are not owned.
- [ ] Science simulation spike.
- [ ] ADR, versioned shell contract, one-app tripwire.
- [ ] Full E2E before/after. Panel review. No educator sign-off.

## Open owner questions (not settled here)

- P8 gate names v3 but the keeper is v4.
- Q14 lazy-load guardrail and Q15 passport have no written owner answer.
- Q4, Q5, Q11, Q13 open; Q6 home order is P1's mockup, not this branch.
- Constitution rules 1 and 3, and rule 2 for the new registry file, are
  recorded in the spec. Not a Chair-lift.

## Integrator

- Do not edit `BRANCH_STATUS.md` at the repo root for this stream; status
  lives in this file.
- A `contracts.local.ts` copy was not added. I1 types are exported from
  `src/subjects/registry.ts`. Other streams keep their own local copies
  until this lands on main.
- CI workflow files were not edited. Starting budget to wire later:
  initial entry JS gzip ≤ 323,865 B (zlib level 9), measured §1b.
- Screen recording is not committed (path is outside the owned file list).
