# BRANCH_STATUS — feat/crash-autosend

Zero-friction crash reporting: the watchdog auto-sends the boot_failure
report when the fallback shows (no tap), and prefetches the
observability endpoint at init so the report fires instantly.

## Done

- `scripts/crash-watchdog.mjs`
  - Endpoint resolution extracted to `getEndpoint(cb)` with a one-shot
    cache; prefetched at watchdog init (one tiny same-origin GET per page
    load, parallel with the 28 s boot timer).
  - `show()` auto-calls `send()` — the "Tell us what happened" button is
    gone; a single "Try again" button remains plus an
    "Anonymous crash report sent." confirmation appended once the POST
    completes.
  - Fail-closed preserved: no/invalid endpoint → no POST, no confirmation
    line, player never misled. No double-send (show() runs once per page
    via the existing ASKED guard).
  - Pre-merge review fixes: confirmation only on HTTP 2xx (a failed POST
    stays silent); `insertAdjacentHTML` instead of `innerHTML +=` so the
    "Try again" button keeps focus; prefetch-race test coverage.
  - Byte trims to hold the 5120 budget: `String.trim()` instead of the
    regex, `if (b)` for the content-type header.
- `scripts/crash-watchdog.test.mjs` — 32 tests: prefetch-at-init,
  auto-send-on-show, confirmation text, fail-closed silence; fake XHR now
  completes POSTs like a real browser.
- `tests/e2e/crash-watchdog.spec.ts` — scenario (a) updated: single
  "Try again" button, no tap, asserts the auto-POST + confirmation.

## Pending

- Owner review + merge (PR from `feat/crash-autosend`).
- Push needs a PAT handoff (this VM has no GitHub login).
- Still outstanding from the crash-reporter branch: the 2 CI lines in
  `.github/workflows/node.js.yml` (`npm run typecheck:worker`,
  `npm run test:worker`) — token lacked the workflow scope; add via
  GitHub UI.
- Deploy `workers/crash-report/` and set `observabilityEndpoint` in
  `public/flags.json` (reporting stays fail-closed until then).

## Verification (local, 2026-10-07)

- `npx tsc --noEmit` clean; `node scripts/lint-cards.mjs` GATE PASSED
- `npm test` green (837/837); watchdog unit tests 32/32
- `npm run build:pages` green; watchdog marker in `dist/client/_shell.html`
- Playwright `tests/e2e/crash-watchdog.spec.ts`: 4/4 passed
