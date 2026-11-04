# Branch status — fix/330-ios-unknown-memory-scout-first

- **Branch:** `fix/330-ios-unknown-memory-scout-first`
- **Base:** `main` @ `c6853bed8ceaffe04fd94bd103d29be6818c70ac`
- **Issue:** #330 — iOS Safari crash-loop on iPhone 11 (iOS 16.4.1)

## Task capsule

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
  The 2 failures — `scout-notice-session-end:78` (strict-mode
  duplicate-text) and `crash-classification.mobile:169`
  (backgrounded milestone) — failed again in a paired re-run AND
  reproduced identically, each run solo, on the unmodified pre-cure
  head f7e01d4: pre-existing on the voted tip, not cure regressions.

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
- [ ] Commit B — surfaces (§5.3): priorityRead, enriched alert (Discord +
  email parity), evidence line for missing_fields, digest v2, threshold
  fire-time caveat; full-string goldens (§8.3).
- [ ] Final gates re-run + branch pushed. No PR, no merge (owner's word).
