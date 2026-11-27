# Branch status: feat/td-06.9-commitmiss-hardening

- Branch: `feat/td-06.9-commitmiss-hardening`
- Base: `origin/main` at `5364e57c` (TD-08.6 #628; includes the TD-06.9 squash 0b448dfa from #626)
- PR: draft (to be opened) — follow-up to #626, which merged WITHOUT the hardening below.

## Done

- One commit, cherry-picked cleanly from `00692cb3` (the hardening
  built on the #626 branch, verified there): `34f65489`
  `test(e2e): harden commitMiss with a geometrically proven miss point (TD-06.9)`.
  `tests/e2e/helpers.ts` only, +161/−5. No src changes.
- Design: `commitMiss` now taps the map corner farthest from the
  settled spot, at a screen distance the live map scale proves is
  beyond the largest radius the app can judge for the run
  (settle-wait + `__project` seam + app radius ceilings; legacy
  (500, 400) kept as the fallback; the 3-attempt advance-on-hit
  guard unchanged).

## Why

- Step 1 diagnosis (on the #626 branch): the two friend-challenge
  specs flake 2/10 on BOTH main and #626 in clean-room runs — a
  pre-existing test flake, not a #626 regression. No play-path
  cause reproduced in this VM. The hardening is deterministic by
  construction; green runs in this VM cannot prove the
  clean-room failure is cured. The reviewer's clean-room result
  is the arbiter.

## Verification on this branch

- Gates: tsc, lint:arch (104), lint:nav, shell-ban 4, entry
  311,042 B, game-app 6,397 at ceiling, unit 3469 pass / 0 fail,
  build:pages.
- Desktop set once (package-b:209, mc3-receive:364,
  mc3-verdict): 16 passed, 1 skipped, 0 failed, through the
  IPv4 proxy shim.
- Prior verification on the #626 branch (same code, base
  39634c16 + merge bbaaef47): desktop set x5 80/5/0;
  geodetective x5 79/90 with 11 pre-existing reload failures
  proven on the unhardened helper; full commitMiss sweep with
  24 persistent pre-existing VM failures, none implicating the
  new code (the hardening's own failure mode never fired).
