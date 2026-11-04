# Branch status — unit/crash-telemetry-client

- **Branch:** `unit/crash-telemetry-client`
- **Base:** `origin/fix/330-ios-unknown-memory-scout-first` @ `c890f809fe48efb5da3519c636861372f633f0db`
- **Spec of record:** `~/workspace/meridian-crash-telemetry-evidence/DESIGN-FINAL.md` (Candidate B + grafts)
- **Scope:** Builder A (client) — Units U1 + U2 + U3 only. No PR, no merge.

## Task capsule

TASK: enriched crash telemetry client — parsed RuntimeFacts snapshot persisted in the breadcrumb, persisted classifier state stamps, #335 mapMode fix, durable unfinished-boot counter, watchdog parity.
Tier: 2 shape, single builder under the parent orchestrator; QA + panel are separate agents after this branch.
Done condition: unit suites for the claimed files green, `tsc --noEmit` clean, watchdog rendered size ≤ 5120 bytes (ladder per §7.5), worst-case enriched suspected_crash measured against the 4096 cap.

## Claims (exclusive)

- U1 (new): `src/lib/ua-parse.ts`, `src/lib/ua-corpus.json`, `src/lib/ua-parse.test.ts`, `src/lib/telemetry-manifest.ts`
- U2: `src/lib/observability.ts`, `src/lib/observability.test.ts`
- U3: `scripts/crash-watchdog.mjs`, `scripts/crash-watchdog.test.mjs`
- Guard (from U5's guard half): `scripts/observability-field-parity.test.mjs` (new)
- This file.
- NOT claimed: `src/components/game-app.tsx`, `src/map/capability.ts` (read-only), anything under `workers/`.

## Status

- [x] U1 — parser (§3 B/E/O/P rules + §2.3 denylist), corpus (30 rows incl. incident, denylist, tripwire), manifest (§8.1). Suite: 36/36 pass.
- [x] U2 — observability session truth (§§2.1–2.2, 4.1–4.3 as grafted, §7.4 trim). Suite: 92/92 pass. [measured] worst-case enriched suspected_crash = 2,164 bytes raw vs the 4,096 cap — fits untrimmed, all 15 device keys + mapMode + msSinceBootStart survive.
- [x] U3 — watchdog parity (§4.4: lcV "2", storageOk, mapMode, msSinceBootStart, subset parser, other new keys literal "unknown", unfinishedBoots absent) + second-canvas WebGL1 fix. Suite: 46/47 pass — the single failure is the byte-budget test, the STOP item below.
- [x] Parity guard — written and run; FAILS as expected on this branch (worker allowlist not found — see below).
- [ ] Gates — tsc + claimed suites run at the tip; recorded in the builder report.

## ⚠️ STOP — watchdog byte budget (§7.5 gated decision, NOT taken)

[measured] Rendered watchdog size, worst-case 14-char build id:
- Base (before U3): 5,104 bytes (16 bytes of headroom under 5,120).
- With §4.4 parity + subset parser, before the ladder: 6,210 bytes.
- After the FULL §7.5 ladder (step 1 browserVersion major-only, step 2 engine dropped, step 3 deviceClass dropped): **6,104 bytes** — still 984 bytes over the held 5,120 budget.

The ladder is exhausted and the budget was NOT raised: the raise to 6,144 is an explicit owner-visible decision (DESIGN-FINAL §7.5) and is not the builder's to take. Note for that decision: 6,104 ≤ 6,144, so the gated raise passes with the ladder applied (+~1 KB of inline HTML per page load). The byte-budget test in scripts/crash-watchdog.test.mjs is left at 5,120 and failing on purpose — it is the stop signal, not a bug to weaken.

## Parity guard — expected failure

`scripts/observability-field-parity.test.mjs` extracts the client manifest's device keys vs the worker's `DEVICE_FIELD_ALLOWLIST` from `workers/crash-report/src/index.ts`. On this branch the worker side is still main's code, which has no `DEVICE_FIELD_ALLOWLIST` export, so the guard FAILS by design until the worker unit (U4) lands. It is not weakened to pass.
