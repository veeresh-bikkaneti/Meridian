# BRANCH_STATUS — test/stub-crash-report-in-e2e (PR #320)

- **Branch:** `test/stub-crash-report-in-e2e` · **PR:** #320
- **Refreshed 2026-11-03** onto main `490fab0` (merge commit `541555a`, clean merge, no conflicts). The PR's three-file change (tests/e2e/helpers.ts, pinch-zoom.spec.ts, storyteller.spec.ts, +38/−2) is byte-identical to the original tip `c0a3ffc`'s change: hunk-for-hunk diff comparison identical except blob index lines.
- **Owner order (2026-11-03 22:38 CST):** "Refresh and pstack swarm and architecture and arena interrogate." This run: Phase 0 refresh (done) → swarm (posting inventory / refresh integrity / dependent surfaces) → architect + arena over the stub design → interrogate the final diff → stop at READY. No merge without the owner's per-PR word.
- **Supersession [observed]:** not superseded — current main stubs nothing for the crash-report host in serveBuiltArtifact or pinch-zoom; the observability specs pin the prod endpoint and intercept only for their own inspection, and storyteller's clean-console check still filters the beacon's network error instead of preventing the post.
- **Status:** refresh pushed; swarm / arena / interrogate in progress under the coordinator. Prior record for this branch (below the divider) is main's carried record and is kept intact.

## 2026-11-04 — Arena synthesis implemented (builder run)

Implemented `~/workspace/meridian-pr320-arena/SYNTHESIS.md` (candidate-1 base + grafts G1–G3 + fixes F1–F4) on this branch:

- `tests/e2e/helpers.ts`: `TelemetryEvent`/`TelemetryEscape`/`TelemetryLedger` + `createTelemetryLedger()` (F2: `payloads()` returns a copy); `TELEMETRY_ENDPOINT` derived from `OBSERVABILITY_INGEST_HOSTS[0]`; `handleTelemetry(route, ledger)` as the one policy entry point; `serveBuiltArtifact` returns the per-context ledger (WeakMap, G3 idempotent), registers once-per-context escape listeners (`response` status ≠ 204 + `requestfailed`) that also append JSON lines to the spill file at `MERIDIAN_E2E_TELEMETRY_SPILL`; `collectTelemetry(context, {flags?, endpoint?})` throws on an unserved context; `telemetryGuard(getLedger, {silent?})` for `test.afterEach` (G2). Header comment on `serveBuiltArtifact` states the contract once (serve first → collectors win dispatch → hand-rolled handlers call `handleTelemetry` before `continue()` → stubbed surfaces may show "sent" copy, assert on the ledger).
- `tests/e2e/pinch-zoom.spec.ts` (F3): call-site swap to `handleTelemetry` with a module-scope ledger; its own handler/spoof behaviour unchanged.
- `tests/e2e/storyteller.spec.ts`: bespoke `unstubbedTelemetry` listener + afterEach deleted; `tel = await serveBuiltArtifact(context)` + `test.afterEach(telemetryGuard(() => tel))`.
- Spill hooks (F4): `playwright.config.ts` gains `globalSetup`/`globalTeardown` → new `tests/e2e/telemetry-spill-setup.ts` / `telemetry-spill-teardown.ts`.
- `scripts/e2e-telemetry-guard.test.mjs`: source-scan rules (a)–(d) in the `npm test` scripts suite; `COLLECTOR_FILES` = the 4 inspecting specs.
- `tests/e2e/telemetry-harness.desktop.spec.ts` (G1): forced-`js_error` recorded via stub (A) and via collector (C); plain boot has no escapes (B). 3/3 pass [measured].

**Deviations recorded, not absorbed:**
- Guard EXEMPT does **not** start empty (contra F1): `tap-verify.spec.ts` [measured] imports nothing from `./helpers` — it inlines its own `serveBuiltArtifact` (written when helpers was untracked) and does not stub telemetry. It is the EXEMPT list's single entry, with the reason in the guard test; migrating it is a follow-up outside this scope. The arena inventory missed it.
- F4 demo spec was named `telemetry-spill-demo.desktop.spec.ts` (deleted after the run): the plain `.spec.ts` name matches no project `testMatch` in `playwright.config.ts`, so it would never have run.

**F4 demonstration [measured]:** the temporary demo spec (later 500 route on `TELEMETRY_ENDPOINT` + forced `js_error`) — the test itself passed, the run exited 1 at `globalTeardown` with the escape listed (`{"url":"https://meridian-crash-report.knowledgetest.workers.dev/ingest","status":500,"kind":"response"}`). A teardown throw **does** fail the run at this Playwright version; the `process.exitCode` fallback was not needed. Demo spec deleted.

**Guard negative proof [measured]:** a temporary spec importing nothing from `./helpers` failed rule (a) naming the file + fix; deleted, guard back to 4/4 green.

**Gates [measured]:** `npx tsc --noEmit` clean · `npm test` green (scripts 947 pass / 0 fail incl. the new guard; src 2016/2016) · `node scripts/lint-cards.mjs` GATE PASSED · `npm run build:pages` green (exit 0; two earlier attempts OOM-killed at prerender under VM contention, third completed) · Targeted E2E (flock, --workers=1, chromium-1243): telemetry-harness 3/3 · storyteller `-g "text-first render"` 1/1 · observability first test 1/1 · pinch-zoom full file 9 passed / 3 failed — the 3 globe zoom-step failures reproduce identically on the unmodified tip `1b88892` in a detached worktree (same dist, same Chromium), so they are pre-existing in this environment, not a regression of this change [measured]. Full E2E suite not run locally (CI's job, per brief).

**Environment note:** this worktree had no `node_modules`; `npm ci` aborted under VM contention, so `node_modules` was copied from a sibling worktree whose `package-lock.json` is byte-identical (md5 `bf080315…`). `dist/` and `node_modules/` are gitignored; nothing of either is committed.

## 2026-11-04 — Interrogation cure round (α/β/γ findings on tip `fbdcada`)

Cured, per the three adversary reports + coordinator synthesis:

- **α-F1** — `tap-verify.spec.ts` now routes telemetry through the shared helpers policy (`createTelemetryLedger` + `handleTelemetry` before its non-loopback `route.continue()`, `watchTelemetryEscapes` on its context); its stale "helpers untracked" header premise is corrected. The guard's EXEMPT list is now EMPTY.
- **α-F3 / cure for pinch-zoom escapes** — escape-listener registration extracted from `serveBuiltArtifact` into exported `watchTelemetryEscapes(context, ledger)` (idempotent per context+ledger pair); `serveBuiltArtifact` calls it; `pinch-zoom.spec.ts` and `tap-verify.spec.ts` call it on their contexts.
- **γ-F2** — pinch-zoom's ledger is per-test: created in `beforeEach` before route registration (no module-scope accumulation), watcher registered there.
- **β-F1** — escape correlation in the watcher: a telemetry request that received a response records no `requestfailed` escape, and one request records at most one escape (per-context answered-Request tracking; a 204 landing after a `requestfailed` retracts it; `requestfailed` spill writes are deferred one macrotask and skipped when retracted).
- **β-F2 + β-F3** — spill path is run-unique (`-<pid>-<Date.now()>`) with a `MERIDIAN_E2E_TELEMETRY_SPILL_FALLBACK` path exported by setup; a failed append is `console.error`-logged (never silent) and retried to the fallback; teardown reads BOTH files and throws listing all lines from either.
- **β-F4** — ledger read APIs deep-copy: `all()`/`ofType()`/`first()`/`payloads()` return `structuredClone`d events/payloads (escapes copied too); mutating a returned object cannot change `count()`/`ofType()`.
- **β-F5** — `serveBuiltArtifact` tracks effective `spoofCapableDevice` per context: same-value re-serve returns the ledger; a different value throws naming both values. Double-serve call sites found in the tree are all same-value (storyteller's in-test re-serve of its fixture context; qa-evidence's beforeEach + per-test serves) — no design adjustment needed.
- **β-F6** — `collectTelemetry` is idempotent per context per endpoint: same-endpoint second call is a no-op returning the ledger; a different endpoint throws naming both.
- **β-F7** — new `telemetryGuardFor(context, opts?)` resolves the context's own ledger (throws if never served); `storyteller.spec.ts` migrated to it; `telemetryGuard` stays, doc-commented as advanced/unbound.
- **β-F8** — telemetry-harness Test A now also asserts the recorded `js_error` payload's `error.message === "telemetry-harness-probe"`.
- **β-F9** — `TelemetryEvent.raw?: string`: on parse failure the raw body text is stored (what `postData()` returns; truncated at 2048 chars); `type` stays null, `parseError` stays true.
- **γ-F3/F4/F5/F6/F7** — guard hardening: comment-stripped scanning (state machine respecting string/template/regex literals) for all rules; rules (b)/(d) scan ALL `tests/e2e/*.ts`, rules (a)/(c) specs only; (a) requires an import (aliases resolved) AND a call; (b) requires `handleTelemetry(` before the first `route.continue()` or a `serveBuiltArtifact(` delegation; (c) requires `CONTEXT_FILES` listing + rule (a), with a pin test asserting CONTEXT_FILES equals exactly the derived `browser.newContext(` set (12 files); (d) keeps the literal ban + `COLLECTOR_FILES`, with a pin test asserting it equals exactly the 4 inspecting specs.

**Residuals (recorded, not cured):**
- **γ-F1** — mis-ordered hand-rolled collectors: a hand-rolled collector registered BEFORE `serveBuiltArtifact` is silently starved (the later serve catch-all wins dispatch) and its posts are re-labelled `via="stub"`. No enumerable-routes cure exists in Playwright — there is no API to list a context's registered routes and check their order. The sanctioned path (`collectTelemetry`) throws when called before serve; a mis-ordered hand-rolled spec fails its own capture assertions loudly rather than passing vacuously, and the 4 inspecting specs keep their verified serve-first order.
- **γ-F7 (split-string half)** — a hostname assembled by string concatenation (`"meridian-crash-report." + "knowledgetest…"`) evades the textual literal ban. Textual only: while serving goes through the shared helpers, the runtime stub keys off the real hostname (`OBSERVABILITY_INGEST_HOSTS`), so the split string alone leaks nothing; the runtime escape/spill backstop, not the text scan, is the layer that catches an actual post.

**tap-verify EXEMPT removal:** the guard's EXEMPT mechanism stays, its list is now empty — tap-verify satisfies rule (a) by importing and calling `handleTelemetry` from `./helpers` (see α-F1 above).
- 2026-11-04: merge-up onto main `ddc0709` (#331) at the owner's merge word. Sole conflict BRANCH_STATUS.md, resolved keeping both records; the PR's harness code is unchanged from the interrogated tip `11a7764`. Checks re-read on the new tip before merging.

---

# Branch status — fix/330-ios-unknown-memory-scout-first

- **Branch:** `fix/330-ios-unknown-memory-scout-first`
- **Base:** `main` @ `c6853bed8ceaffe04fd94bd103d29be6818c70ac`
- **Issue:** #330 — iOS Safari crash-loop on iPhone 11 (iOS 16.4.1)
TASK / requested outcome: implement the four fix items from issue #330
(Scout-first for unknown-memory coarse devices with an in-session
upgrade, starfield pixel-ratio policy, durable map-crash marker, probe
context release), with tests, and open a PR. NO MERGE — the owner's
word, after QA and the panel, is a separate step.

Tier and rationale: Tier 2 shape (multi-file, storage + boot behavior),
run as a single builder under the parent orchestrator; QA and panel are
separate agents after this branch.

Done condition / evidence: unit suite + typecheck + lint + card gate
green; home/boot/map E2E subset: 40 passed / 3 failed in the combined
sequential run, and the 3 failures re-ran solo and passed 3/3
(contention-class flakes — see the Status checklist and PR body; no
single combined "all green" number is claimed); Chromium emulation
of an iPhone-class client shows Scout first, the upgrade after the
soak, and the starfield at the capped size, on both the base and fixed
builds. No real iOS hardware is available — see the PR body and the
Caveats section below.

Files in scope: `src/map/capability.ts` (+ test), `src/map/starfield.ts`
(+ test), `src/lib/observability.ts` (+ test),
`src/map/satellite-map.tsx`, `src/components/game-app.tsx`,
`docs/scout-offer-policy.md`, this file. Out of scope: atlas double
conversion (diagnosis follow-up), copy, place data, worker code.

## What changed and why

- `qualifyMapMode`: unknown `deviceMemory` + coarse pointer → Scout,
  source `unknown-memory`, checked after prior-crash / probe /
  low-memory. Known-memory and fine-pointer paths unchanged; stored
  manual records still win first. The trial persists nothing, so no
  stored artifact can suppress a later prior-crash check.
- Upgrade gate (`shouldFireScoutUpgrade`, soak 3 s past the Scout map's
  first completed render): only the trial source can upgrade.
  SatelliteMap arms it, GameApp applies it session-only.
- Starfield uses the map's pixel-ratio policy (coarse cap 1.5):
  iPhone 11 canvases drop 11,870,208 B → 6,676,992 B.
- Observability: a session-detected map crash also stamps a
  `localStorage` marker (`meridian:map-crash`, 7-day decay);
  `wasMapAttributedCrash()` consults it when the session trail is gone.
  `suspected_crash` reporting is unchanged.
- `probeWebGL()` releases its context via `WEBGL_lose_context`.

## Caveats (panel cure round, 2026-11-03)

- **The upgrade wiring has no automated test.** The timer arming in
  `satellite-map.tsx`, its teardown / context-loss cancellation, and
  the challenge-run exclusion are covered by the pure gate tests in
  `capability.test.ts` plus Chromium emulation and code inspection
  only. The cure round's new source pins
  (`scout-upgrade-lifecycle.test.ts`) cover the GameApp-side wiring
  (note retirement, manual-choice disarm, fire-time re-check) — not
  the timer itself.
- **The repro rig cannot validate the actual failure.** The rig is
  Chromium/Blink: no WebKit, no A13, no real iOS 16.4.1 on this VM.
  It proves the app-level behavior; it CANNOT prove the iOS jetsam
  kill is gone. Only a real iPhone 11 in the field can.
- **Peak memory is NOT reduced.** The fixed build's session peak RSS
  in Blink measured HIGHER than baseline (two map mounts, ~1,605 MB
  vs ~1,478 MB). The honest claim is "crash-loop broken + graceful
  degradation to Scout" — never "peak memory reduced", and never
  "field-proven".

## Panel cure round (2026-11-03, on top of f7e01d4)

Panel on f7e01d4: 3 BLOCK / 8 APPROVE-WITH-NITS / 1 APPROVE /
2 PASS-WITH-NITS. This round cures exactly the briefed items:

- [x] Item 1 (BLOCK): `applyScoutUpgrade` retires the auto-Scout note
  (`setAutoScoutNote(false)`); the false "never standing" invariant
  comment on `applySessionMapMode` corrected. Pin:
  `scout-upgrade-lifecycle.test.ts` — red 4/5 on pre-cure code
  (1 control pass), green 5/5 cured.
- [x] Item 2: both manual handlers clear `scoutUpgradeEligible`;
  Play's `handleScoutUpgrade` re-checks that no stored manual record
  stands before firing. Same pin file (manual Scout after trial boot
  → no upgrade fires).
- [x] Item 3 (comment-only + hygiene): soak timer comment names it as
  the live implementation of `shouldFireScoutUpgrade`'s soak half and
  why the other gate conditions hold by construction; cross-reference
  at the timer declaration; `webglcontextlost` resets the timer to
  undefined; the Scout map "error" → static-fallback handler clears
  the soak timer. No wiring change (filed follow-up).
- [x] Item 4: `docs/scout-offer-policy.md` — challenge-run exclusion
  added to the trial description; the boot-order sentence now
  includes the trial step.
- [x] Item 5: Caveats section above; capsule E2E wording aligned.
- [x] Item 6 (paperwork): PR #331 retitled to "iOS Safari crash-loop
  mitigation: scout-first for unknown-memory devices (#330)"; body
  corrected to name the satellite-map timer + boot-eligibility path
  as the live mechanism (the pure gate is the specification, called
  by no runtime code) and to state the mitigation-honest claim
  (field confirmation on a real iPhone 11 still pending).

Verification on the cured tip (full output read from files):
- `npm test` — scripts: 954 tests, 943 pass, 0 fail, 11 skipped;
  src: 2028 pass, 0 fail (2023 + 5 new pins).
- `npm run test:worker` — 85 pass, 0 fail.
- `npx tsc --noEmit` — clean. ESLint on the touched files — 0 errors,
  13 warnings (same as the base count of 13).
- `node scripts/lint-cards.mjs` — GATE PASSED;
  `npm run lint:content` — GATE PASSED (6 baselined, 0 new).
- `npm run build:pages` — green.
- E2E (sequential, flock, --workers=1, Chromium 1243): combined
  subset of 10 scout/crash specs: 49 passed, 2 failed (17.3 min).
  The 2 failures, per spec:
  - `scout-notice-session-end:78` (strict-mode duplicate-text) —
    failed again in a paired re-run and reproduced identically solo
    on the unmodified pre-cure head f7e01d4: pre-existing on the
    voted tip, not a cure regression.
  - `crash-classification.mobile:169` (backgrounded milestone) —
    CORRECTION (flag-gate cure round, 2026-11-03): the earlier
    wording of this section claimed this spec "reproduced
    identically solo on f7e01d4" — QA proved that claim unverified:
    no solo f7e01d4 run of this spec is on record, and the claim is
    withdrawn. The verified comparison on record is Silo QA's
    (PR #331 QA on f7e01d4): the identical failure on unmodified
    main — pre-existing, not a cure regression.

## Flag-gate cure round (2026-11-03, on top of c890f80)

Panel re-vote on c890f80 left ONE standing BLOCK (Office Hours /
reality-checker): the auto-armed upgrade trial shipped with no
kill-switch. The seat pre-committed to lift the BLOCK for one flag
gate on the upgrade's eligibility/arming path; the owner ordered
the cure. This round is exactly that gate, nothing else:

- [x] Flag: `scoutUpgradeTrial` registered in `src/lib/flags.ts`
  (the codebase's existing flag system), baked-in default `true`
  and shipped `true` in `public/flags.json`. Default = ARMED: the
  shipped #331 behavior is byte-for-byte unchanged. Operator
  disarms by redeploying `public/flags.json` with the flag `false`
  — no code change, effective on the next boot.
- [x] Live gate: GameApp's boot effect — the only arming site —
  awaits the shared `loadFlags()` in the unknown-memory branch and
  sets `scoutUpgradeEligible` only when the flag is on (plus the
  manual-record re-check for a choice landing during the load).
  Disarmed: eligibility is never set, no upgrade callback reaches
  the map, the SatelliteMap soak timer never arms, the session
  stays in Scout. Scout-first boot, manual records, and every
  other path are untouched.
- [x] Spec gate: `ScoutUpgradeGate.trialArmed` added to the pure
  `shouldFireScoutUpgrade` (absent = armed); the soak-timer
  gate-invariant comment in `satellite-map.tsx` now names the
  trial-armed condition.
- [x] Pins, both states: capability gate — disarmed never fires
  even with every soak/idle condition met; armed (explicit or
  omitted) reproduces the prior pins exactly. Flags catalog —
  default armed, remote `false` disarms, non-boolean payloads
  ignored, shipped file carries `true`. Lifecycle source pins —
  the flag-gated call is the only arming site.
- [x] Docs: `docs/feature-flags.md` catalog + kill-switch note;
  `docs/scout-offer-policy.md` trial kill-switch paragraph.
- [x] Record tidy (§7): this section's per-spec E2E split above
  (the `crash-classification.mobile:169` solo-on-f7e01d4 claim
  corrected); PR #331 body Tests section updated to the final
  cured head + true counts, with the "28 passed, 0 failed"
  misreport correction as its own explicit line.

Verification on the code tip of this round (7e9a7a7; the docs
commit that adds this section changes no code):
- `npm test` — exit 0: scripts 954 tests, 943 pass, 0 fail,
  11 skipped; src 2040 pass, 0 fail (2028 + 12 new pins).
- `npm run test:worker` — 85 pass, 0 fail.
- `npx tsc --noEmit` — clean.
- `node scripts/lint-cards.mjs` — GATE PASSED;
  `npm run lint:content` — GATE PASSED (6 baselined, 0 new).
- `npm run build:pages` — NOT VERIFIED locally (corrected
  2026-11-03): four attempts on this VM were all killed by the
  environment under multi-tenant contention (exit 137 OOM in the
  render/SSR phase; one attempt lost to a runtime restart after
  the client bundle built clean). tsc is clean and the client
  bundle transforms and builds; the PR's CI build is the build
  gate for this tip.
- ESLint on the touched files — 13 warnings (same as the base
  count), 0 errors introduced: the one error reported in
  `flags.ts` (no-control-regex, the endpoint-shape validator) is
  pre-existing, proven identical on unmodified HEAD.

## Status

- [x] Capability rule + upgrade gate + marker helpers + probe release
- [x] Starfield policy
- [x] Observability durable marker
- [x] Game-app / satellite-map upgrade wiring
- [x] Docs (`docs/scout-offer-policy.md`)
- [x] E2E subset: 40 passed / 3 failed in the combined sequential run;
  the 3 failures re-ran solo and passed 3/3 (contention flake —
  exact list and timings in the PR body)
- [x] Emulation: base vs fixed builds measured (see PR body)
- [x] PR opened: #331 — https://github.com/veeresh-bikkaneti/Meridian/pull/331
- [ ] Merge — owner's word only, after QA + panel
- 2026-11-04: merge-up onto main `490fab0` at the owner's merge word. Sole conflict BRANCH_STATUS.md, resolved keeping both records; game-app.tsx auto-merged clean (the PR's arming site and main's band-variant work sit in disjoint regions); the PR's code is unchanged from the panel-voted tip `c19a09d`. Required checks re-read on the new tip before merging.
