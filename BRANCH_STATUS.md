# Branch status — feat/crash-telemetry-stamps (combined crash-telemetry PR)

- **Branch:** `feat/crash-telemetry-stamps`
- **Base:** `fix/330-ios-unknown-memory-scout-first` @ `c890f80` (PR #331 merges first; this PR merges immediately after, with a merge-up and fresh CI)
- **PR:** #339 — https://github.com/veeresh-bikkaneti/Meridian/pull/339
- **Spec of record:** `~/workspace/meridian-crash-telemetry-evidence/DESIGN-FINAL.md` (arena Candidate B + 10 grafts)

## Finisher record (integrator, 2026-11-03)

- [x] Merged `unit/crash-telemetry-client` (tip `0361e02`, U1–U3) — clean merge.
- [x] Merged `unit/crash-telemetry-worker` (tip `fd83292`, U4) — the only
  conflict was this file; resolved by keeping BOTH unit records (below).
- [x] Gated decision taken as its own commit (`4098735`): watchdog byte
  budget 5120 → 6144 per DESIGN-FINAL §7.5 — the ladder was exhausted
  (subset parser → browserVersion major-only → engine dropped →
  deviceClass dropped) and the rendered watchdog measures 6,104 bytes
  worst case, ≤ 6,144. Cost: +1 KB inline per page load. The owner
  rules on it with this PR's merge word; it is a decision item in the
  PR body. Watchdog suite after the raise: 47/47.
- [x] Parity guard green on the combined tree (1/1). Integrator edit:
  the guard's extractor did not match the worker's
  `Object.freeze([...])` allowlist declaration ("list declaration not
  found"); the extractor now allows the freeze wrapper. The field
  lists themselves matched exactly — 17 keys each, `webgl1`/`webgl2`
  included on both sides — so no field exception was encoded.
- [x] U5 docs: `docs/observability.md` (honest counts — client emits
  14 types, the worker on main accepts 8, the 6 engagement types land
  with PR #311; manifest field table; formats as built; the v1
  log-tail section marked superseded; "How to read a crash alert"
  walkthrough; privacy statement updated), `workers/crash-report/README.md`
  (bucket v2 shape, reachable fire-time threshold example),
  `AGENTS.md` (the §6.3 safeguard sentence only).
- [x] Follow-up filed: issue #338 — crash-report KV buckets have no
  retention (no `expirationTtl`); deliberately not bundled into this PR.
- [x] Combined gates on the combined tree:
  - `npx tsc --noEmit` — clean (exit 0)
  - `npm test` — scripts: 960 tests, 949 pass, 0 fail, 11 skipped;
    src: 2,075 tests, 2,075 pass, 0 fail
  - `npm run test:worker` — 106/106 pass
  - `npm run typecheck:worker` — clean (exit 0)
  - Watchdog suite — 47/47; parity guard — 1/1
- [ ] Merge — owner's word only, after the panel approves the final
  tip. Post-merge owner step: manual crash-worker version upload.

The two unit records follow, kept whole.

---

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

---

# Branch status — unit/crash-telemetry-worker (crash-telemetry U4, worker)

- **Branch:** `unit/crash-telemetry-worker`
- **Base:** `fix/330-ios-unknown-memory-scout-first` @ `c890f809fe48efb5da3519c636861372f633f0db`
- **Spec of record:** `~/workspace/meridian-crash-telemetry-evidence/DESIGN-FINAL.md` §5 (worker unit U4)
- **Files claimed (exclusive):** `workers/crash-report/src/index.ts`, `workers/crash-report/src/index.test.ts`, `BRANCH_STATUS.md`

## Status checklist

- [x] Commit A — intake + counting: `normaliseEvent` before `validateEvent`
  (§5.1 strip-and-continue, `DEVICE_FIELD_ALLOWLIST` export, caps
  unchanged), counting v2 (§5.2: groups with 32-key hard cap, verdicts
  from the hoisted shared re-derivation, milestones, modes, errorNames,
  receipt firstAt/lastAt, late counter, old-bucket read tolerance).
  Gates: test:worker 95/95, typecheck:worker clean.
- [x] Commit B — surfaces (§5.3): priorityRead (P1 requires
  buildReplaced === false + gameplay last step), enriched alert
  (priority line 3, why-code, time, collective (UA-parsed) device line,
  runtime/mode/boots lines; email gains the same lines incl. device:),
  evidence line for missing_fields from missingStampNames (§5.4,
  presentation-only), digest v2 (per-type blocks, labelled caps with
  (+N more), count-desc/key-asc, receipt first/last, late-arrival
  label, "receipt hour" header), threshold fire-time caveat.
  Full-string goldens for buildAlert (Discord + email),
  buildThresholdAlert, renderDigest; alert/email parity test;
  missingStampNames iff-property test; classifier fixture tables
  re-asserted (classifier region byte-identical to base, verified by
  diff). Gates: test:worker 106/106, typecheck:worker clean.
- [x] Final gates re-run + branch pushed. No PR, no merge (owner's word).
