
# BRANCH_STATUS — fix/result-card-overflow · BoundedText build (2026-10-11)

**PUSH OK, DO NOT MERGE** — owner merges. PR #135 OPEN, evolved on this branch.

## What was built

**`src/components/bounded-text.tsx` + `bounded-text.css`** — the wrapping
contract as a component (spec §2): `as` (p|h1|h2|h3|span|div|dd|dt|pre|a),
`variant` (headline|place|body|url|banner, default body), `wrap`
(word|anywhere), typography-only `className`, rest-spread, React 19
ref-as-prop. NO nowrap/truncate/ellipsis/whiteSpace escape hatches. CSS:
min-width:0, max-width:100%, white-space:normal,
overflow-wrap:break-word; per-variant text-wrap/line-height guardrails;
no hyphens:auto, no overflow:hidden, no JS auto-tune. Dev-only
ResizeObserver tripwire (console.error + data-overflow="true").

**Adoption (§4):** verdict headline (h2/headline), name-eyebrow,
both .place-name h2s, pin-ledger dds, subscript/story/note/breakdown/
growth-line (body), share-pre (pre/url), source links (a/url),
scroll-cue "more below" (span/body), storyteller dock caption (p/banner).
Excluded per spec: GradeChip, difficulty-chip, Next-place label,
AiStoryBadge, icons, restore pill, ReadAloudButton.

**styles.css:** containment moved out of .verdict-headline into
.bounded-text; headline clamp(1.5rem,7vw,2.125rem), lh 1.15 via variant,
margin-bottom 8px; .name-meta clip hazard fixed (flex discipline,
min-height 44px kept); .name-eyebrow nowrap/ellipsis stripped;
.result-card defense-in-depth backstop; .result-source keeps 44px target
via inline-flex centering; flex-container shrink allowance;
approved-exception comments on the two nowrap chips;
.loop-verdict-headline keeps its own overflow-wrap (not a BoundedText).

**Enforcement:** lint-cards.mjs Tier 3 (BoundedText-only static gate,
call-site escape-hatch check, §6c.3 CSS guardrail, flex shrink
allowance, registry drift) + scripts/bounded-text-registry.mjs shared
with E2E. Unit tests src/components/bounded-text.test.ts (14, node
--test). Fixture suite tests/e2e/bounded-text.mobile.spec.ts (18,
Chromium, §9 worst cases, 5 widths, 1.4.12 stress, font-failure
red-team, §10 measurements, dev-build tripwire). Page matrix
tests/e2e/result-card-overflow.mobile.spec.ts (4 widths × 4 variants +
fold test, overlap + closed-world assertions).

## §10 decisions (measured, not guessed)

1. **10px-slack acceptance @390px: PASS** — worst-case first line keeps
   ≥10px slack with real fonts. Size stays clamp(1.5rem,7vw,2.125rem).
2. **Keep-together: balance-only WINS, spans REJECTED.** Measured
   balance-only vs nowrap spans at 5 widths: identical at ≥320px; at
   160px the nowrap spans SPILL (scrollWidth 125 > clientWidth 110) —
   the spans cause the exact overflow the contract prevents. No nbsp
   baked into any user-visible string.
3. **Chip row: PASS** — wrapped headline takes ≥85% row width; chip
   keeps one line at every width.
4. **Story "keep reading" expander: DEFERRED.** Stories wrap fully and
   the card grows; the fold test proves the primary action stays
   reachable. No threshold needed until stories run long in practice.

## Gates (in progress)

- [x] npx tsc --noEmit — clean
- [x] src/components/bounded-text.test.ts — 14/14 (in npm test list)
- [x] node scripts/lint-cards.mjs — GATE PASSED (Tier 3 bites verified
      with temp mutations: raw <p> and unapproved nowrap both fail)
- [x] npm run build:pages — green (bounded-text.css in bundle)
- [x] Fixture suite — 18/18 green
- [x] Page matrix (16 variants + fold) — GREEN. Triaged 5 failures:
      .rname short-tier lh 1.12 clipped 2px → fixed to 1.15 (styles.css);
      hit burn-path used helpers' off-screen commitMiss → width-aware
      commitHitAt with spot-settle; caption battery measures
      caption-text (floating speaker button pollutes container
      scrollWidth by design); geodetective + hit scoped to ≥320px CSS
      (loop/map flows broken at 160/195px on main too — pre-existing).
- [x] npm test (full suite) — 1860/1860 green
- [x] Dev-build tripwire test (BOUNDED_TRIPWIRE=1) — PASS: clean card
      trips zero markers; forced 10px overflow trips data-overflow +
      [BoundedText] console.error. (Fixed: NODE_ENV=development needed
      for import.meta.env.DEV; flex:none to defeat flex-grow in the
      forced-overflow step; in-viewport tap in setup.)
- [x] Visual diffs 390px + 1280px vs main — fixture vdiff: 14.9%/14.2%
      diff, all intended (smaller headline, wrapping eyebrows, no more
      token/URL spill; main shows the reported bugs: clipped headline,
      spilling URL). Temp harness deleted; main worktree removed.
- [x] Red-team pass — odd viewports 280px / 844×390 landscape /
      390×1200 tall: fixture battery green. Font-failure (fallback
      serif) green in fixture suite.
- [x] Screen recording — worst-case fixture cards @390px:
      ~/workspace/your_files/meridian-boundedtext-verification/boundedtext-fixture-390px.webm
- [ ] Rebase to zero conflicts; PR #135 body update

# BRANCH_STATUS — fix/result-card-overflow

Branch: `fix/result-card-overflow` · Base: origin/main @ 51ed7f5 · Created: 2026-10-11.
**PUSH OK, DO NOT MERGE** — owner merges.

Owner report 2026-10-11: pin-drop result card text overflows at 390px —
distance headline clipped, storyteller greeting banner cut off mid-word,
share-text block jumbled under the "more below" cue. Layout-only fix.

Standing rules: named-file staging only, never `git add -A`. Locked Ko-fi
copy must stay byte-identical:
`Grown-ups — buy me a coffee? ☕` · `Your support keeps Meridian free for kids` ·
`Grown-ups — buy me a coffee? Activate to learn how to support Meridian.`

## Done

### 1. Verdict headline wraps instead of clipping
**Root cause:** `.verdict-headline` had `flex: 1 0 auto` — the no-shrink
headline overflowed its flex container instead of wrapping, so
"9,704 km northeast of your pin" spilled past the card's right edge.
**Fix:** `flex: 1 1 auto`, `min-width: 0`, `overflow-wrap: break-word`,
`font-size: clamp(26px, 8.2vw, 34px)`.

### 2. Docked storyteller banner stays inside the card
**Root cause:** `.storyteller-dock` was absolute with `left: 12px` and no
right bound, and the karaoke word joiner used U+00A0 (nbsp), making the
whole greeting one unbreakable line that spilled past the card edge.
**Fix:** dock gets `right: 12px`, caption `max-width: min(260px, 100%)`,
joiner changed to a regular space (no test depended on the nbsp).

### 3. Share text scrolls clear of the "more below" cue
**Root cause:** `.result-body` bottom padding (34px) was smaller than the
overlaid scroll cue (~56px), so the share block's last lines hid under it.
**Fix:** bottom padding 64px; `.share-pre` gets `overflow-wrap: anywhere`
for long URLs.

## Pending

- [x] Black-box e2e: `tests/e2e/result-card-overflow.mobile.spec.ts` — GREEN
- [x] Visual verification 390px + 1280px — fixed card confirmed by eye; main-vs-branch before/after captured (main reproduces all three bugs)
- [x] Red-team: dock is result-card-only; `.verdict-headline` loop usage keeps 11px via later `.loop-verdict-headline` rule; nbsp→space makes visual/aria text match; RTL-safe (physical left+right bounds)
- [x] Screen recording: `tests/e2e/evidence/result-card-overflow-390px.webm`
- [x] Rebase: zero conflicts (main @ 51ed7f5, unmoved)
- [x] Pushed, PR opened (never merged)

---

# Previous branch history (fix/coldtrail-placement-followups, kept for reference)

## Done (2026-10-10) — two owner-requested follow-ups, all gates green

### 1. Crosshair cursor defeated by MapLibre CSS — FIXED
**Root cause:** `LoopMap.tsx` set a Tailwind `cursor-crosshair` class on the map
container div, but MapLibre's stylesheet gives `.maplibregl-canvas` its own
`cursor: grab` rule. The canvas is the element under the pointer, so its rule
wins and the crosshair never rendered.
**Fix:** Set the cursor directly on MapLibre's canvas via
`map.getCanvas().style.cursor = "crosshair"` in the existing `placementActive`
effect (alongside the keyboard disable/enable). Cleared on placement end.
Removed the defeated container-level class.
**Test:** New e2e asserts computed canvas cursor is `crosshair` during
placement and not-crosshair after Escape.

### 2. Disjoint-rings centroid marker suppressed — FIXED
**Root cause:** When the 3 locked rings shared no common area, the overlap
lens rendered a gold centroid dot. The centroid is geometrically meaningless
when rings are disjoint — the dot reads as a fake "answer" point.
**Fix (owner's call: suppress):** No centroid dot and no pulse when disjoint.
The rings stay visible so the player can adjust. Hint copy is now honest:
"All 3 rings are down, but they don't cross — use ↩ Move on a ring to shift
it closer." (was: "tap where they cross"). The `tripleOverlap` geometry
function is unchanged (centroid still computed as the pulse anchor when a
real polygon exists).
**Tests:** New e2e locks 3 far-apart rings → asserts no `overlap-centroid`
feature, no polygon, no pulse, and the honest hint copy. Unit test names
updated (centroid no longer a "fallback marker").

## Gates (final head)
- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — 1082/1082 pass
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — green (`dist/client/_shell.html` exists)
- [x] Playwright coldtrail: 8/9 pass (2 new tests green); mobile 4/4 pass
- [x] Locked copy: untouched (4 changed files contain no locked strings)
- [x] Zero console errors in passing runs

## Known pre-existing failure (NOT caused by this branch)
`coldtrail.spec.ts` » "full slice" fails on unmodified origin/main@9b0a8a1
(verified via `git stash`): the overlap source has 0 features after 3 locks.
Pre-dates this branch; unrelated to the crosshair/centroid changes.

## Rebase 2026-10-10 (d045128)
- Rebasing onto origin/main@ce88939 (#122 merged) — clean, zero conflicts (1 commit replayed).
- Gates on d045128: tsc clean · lint-cards GATE PASSED · build:pages green · npm test 1082/1082 · Playwright coldtrail 8/9 (1 pre-existing "full slice" failure, fails on unmodified main too) · locked copy byte-identical.

---

# BRANCH_STATUS — fix/country-zoom-smooth (investigation only)

Branch: `fix/country-zoom-smooth` · Base: origin/main @ ec456a9 · Created: 2026-10-10.
**READ-ONLY investigation — no code changes, no commits.**

## Investigation: Country-edition zoom-out hitch (Dinesh's report, 2026-10-10)

**Status:** root cause identified via static analysis + functional browser
reproduction. Frame-timing quantification was NOT trustworthy in this VM
(SwiftShader software rendering dominates; see caveats).

**Root cause:** `map.setProjection({type:"globe"})` at T_OUT (satellite-map.tsx:964,
fired from the zoomend handler at :1447 via zoom-space.ts `evaluateThresholds`
:707, Z_GLOBE_OUT=2.2) runs MapLibre 6.11.2 `Style#_setProjectionInternal`
(style.ts:1806), which UNCONDITIONALLY calls `tileManagers[key].reload()` for
every source → every in-view satellite raster tile re-fetches, re-decodes, and
re-uploads to GPU with mipmaps (tile_manager.ts:262, raster_tile_source.ts:205).
The swap is also an instantaneous flat→globe visual snap (no transition), fired
~200ms after the wheel gesture ends (scroll_zoom.ts _finishTimeout). Same burst
on T_IN (zoom back in past 3.2).

**Ruled out:** boundary-bands repaint (no-op at the 2.2 crossing — band stays
"continents"; only fires at z3/z6, async, modest); move-listener/controller
tracking (trivial); starfield (static 2D canvas, zero per-frame JS).

**Browser evidence (Playwright, built artifact, Chromium headless):**
- T_OUT functionally confirmed: wheel-zoom out through z2.2 → "Space view"
  announced, screenshot shows globe rendering with Brazil highlight (run2/run4).
- T_IN confirmed symmetrically ("<Region> view" announcement).
- Frame deltas unusable here (multi-second deltas on every gesture under
  SwiftShader; a 35s longtask with no app trigger) — did NOT attribute the
  hitch to frame data.
- 3/6 runs lost the WebGL context mid-zoom (satellite-map unmounts on
  webglcontextlost, satellite-map.tsx:818/836) — SwiftShader flakiness, not
  counted as app evidence.

**Recommended fix direction:** replace the discrete setProjection swaps with
MapLibre's built-in zoom-interpolated projection morph — set once at map init,
e.g. `['interpolate',['linear'],['zoom'],2.2,'vertical-perspective',3.2,'mercator']`
(supported path: projection_factory.ts Array.isArray branch → GlobeProjection +
GlobeTransform; same mechanism as MapLibre's own 11→12 globe morph). This
removes the snap AND the reload bursts (no more _setProjectionInternal calls);
T_OUT/T_IN keep their logic roles (maxBounds release, announcements, relock
beat) minus the set-projection intents. Must re-verify: permanent
GlobeTransform camera semantics (cameraForBounds/flyTo/easeTo/maxBounds/zoom
buttons), controller trackedProjection, adapter projectionRef/marker-occlusion.
Needs design sign-off (continuous morph vs deliberate snap).

Full report: see parent orchestrator's investigation debrief (scripts kept at
/tmp/zoom-measure/: measure.cjs, analyze.cjs).

---

# BRANCH_STATUS — fix/country-zoom-smooth (BUILD)

Branch: `fix/country-zoom-smooth` · Base: origin/main @ ec456a9 · Built: 2026-10-10/11.
**PUSH OK, DO NOT MERGE** — owner merges.

## Fix: discrete setProjection swaps → zoom-interpolated projection morph

**Root cause (confirmed):** `map.setProjection({type:"globe"})` at T_OUT ran
MapLibre 6.11.2 `Style#_setProjectionInternal`, which unconditionally reloads
every tile manager → all satellite raster tiles re-fetch/re-decode/re-upload.
Same burst on T_IN, plus an instantaneous flat↔globe visual snap.

**Fix:** the projection is now declared ONCE at map init as
`['interpolate',['linear'],['zoom'],2.2,'vertical-perspective',3.2,'mercator']`
(flat editions; globe edition keeps plain `"globe"`). Verified supported path:
`projection_factory.ts` `Array.isArray` branch → permanent GlobeProjection +
GlobeTransform (same mechanism as MapLibre's own globe morph); the v8 spec
allows the interpolated-on-zoom `projectionDefinition` expression. No
`setProjection` calls remain at runtime → no reload bursts, no snap — the
projection morphs continuously across the [2.2, 3.2] hysteresis band.

**Changed files (4):**
- `src/map/zoom-space.ts` — removed `set-projection` from the intent
  vocabulary + all 7 emit sites (T_OUT, T_IN zero-length, T_IN relock
  completion, narrow beat start, reduced-motion narrow, big-miss reveal,
  narrow-completion belt-and-braces). `trackedProjection` stays as the
  controller-owned discrete logical state; new `initialProjection`
  constructor option seeds it on the restore path.
- `src/map/satellite-map.tsx` — `PROJECTION_MORPH` declared once at init;
  dead `set-projection` executor case removed; `projectionRef` replaced by
  `logicalProjection()` (reads the controller) for snapshots, marker
  occlusion, webglcontextlost/retry capture, and reveal requests.
- `src/map/scout-style.ts` — `buildScoutStyle` takes the projection spec
  (morph for flat editions, `"globe"` for globe edition).
- `src/map/zoom-space.test.ts` — all set-projection assertions updated to
  the morph model (logical-state flips, no swap intents).

T_OUT/T_IN keep their logic roles (maxBounds release, announcements, relock
beat). No behavior changes except the smooth morph replacing the snap.

## Gates (final head)
- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — 1089/1089 pass
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — green (`dist/client/_shell.html` exists)
- [x] Locked copy — byte-identical (only in untouched
  `src/components/grandpa-coffee-run.tsx`)
- [x] Playwright morph verification (France country run, built artifact):
  intro narrow beat under permanent GlobeTransform ("France view"),
  T_OUT wheel-out through 2.2 → "Space view" announced, zoom buttons
  (+1/click verified), T_IN back past 3.2 → "France view" re-announced,
  zero console/page errors. Temp spec + diagnostic hook removed afterwards.

## Environment notes (SwiftShader VM flakiness, not app issues)
- Wheel-zoom rate varies run to run (0.1–0.46 levels/notch); zoom-button
  clicks landing mid-ease are swallowed — the verify spec drives one settled
  ease at a time.
- SwiftShader dropped the WebGL context mid-run twice → the app's PBI-5
  safety net correctly switched to Scout Map (maxZoom 3 by design), which
  makes T_IN unreachable. Verified via `data-map-mode`; the passing run
  used device spoofing + full-mode guards.

---

# BRANCH_STATUS — fix/country-zoom-smooth (SCRUM PANEL REVIEW)

Reviewed: 2026-10-11 · Head: 23fa8df · Base: origin/main @ ec456a9.
Coordinator ran all five squads directly (max agent depth — no subagents
available; same rigor, per-squad verdicts below). **No BLOCKs. MERGE-READY.**

## Root cause (recap)
`map.setProjection({type:"globe"})` at T_OUT ran MapLibre 6.11.2
`Style#_setProjectionInternal`, which unconditionally reloads every tile
manager → all satellite raster tiles re-fetch/re-decode/re-upload, plus an
instantaneous flat↔globe visual snap. Same burst on T_IN.

## Fix (recap)
Projection declared ONCE at map init as the zoom-interpolated expression
`['interpolate',['linear'],['zoom'],2.2,'vertical-perspective',3.2,'mercator']`
(flat editions; globe edition keeps plain `"globe"`). Verified in the
vendored MapLibre source: the Array.isArray branch of
`createProjectionFromName` → permanent GlobeProjection + GlobeTransform
(the same mechanism as MapLibre's own 11→12 globe morph). No
`setProjection` calls remain at runtime → no reload bursts, no snap.
T_OUT/T_IN keep maxBounds/announcement/relock roles; the controller owns the
discrete logical projection (globe ≤2.2, mercator ≥3.2).

## Per-squad verdicts
- **Design — APPROVE.** Continuous morph acceptable vs the old snap (the
  snap carried no information; "Space view"/"<Region> view" announcements
  do). Matches the platform-native globe aesthetic. Screenshots at
  360×740 and 390×844: no tearing, highlight tracks the morph, chrome
  stable, no layout shifts.
- **Eng — APPROVE.** Morph setup uses the supported array-projection path
  (verified in vendored 6.11.2). `set-projection` removed from the intent
  type + all 7 emit sites + the executor case; `projectionRef` replaced by
  controller-owned `logicalProjection()`; `initialProjection` seeds the
  restore path. Camera semantics preserved: GlobeTransform delegates to
  the mercator helper at the flat arm (cameraForBounds/flyTo/easeTo/
  maxBounds behave as before). Unit tests updated to the morph model.
- **Devex — APPROVE.** Zero new dependencies, zero config changes,
  `build:pages` green. Change is removal-dominated; no bundle growth.
- **QA — APPROVE.** All mandatory types performed (temp Playwright spec,
  removed after the run):
  - Visual black-box (360×740 + 390×844): country zoom OUT through z2.2
    and back in; morph-A/B/C/D screenshots reviewed — smooth, no glitches.
  - Workflow: full country round — out to space, back in, pin committed
    (score 173), next place advanced, phase back to aim.
  - Regression: state-edition zoom gestures unaffected; globe-edition zoom
    gestures unaffected; home banner intact; narration plays on first
    gesture (greeting_audio phase).
  - Unit: 1089/1089 pass · `tsc --noEmit` clean · `lint-cards` GATE PASSED
    · `build:pages` green · locked Ko-fi copy byte-identical.
  - Functional: "Space view" announced at T_OUT, "France view" at T_IN;
    zoom buttons work in all editions; zero console/page errors
    (React #418 filtered — pre-existing flaky hydration warning per
    established specs).
- **Security — APPROVE.** No new surfaces: static projection expression,
  no user-input interpolation, no new network/storage/message calls.

## Environment notes (harness only, not app issues)
- SwiftShader drops the WebGL context mid-run; the PBI-5 safety net
  correctly switches to Scout Map. Review spec used the established
  `spoofCapableDevice` + full-mode guards and retried on fallback.
- Tile stub for server.arcgisonline.com (documented in helpers.ts).

## Cross-check (AGENTS.md mandatory coverage)
Visual ✓ (QA) · Workflow ✓ (QA) · Regression ✓ (QA) · Unit+functional ✓
(QA/Eng) · Security ✓ (Security) · Squad cross-check ✓ (coordinator:
Design's morph-aesthetic concern checked against Eng's MapLibre-source
verification and QA's screenshots). Nothing skipped.

---

# BRANCH_STATUS — fix/narration-silent-prod

Branch: `fix/narration-silent-prod` · Base: origin/main @ 51ed7f5 · Created: 2026-10-11.
**PUSH OK, DO NOT MERGE** — owner merges.

## Owner symptom
Narration SILENT on his real phone: subtitles/captions advance, zero audio.

## Root cause (three diagnosis cells)
1. Captions advance on an independent `setTimeout` from mount; audio only
   starts on a later gesture. Three silent states had no self-recovery:
   (a) card `onFirstGesture` consumed the one-shot THEN returned on
   `!isSoundEnabled()` — captions advance forever, audioState stuck "idle";
   (b) `play()` promise hangs (iOS stall) — audioState stuck "playing", no
   watchdog; (c) `AbortError` swallowed, stranding "playing" on a dead
   element (card has no figure tap to recover it since #127).
2. PR #127 removed the figure from cards — the documented manual recovery
   path for this symptom.
3. Banner poke-line trap: taps with no audio in flight rotated text-only
   poke lines; a failed/missed greeting could never be replayed.

## Fix (all in src/components/storyteller.tsx + storyteller-home.tsx)
- **Fix A — card one-shot re-armable:** `onFirstGesture` no longer consumes
  the one-shot when sound is off (decision via `decideFirstGesture`); the
  listeners stay armed so the next gesture — or unmute — retries. P1-1
  (celebration-owned gestures) preserved.
- **Fix B — card play() watchdogs:** 4s hang watchdog (play() never
  settles → onFail) + 3s stall check (playing event fired but currentTime
  frozen → onFail). Ref-held timers, cleared on ended/error/dismiss/unmount;
  no chained timers across renders. The stall check is anchored to the
  `playing` EVENT (not play()-resolve) — arming on resolve false-positived
  the 0.2s fixture clip under load during verification (caught by the
  pre-existing "replay replays the line" e2e, 2/5 flake; fixed, then 8/8
  consecutive passes).
- **Fix C — AbortError:** when play() aborts on our own paused element and
  it's still the current attempt, audioState goes to "paused" (recoverable
  via replay/speaker/figure tap) instead of "playing".
- **Fix D — banner greeting replay:** figure tap replays an
  attempted-but-never-heard greeting instead of a poke line
  (`shouldReplayGreeting`: greeting mode, started, attempted, not heard,
  not kid-dismissed, one-shot consumed, audio available, sound on). Heard
  greetings keep poke behavior; kid-dismissed greetings stay quiet. Also:
  `greetingHeardRef` (ended OR timeupdate > 0.5s), and the window gesture
  one-shot now checks a synchronous `tourActiveRef` so a tap during the
  tour can't burn the greeting. Found during verification: banner `onFail`
  never nulled `audioRef` — the stale ref blocked the replay guard; fixed
  (`stopAudio()` in `onFail`).
- **Fix E — retry hint:** `STORYTELLER_RETRY_HINT` ("Tap the speaker to try
  again.") appended to the fallback caption ONLY on play() rejections
  without a resource error (a load "error" event sets `loadErrorRef`, which
  suppresses the hint — retrying a 404 is futile). Never device-shames.
- New pure module `src/components/storyteller-audio-guards.ts`
  (`decideFirstGesture`, `resolvePlayAbort`, `shouldReplayGreeting`,
  `fallbackLine`) — same extract-for-testability pattern as
  `decideHomeMode`; used by both components.

## Tests (each fix has FAIL-pre/PASS-post in this commit)
- Unit: `src/components/storyteller-audio-guards.test.ts` — 20 tests
  (registered in package.json `npm test` script).
- E2E `tests/e2e/storyteller-silence-hang.desktop.spec.ts` — hanging mp3 →
  play() never settles → 4s watchdog → fallback WITH retry hint.
  FAIL-pre verified on pre-fix build (fallback never appears).
- E2E `tests/e2e/storyteller-silence-replay.mobile.spec.ts` — aborted mp3 →
  plain fallback (no hint on network error) → figure tap → new mp3 request
  (replay) instead of a poke line. FAIL-pre verified on pre-fix build
  (no second request).

## Gates (final head)
- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — 1110/1110 pass (node --test)
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — green
- [x] New e2e: hang 1/1, replay 1/1 (built artifact)
- [x] `storyteller.spec.ts` 6/6 (incl. "replay replays the line" 8/8
  consecutive after the stall-anchoring fix)
- [x] Reduced-motion safe (watchdogs are timers, motion-independent);
  COPPA-safe (no new network calls, no new storage keys)

## Known pre-existing failures (NOT caused by this branch)
- `storyteller-tapstart.desktop.spec.ts` — 5 failures (T1, R1, 3 matrix
  tests): they assert the figure on the RESULT CARD, but PR #127 made the
  figure banner-only (`showFigure={false}`) — the testid doesn't exist on
  cards. Identical 5 failures on an independent checkout without this
  branch's changes (other agent's /tmp/verify-kofi run). Orphaned tests
  from #127, need migration to the banner.
- Intermittent infra: Chromium SIGTRAP on launch (2x, transient), e2e lock
  contention with other agents' suites (expected — flock serializes).

## Behavior changes the scrum should scrutinize
1. Card one-shot no longer consumed while muted: EVERY tap while muted
   re-checks sound state (cheap) — and unmuting later lets the STILL-ARMED
   listener fire narration on the next gesture. The banner already behaved
   this way (panel BLOCK 5); the card now matches.
2. The stall watchdog can pause a genuinely-playing element if the media
   clock freezes >3s post-`playing` — under extreme renderer starvation
   this could false-positive, but the user hears nothing in that case, so
   text-only is the honest state. Watch the 3s/4s constants in the wild.
3. `handleFigureToggle`'s paused→`play()` resume path (card) is NOT covered
   by the watchdog — a hung resume could still strand "playing". Residual
   edge, flagged for the test cell.
4. New user-facing copy `STORYTELLER_RETRY_HINT` needs owner/panel copy
   approval (same standing rule as SOUND_OFF_HINT).
5. Banner `onFail` now calls `stopAudio()` (was missing) — also clears the
   12s cap timer on failure; no behavior change beyond releasing the dead
   element.

## Addendum 2026-10-11 ~11:00 CDT — recording-rule audible journey
New HARD rule: E2E runs must produce a screen recording. Added
`tests/e2e/storyteller-audible.desktop.spec.ts` — single continuous
session, card happy path: first gesture → audio probe asserts
`paused===false` + `currentTime` advancing past 3.5s (outlasts both
watchdogs) → fallback never renders → zero console errors. Verified
runnable with `video: 'on'` (one-off config, removed afterwards;
`video.webm` produced). 1/1 pass. Also the regression guard for the
stall-check anchoring fix.

## Addendum 2026-10-11 — FIX cell: scrum BLOCKs 1–3 + non-blocking #1 (head: TBD)
Scrum panel BLOCKED commits 1f71d7b/a958a2b/e56153e. Fixed:

**BLOCK 1 — retry hint named a nonexistent control.**
- Card (`storyteller.tsx`): the replay button now renders when
  `failed && playRejectedRef.current` (the ref is set before every
  `setAudioState("failed")`; `handleReplay` bails only on
  playing/dismissed, so it is a genuine retry). Hint copy changed to
  "Tap the replay button to try again." — the speaker button stays
  hidden in the failed state, so it is no longer named.
- Banner (`storyteller-home.tsx`): new `STORYTELLER_HOME_RETRY_HINT`
  ("Tap me to try again.") names the figure-tap greeting replay (Fix D)
  — the banner has no speaker button. `fallbackLine` takes an optional
  `retryHint` override (card keeps the default).
- Copy is the panel's pick; FINAL wording needs owner sign-off before
  merge (standing rule, same as SOUND_OFF_HINT).

**BLOCK 2 — missing runtime-path E2E tests.** Four new specs (all
FAIL-pre by construction, PASS-post verified):
- `storyteller-silence-unmute.desktop.spec.ts` (Fix A): sound seeded
  off → gesture → no audio element AND one-shot not consumed → unmute
  via the real in-game toggle → real tap → `paused===false`.
- `storyteller-silence-stall.desktop.spec.ts` (Fix B stall trip): MSE
  rig appends 600 bytes then hangs forever (headers + first bytes, then
  stall — a raw socket server is unreachable from Chromium in this VM,
  the egress proxy blackholes loopback) → 4 s hang watchdog → fallback
  WITH retry hint.
- `storyteller-silence-pause-resume.desktop.spec.ts` (Fix C): hanging
  clip → pause mid-buffer (via the probed element; the card figure is
  banner-only) → recoverable "paused" (element paused, no fallback,
  replay visible) → replay click → real playback resumes.
- `storyteller-silence-banner-hint.mobile.spec.ts` (Fix E banner):
  one-shot `HTMLMediaElement.prototype.play` patch forces a NotAllowedError
  on the greeting (this Chromium doesn't enforce autoplay policy, so the
  rejection is staged; it walks the real catch path) → hint names the
  figure tap → real figure tap replays (new mp3 request, `paused===false`).
- Also strengthened `storyteller-silence-hang.desktop.spec.ts`: asserts
  the replay button is actually visible in the failed state.

**BLOCK 3 — banner replay tap debounce.** The Fix D replay branch in
`handleFigureTap` now applies the same 600 ms `POKE_DEBOUNCE_MS` guard
as the poke path (shared `lastPokeRef`) — a tap storm fires one mp3
request per 600 ms window, not one per tap.

**Non-blocking concern #1 — resume watchdog.** `handleFigureToggle`'s
paused→`play()` resume is now guarded by the 4 s hang watchdog (armed on
the same element; the attempt's "playing" listener stands it down via
`onSettled`; refs only, no chained timers). A hung resume fails loud via
the attempt's `onFail` (mirrored in `onFailRef`) with the retry hint +
replay button; a rejected resume sets `playRejectedRef` so the hint
shows (same retryable shape as Fix E).

**Checklist accuracy.** SPEC_CHECKLIST.md item 3 now carries the
qualifier (one-shot retry is true when sound was on at mount; sound-off
at mount means manual mode — speaker then replay, not the one-shot);
item 1 quotes the new hint copy; items 7–8 cover the resume watchdog
and replay debounce.

## Gates (FIX cell, final head)
- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — 1113/1113 pass (guards file 23/23, +3 new)
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — green
- [x] Playwright on the built artifact (flock-serialized, --workers=1):
  - 4 new specs 4/4: unmute (Fix A), pause-resume (Fix C), stall trip
    (Fix B), banner hint (Fix E) — all PASS-post
  - FAIL-pre evidence: stashed the src fixes (scrum-reviewed code with
    Fix A–E intact) → rebuilt → stall + banner-hint specs fail ONLY on
    the new BLOCK 1 copy assertions (fallback itself renders — proving
    the specs are sensitive to the copy change, not vacuous); pause-resume
    + unmute pass there as designed (their FAIL-pre is vs. code without
    Fix A/C at all — credibly FAIL-pre by construction: pre-fix the muted
    gesture unconditionally consumed the one-shot; pre-fix AbortError went
    to onFail/"failed"; pre-watchdog a pending play() strands "playing"
    forever, verified empirically via the MSE probe)
  - Updated: hang 1/1 (now also asserts the replay button renders in the
    failed state), replay 1/1
  - Regression: audible 1/1, storyteller.spec.ts 6/6 (incl. "figure tap
    pauses and resumes", which walks the newly watchdog-guarded resume
    path — no false-positive)
  - Zero console/page errors in all passing runs
- [x] Ko-fi cloud untouched (0 diff lines in grandpa-coffee-run.tsx)

## Pending (NOT for this cell — owner/panel)
- Final retry-hint copy sign-off ("Tap the replay button to try again." /
  "Tap me to try again.") — owner's call before merge.
- Screen recording of the new e2e session for the PR (owner's hard rule).
- Independent reviewer (Chitti/owner panel) verdict — merge-ready is
  theirs, not self-declared.
- Pre-existing orphaned `storyteller-tapstart.desktop.spec.ts` failures
  (5, from PR #127's banner-only figure) — untouched, still failing.
