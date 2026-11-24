# Branch status — test/td-14.3-e2e-registration-guard

## Capsule

Outcome: unblocked. `playwright.config.ts` now has a
`subject-case-navigation` project (`testMatch` for that spec,
1440×900), next to the other subject projects. The live tree
passes the registration guard. The planted-dummy and stale-exception
cases still pass. CI's file allowlist was not widened.

Base: origin/main `7dbf62eb3be0976856f174f0725874e03abbaede`
(handoff tip was `72b9fa0325569c91df0f8eb27ff885e30cd315dd`; main
moved by #582). Story TD-14.3, issue #375.

## Census (measured after the project was added)

| | |
| --- | --- |
| Spec files under `tests/e2e/**/*.spec.ts` | 267 |
| Match at least one live project | 265 |
| Deliberate exceptions | 2 |
| Unregistered, not excepted | 0 |

The 2026-11-09 census (165 of 167) has drifted. The two deliberate
exceptions are still the only ones kept:

- `qa-evidence.spec.ts` — no project; run from a temp config.
- `mode-screens-shots.spec.ts` — env-gated (`MODE_SHOTS=1`).

`tests/e2e/subject-case-navigation.spec.ts` now matches the new
project. It was not added to the exception list.
