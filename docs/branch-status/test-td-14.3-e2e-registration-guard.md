# Branch status — test/td-14.3-e2e-registration-guard

## Capsule

Outcome: blocked. The registration guard is in
(`scripts/check-e2e-registration.mjs`) and the planted-dummy and
stale-exception cases pass. The live tree does not pass.

Done condition not met: the unit test that the current tree passes
is red. One spec matches no project and is not a deliberate
exception. `playwright.config.ts` was not edited (this lane does
not own it; widening a project to hide the miss was refused).

Base: origin/main `7dbf62eb3be0976856f174f0725874e03abbaede`
(handoff tip was `72b9fa0325569c91df0f8eb27ff885e30cd315dd`; main
moved by #582). Story TD-14.3, issue #375.

## Census (measured on this base)

| | |
| --- | --- |
| Spec files under `tests/e2e/**/*.spec.ts` | 267 |
| Match at least one live project | 264 |
| Deliberate exceptions | 2 |
| Unregistered, not excepted | 1 |

The 2026-11-09 census (165 of 167) has drifted. The two deliberate
exceptions are still the only ones kept:

- `qa-evidence.spec.ts` — no project; run from a temp config.
- `mode-screens-shots.spec.ts` — env-gated (`MODE_SHOTS=1`).

Unregistered: `tests/e2e/subject-case-navigation.spec.ts`. It is a
real navigation spec (not env-gated, not a temp-config run). A
later status note already recorded that it matches no project.
The guard names it and fails. It was not added to the exception
list and was not deleted.

## Smallest next step

A change that owns `playwright.config.ts` registers
`subject-case-navigation.spec.ts` (its own project, or a filename
that an existing `testMatch` already covers). Then the live-tree
test goes green. Do not add the file to `DELIBERATE_EXCEPTIONS`.
