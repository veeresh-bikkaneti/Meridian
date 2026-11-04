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

---

# BRANCH_STATUS — fix/298-reveal-spec-drift

- **Branch:** `fix/298-reveal-spec-drift`
TASK / requested outcome: Issue #298 — six E2E reveal-spec failures on
main. Diagnose each from evidence, fix at the correct layer, open a PR.
STOP at PR-open; no Silo QA / panel / merge (separate dispatches).
Tier and rationale: Tier 1 — E2E spec fixes against a clear repro; no
product design decision is taken on this branch. If any spec proves
class (b), the data/product fix + gate test lands here and is flagged
in the PR body.

Done condition / evidence: all six specs pass solo on this branch
(flock, --workers=1, bundled chromium-1243, VITE_KOFI_URL set), or carry
an explicit class-(c) disposition argued in the PR body; neighbour
reveal-spec sample green; repo gates sealed under
`~/workspace/meridian-issue-wave/evidence/298/` (tsc, npm test,
test:worker, lint-cards, build:pages).

Files in scope: tests/e2e/gap-view-reveal.desktop.spec.ts,
tests/e2e/reveal-pin-compare.desktop.spec.ts,
tests/e2e/reveal-your-pin-country-globe.desktop.spec.ts,
BRANCH_STATUS.md. helpers.ts / product / data only if a class-(b)
diagnosis proves it (none expected at start).

Frozen / off-limits: PRs #297/#299/#302/#305 and all other open PRs;
#307/#194/#221 in-flight surfaces.

## Status

- [x] Issue #298 + sealed sibling log read; ledger claim posted
- [x] Dataset proof gathered for India/Globe forced places (Easy
      "storied" curation excludes hook-less tier-1 places)
- [x] Solo repro of the six on unmodified main (sealed) — 6/6 failed,
      evidence/298/repro-main.log
- [x] Per-spec diagnosis table sealed — evidence/298/DIAGNOSIS.md
      (5x class (a) stale expectation; gap-view:177 timing-premise,
      disposition argued in PR body, spec left untouched)
- [x] Fixes landed + committed + pushed — 5 of 6 specs fixed in the two
      claimed files (pin-compare + your-pin-country-globe); gap-view
      untouched, class-(c) disposition argued in the PR body
- [x] Gates sealed (evidence/298/): tsc clean; npm test 850+1879 pass;
      test:worker 85 pass; lint-cards PASSED; build:pages green;
      E2E after-run (3 files, flock, workers=1, chromium-1243):
      13 passed / 1 failed — the 1 is gap-view:177's 1200 ms tap
      deadline only (tapAt=3387, cardAt=3538: the skip itself worked)
- [x] PR opened (stop): PR #312
- 2026-11-03: re-check + refresh onto main `775d8b4` (#329). Re-check found the refresh trivially records-only: merge-tree conflict surface = BRANCH_STATUS.md alone, and no main commit since this branch's base touched either reveal spec. Records-only refresh: the spec diff stays byte-identical to the verified tip `78424db`; no re-vote. Standing merge condition unchanged: issue #313 (gap-view relative-bound rewrite + Sevilla comment fix) remains the filed follow-up per the panel ruling.
- 2026-11-03: merge-up onto main `0a6afa1` (#302) at the owner's merge word. Sole conflict BRANCH_STATUS.md, resolved keeping both records; the PR's specs are unchanged from the re-gated tip `70dd362`. Checks re-read on the new tip before merging.

---

# Branch status — fix/296-idle-kill-locator

- **Branch:** `fix/296-idle-kill-locator`
TASK / requested outcome: For issue #296 (Meridian issue-clearing wave,
PR W4) — make `tests/e2e/scout-notice-session-end.desktop.spec.ts` pass
on current main by scoping its idle-kill text lookup into the visible
discarded-notice card, prove it with a green solo E2E run, and open
the PR. Test-only fix; product code does not change.

Tier and rationale: Tier 1 — one bug, one file, clear repro (diagnosis
below matched the coordinator's sealed failure signature exactly).

Done condition / evidence: diagnosis reproduced solo on unmodified
main (1 failed / 1 passed, the failure being the strict-mode violation
on the idle-kill text); after the fix the same spec solo = 2/2 pass;
PR opened against main. NO MERGE — merging is the owner's step.

Files in scope: `tests/e2e/scout-notice-session-end.desktop.spec.ts`
(one locator) + this file. Out of scope: product code, and the same
bare-text pattern in other specs (listed in the PR body, not fixed here).

## What changed and why

- At spec:91 the idle-kill assertion used a bare
  `page.getByText("Your game ended after 2 minutes of inactivity.")`.
  Since PR #287 the same text also lives in the sr-only announcer
  (`data-testid="discarded-notice-announcer"`, `role=status`), so the
  bare lookup resolves to 2 elements and Playwright strict mode fails
  it — even though the visible notice renders correctly.
- Fix: scope the lookup into the visible card —
  `page.getByTestId("discarded-notice").getByText("Your game ended after 2 minutes of inactivity.")`.
  No `.first()` band-aid, no assertion weakened: the test still proves
  the visible idle-kill notice is shown, then
  `map-switched-notice` count 0 and phase no longer `aim`.

## Evidence (sealed: `~/workspace/meridian-issue-wave/evidence/296/`)

- [x] Diagnosis on unmodified main: `build-pages-before.log` /
  `.exit` (=0); `e2e-before.log` / `e2e-before.exit` (=1) —
  **1 failed, 1 passed**; the single failure is the strict-mode
  violation at spec:91 (2 elements: `discarded-notice-announcer` +
  the visible card's paragraph), matching
  `evidence/verify/e2e-pins.log` on main `2a0527f`.
- [x] After the fix: `e2e-after.log` / `e2e-after.exit` (=0) —
  **2 passed**.
- [x] Redundancy / other-instances grep: `redundancy-grep.log` —
  grep for the exact idle-kill string across `tests/e2e/`. See PR body
  for the full list; only this spec is fixed in this PR.

## Status

- [x] Diagnosis reproduced and sealed
- [x] Scoped locator fix (visible card only)
- [x] Solo E2E green (2/2), sealed
- [x] PR opened against main (For #296, not closing it)
- [x] Panel round 1 on `2341296`: 5 APPROVE / 7 AWN / 0 BLOCK, DevEx
  PASS-WITH-NITS — cure applied for the DevEx MEDIUM (seconded by the
  Senior Architect): a comment at the scoped locator records WHY it is
  scoped, so a future "simplify this locator" edit cannot silently
  reintroduce the strict-mode failure. Sibling specs tracked in #303.
- [x] Cure re-verified solo: `e2e-cure.log` / `e2e-cure.exit` (=0) — 2 passed
- [ ] Panel re-vote on the cured tip — coordinator
- [ ] Merge — owner's explicit per-PR word only
- 2026-11-03: refresh onto main `775d8b4` (#329) ahead of the owner's merge word. Sole conflict BRANCH_STATUS.md, resolved keeping both records. The PR's spec diff is byte-identical to the panel-voted tip `5c39d2a`; supersession re-checked on current main (the bare-text lookup is still on main, the spec untouched since this branch's base) — not superseded. Records-only refresh: no re-vote.
