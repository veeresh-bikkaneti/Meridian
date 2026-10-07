# BRANCH_STATUS.md — feat/crash-reporter

## Active work
Crash reporter for Meridian (older devices: "won't even load"). Extends the
existing observability pipeline (`src/lib/observability.ts`,
`src/game/clean-exit.ts`) — no parallel pipeline. Transport stays dormant
until the repo owner deploys the Worker and sets `observabilityEndpoint` in
`public/flags.json` (fail-closed by design).

## Done
- [x] WS1 senior-dev: `scripts/crash-watchdog.mjs` (ES5-only logic against
      injected host + `renderCrashWatchdogScript()` from function sources —
      no drift), `scripts/crash-watchdog.test.mjs` (30/30 node:test:
      ES5-only output, marker, ≤5120 bytes, try/catch, behavior via fake
      host), `scripts/crash-watchdog-plugin.mjs` (injects before `</body>`
      in `_shell.html`, fail-closed marker assertion on GITHUB_PAGES=1),
      registered in `vite.config.ts` after `tanstackStart()`.
      Watchdog: 28s timer, fires only when readyState complete + tab
      visible + `window.__meridian_ready` unset + no build-staleness
      refresh UI + not asked this session. Fallback UI: "The game couldn't
      start on this phone.", Try again FIRST, then "Tell us what happened —
      it helps fix phones like yours.", warm thanks after tap, dedupe via
      `meridian.crashwatchdogAsked`, Reload + `?nosw=1` links, WebGL-less
      variant copy, inline CSS, role=alert, focus to heading, focus rings,
      ≥4.5:1 contrast, prefers-reduced-motion honored. Endpoint read at
      RUNTIME from flags.json (`new URL("flags.json", document.baseURI)`,
      no-store); zero network until tap; XHR only.
- [x] WS2 frontend: `window.__meridian_ready=true` via rAF after first
      paint, exactly once (ref guard), next to `recordMilestone("boot_ready")`
      in `src/components/game-app.tsx`; `"boot_failure"` added to
      `ObservabilityEventType` in `src/lib/observability.ts`. Diff kept
      minimal (38 insertions).
- [x] WS3 devops: `workers/crash-report/` (new dir; root tsc ignores it):
      `src/index.ts` (POST-only ingest, 8KB cap, schema validation incl.
      `boot_failure`, per-IP 10req/60s rate limit, forwards to Discord
      webhook and/or Resend via `wrangler secret put`, 200 no-op with no
      secrets, never 500s, no PII in logs), `wrangler.toml` (no secrets),
      `tsconfig.json`, `package.json` (pinned, NOT installed), `README.md`
      (deploy, secrets, go-live step, alerting). 16/16 smoke tests pass.
- [x] WS4 QA: `tests/e2e/crash-watchdog.spec.ts` (4/4 pass) + `crash-watchdog`
      project in `playwright.config.ts`. (a) blocked chunks → fallback UI +
      one `boot_failure` POST; (b) getContext→null → WebGL message;
      (c) stale build → refresh UI wins, watchdog stands down, zero POSTs;
      (d) seeded kill → exactly one `suspected_crash`, no double-report.
- [x] Real bug found by e2e and fixed: the staleness stand-down check read
      `body.textContent`, which includes the watchdog's own inline source
      containing the seam string — it self-matched and stood down on every
      boot. Fixed to `innerText` (excludes script/style) with a
      null/undefined-only `textContent` fallback (`||` re-broke it: blocked
      boot has `innerText === ""`). Two regression unit tests added.
- [x] Gates: `npx tsc --noEmit` clean; `node --test
      scripts/crash-watchdog.test.mjs` 30/30; observability unit 15/15;
      eslint 0 errors on touched files; `npm run build:pages` green;
      marker + build-id script verified in `dist/client/_shell.html`
      (watchdog 5044/5120 bytes, before `</body>`, after build-id;
      `meridian-nosw-hatch` still present — existing behavior intact).

## Pending
- [ ] Repo owner: deploy Worker (`npx wrangler deploy` from
      `workers/crash-report/`), `wrangler secret put` DISCORD_WEBHOOK_URL /
      RESEND_API_KEY / REPORT_EMAIL, then add the Worker URL as top-level
      `observabilityEndpoint` in `public/flags.json` (flags-only redeploy).
      Do NOT commit secrets or the endpoint URL to the repo.
- [ ] Repo owner: final review + merge (PR not created — no auth here).
- [ ] Follow-up (separate): lite mode for ≤2GB devices (DPR cap, lower
      maxZoom, or static-image map) — reporting identifies them; only
      degradation keeps them playing. Watch the ~5118-byte watchdog budget.

## Known limits (documented, by design)
- A device that never boots can never report; OS tab kills, GPU
  context-loss hangs, and main-thread ANRs are invisible to the watchdog.
- The openRun chunk-failure catch (`game-app.tsx`) emits no event — the
  failure itself is invisible to the pipeline this boot (only the later
  kill's `suspected_crash` would carry the trail).
- Watchdog byte budget is tight (5044/5120); future additions need golfing.
