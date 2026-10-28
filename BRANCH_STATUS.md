# BRANCH_STATUS — chore/flip-friend-challenges

- **Branch:** `chore/flip-friend-challenges`
- **Base:** `origin/main` at `f531c7e` (2026-10-28 — PR #278 pre-flip hardening merged)
- **State:** FLIP — gates green locally (below); merge waits on CI green on the exact tip plus a fresh check read immediately before merging, under the owner's conditional authorization (2026-10-28, as relayed): "Finish it: cure the wrap, re-vote, merge, flip, verify live". Live verification on both hosts follows the merge.
- **Task:** Turn friend challenges ON in production. PR #274 shipped the feature behind `friendChallenges` (shipped off); PR #278 landed the pre-flip hardening — share-failure fallbacks that wrap at phone width, the notice×resume E2E pin, the seed readback — and the panel's round-2 re-vote on its cured tip returned READY (14/14 seats, 0 standing BLOCKs; the one procedural BLOCK, an unrelated e2e failure on the first CI run of the final tip, was adjudicated a runner flake when the re-run of the unchanged tip went green). #278 merged as `f531c7e`. This PR is the flip itself.
- **Tier:** 0 — config + docs (AGENTS.md tier table). The flip is the owner's explicit order; no code changes.

---

## 1. What this branch changes

1. **`public/flags.json` — one value:** `"friendChallenges": false` → `true`.
   This is the shipped value players' apps read at boot. The code default in
   `src/lib/flags.ts` (`FLAG_DEFAULTS`) deliberately stays `false`: a client
   that cannot load `flags.json` fails closed with the feature off, exactly
   as before the flip.
2. **`docs/feature-flags.md` — wording the flip makes false, corrected:**
   the graduated-flags note now lists `friendChallenges` as shipped ON
   (2026-10-28, after PR #278), and the challenge-links paragraph no longer
   calls flag-off "the shipped default, in both `FLAG_DEFAULTS` and
   `public/flags.json`" — it is the code default only now. The catalog
   table's Default column is unchanged (it records `FLAG_DEFAULTS`).
3. **This file** — the branch record, per convention.

Nothing else: no source, no tests, no worker, no build config.

## 2. Gates + merge record

- Environment: Node v24.22.1 local (CI 22.x is canonical); Playwright bundled
  chromium-1243; E2E sequential under `flock ~/workspace/.e2e.lock`.
- Local gates on this branch (logs: `~/workspace/meridian-flip-reports/gates-flip.log`,
  `e2e-flip.log`):
  - `npx tsc --noEmit` — PASS (clean).
  - `npm test` — PASS: scripts 850 pass / 11 skipped (of 861); src 1753 pass / 0 fail.
  - `npm run test:worker` — PASS: 85/85.
  - `node scripts/lint-cards.mjs` — PASS: GATE PASSED.
  - `npm run build:pages` — PASS.
  - Playwright E2E, touched surface — friend-challenge spec: **12/12 PASS** on the flipped build.
- CI on the exact tip + the fresh pre-merge check read: recorded in the PR
  body and in `~/workspace/meridian-flip-reports/FLIP-REPORT.md`.
- Post-merge live verification: poll `flags.json` and `build-meta.json` on
  both hosts — `https://meridian.knowledgetest.workers.dev` and
  `https://veeresh-bikkaneti.github.io/Meridian` — until
  `friendChallenges: true` and buildId equals this PR's merge SHA.
