# BRANCH_STATUS.md — fix/scout-switch-honesty

## What

Scout Map switching, made honest — both changes are the owner's
rulings of **2026-10-20** (issue #183), after a Scrum investigation
(code + live E2E, on main `8432f75`) answered his two questions:

1. **Q1 — does capability detection auto-switch?** It did not: it
   produced a boot *offer*; the session started in full mode until the
   player accepted, while the code carried a recorded directive ("a
   capability-detected weak device gets a CHOICE, never a silent
   routing") contradicting his decision. His ruling: **"Auto-switch
   silently on weak devices (my decision stands)"** — "check the
   device capability and auto switch; also allow user to manually
   switch."
2. **Q2 — does a manual switch take effect at the next place?** It did
   not: `mapMode` is a constructor input (the map is built once per
   run), so at the next place only the stored record, two DOM
   attributes, and confetti changed — tiles, starfield, DPR cap, zoom
   caps, admin-1 band, and camera motion never changed mid-run. The
   popover's "Applies from the next place — never mid-round" was false
   for every map feature, and the shipped toggle E2E asserted only the
   attribute that does flip. His ruling: **"Force home on manual
   switch (my remedy)"** — "when you manually switch you need to
   reload the entire app to get all features enabled. if that's the
   case we should force the user back to home page."

## The fix

**Change 1 — silent auto-switch at boot** (`src/map/capability.ts`,
boot effect in `src/components/game-app.tsx`):

- No stored record + fresh qualification = scout (prior-crash /
  probe / low-memory) → the session starts in Scout, silently. No
  dialog, no blocking notice; the layers toggle shows the state.
- The decision is persisted as an **auto record** — qualifying source
  kept, NOT manual, NOT accepted — so the existing 7-day decay in
  `readStoredMapMode` re-qualifies the device later, and a device
  that later probes clean returns to full. This matches the
  contextlost record's persistence semantics (the recorded design
  choice; no type change was needed: `planBootMapMode` now returns
  `{ mode, persistSource }` instead of an offer variant).
- A stored manual record still wins over everything and never
  decays; a stored *accepted* record (written by the old dialog)
  likewise. Boot never rewrites a standing record.
- The boot offer is gone: `scout-boot-offer.tsx` deleted, the four
  offer handlers deleted, the offer copy deleted,
  `ScoutOfferVariant` deleted. `writeStoredMapMode` no longer takes
  the `accepted` argument (nothing can write it anymore); the reader
  still honors `accepted: true` on records already on players'
  devices.
- The recorded directive in `capability.ts` is marked **SUPERSEDED**
  with the ruling quoted and dated — history kept, not deleted.
- The `window.__meridianSuppressScoutOffer` seam now suppresses the
  **auto-switch** instead of the dialog (without it, every harness
  boot on the SwiftShader VM would silently start in Scout). It stays
  wired exactly so the suite keeps working — see the flag below.

**Change 2 — manual switch forces home** (`game-app.tsx`,
`map-mode-toggle.tsx`, `scout-copy.ts`):

- A dedicated `handleManualMapMode` in GameApp: writes the manual
  record, stamps the report mode, applies the mode **immediately**
  (no queue), and exits the run — the session (score, banked places)
  survives; the in-progress run is **discarded**. Discarding follows
  the codebase's own pattern (`endTutorial` / `killIdleSession`):
  the persisted run record is removed too, so a later reload cannot
  resurrect a game the popover just said "ends here". (The Editions
  exit deliberately keeps its record — switching editions pauses the
  run; switching the map ends it. First E2E run caught the
  resurrection; the toggle spec now pins reload-stays-home.)
- The queue machinery (`queuedMapMode`, `queuedMapModeRef`,
  `queueAppliedAtIndex`, the render-phase application block, the
  `toggleMapMode` prop) is **removed**: after both changes no path
  produces or consumes a queued mode — manual applies + exits,
  contextlost applies immediately, boot applies pre-mount. The
  queue's index-0 corner (a first-place toggle landing one place
  late in the next run) dies with it.
- `applyMapMode` remains for its one live caller, the
  webglcontextlost tripwire (immediate, with remount).
- Copy: popover footnote now reads "Switching sends you back home —
  this game ends here. Your next game uses the new map." (the warning
  shows *before* the tap); live-region announcements say "Scout Map
  on/off — back home; your next game uses …". Donation copy untouched.

## Fate of the offer-era artifacts

| Artifact | Fate |
| --- | --- |
| `scout-boot-offer.tsx` (dialog) | **deleted** |
| `acceptScoutOffer` / `acceptCapabilityOffer` / `declineScoutOffer` / `dismissScoutOffer` | **deleted** |
| `SCOUT_COPY.bootOffer` / `capabilityOffer` | **deleted** |
| `ScoutOfferVariant`, offer-shaped `planBootMapMode` | **replaced** by `{ mode, persistSource }` |
| `writeStoredMapMode(…, accepted)` parameter | **removed** (read-side `accepted` honored for legacy records) |
| `window.__meridianSuppressScoutOffer` seam | **kept, re-roled** — now suppresses the auto-switch; flagged below |
| Manual-toggle queue | **removed** (no remaining producer/consumer) |
| `scoutOffer` / `scoutOfferShownRef` state | **deleted** (`bootQualified` kept; greeting now waits only for qualification) |

## ⚠ Flag for the owner — issue #154 item 1 is still owed

The `window.__meridianSuppressScoutOffer` seam **now guards the
silent auto-switch**: when the harness sets it, a weak-device boot
stays in full mode and writes nothing. It no longer guards a dialog
(there is none), but it still ships in the production bundle and
still decides boot behavior. Keep-vs-test-only remains the owner's
open call — this branch deliberately does not settle it.

## Tests

- **Unit** (`src/map/capability.test.ts`, rewritten sections):
  `planBootMapMode` pins the silent-apply shape for all three
  qualifying sources + the clean-boot null; the auto-switch record is
  pinned as source-kept, **no `accepted` key**, decaying after 7
  days; a source-reading pin replaces the old #154-item-7 accept
  wiring pin (boot persists `plan.persistSource`; the dialog cannot
  come back; the seam stays wired); legacy accepted/decline records
  are pinned as raw-JSON seeds — the exact shape older builds left on
  real devices.
- **E2E, converted not deleted:**
  - `scout-toggle` — the "next place mount" test is replaced by:
    toggle during a run's **first place** → home → record written →
    the new run's **first place** carries the new mode at **feature
    level** (starfield absent, zero satellite tile requests — never
    the `data-map-mode` label alone); the reverse direction restores
    starfield + tiles; a session test pins that banked places and
    score survive the trip home.
  - `scout-offer` — prior-crash: silent scout + auto record, the
    crash flag stays one-shot, the standing record is never
    rewritten, clean boot writes nothing, manual beats the flag.
  - `scout-capability-offer` — probe + low-memory silent switches,
    manual-full-beats-probe, legacy accepted record stands at 400
    days, decayed record re-qualifies on a weak device and returns
    to full on a now-capable one, greeting arrives with no dialog,
    and the WS-4 tile-failure interplay now runs off a settled
    manual record.
  - `scout-throttled` — SwiftShader + 6× CPU: silent switch, game
    completes in scout.
  - `scout-false-demotion` — goldens unchanged in behavior; the
    vacuous "modal hidden" checks became a real pin (no record
    written at boot on a capable device).

## Docs

- `docs/scout-offer-policy.md` — rewritten: silent-switch rules +
  decay table, the force-home rule, the seam's new role; the old
  offer/non-nag record kept under "Superseded" (filename kept for
  link stability).
- Handbook ch06 §4 — rewritten with both rulings quoted and dated;
  the offer record marked superseded; the /jury fix #2 item (Scout
  dialog gating the first visit) recorded as resolved by the ruling.
  Ch09's Scout Map glossary entry updated to match.
- `capability.ts` — the superseded directive is quoted and marked in
  `planBootMapMode`'s docstring; `StoredMapMode.accepted` and
  `writeStoredMapMode` docs explain the legacy flag.

## Gates

Run at the branch tip, `VITE_KOFI_URL` set at build and test time,
E2E `--workers=1`:

- `npx tsc --noEmit` — **clean**
- `npm test` — scripts **799 (790 pass / 9 skip / 0 fail)** + src
  **1363 pass / 0 fail**
- `node scripts/lint-cards.mjs` — **GATE PASSED**
- `npm run build:pages` — **green**
- E2E vs the built artifact (`--workers=1`): scout-toggle **5/5**,
  scout-offer **4/4**, scout-capability-offer **8/8**, scout-throttled
  + scout-false-demotion + scout-context-lost + scout-switch-note +
  ws4-tile-fallback **23/23** (one batch), scout-narrow-repro
  (zoom-space) **4/4** — **44 passed, 0 failed** across every touched
  or neighboring suite. Two first-run failures were test bugs, not
  app bugs, and both are now pinned properly: the run-resurrection
  (fixed in the app — see Change 2) and a seed helper that re-seeded
  on every navigation (fixed in the harness — `seedManualMode` is
  write-once, matching write policy Q3).

## Pipeline round 1 — NOT READY; Block A cured here

The full pipeline returned NOT READY. The blocks, as itemized in
this record: **A** (the switch announcement could never be spoken +
focus stranded), **B** (warning styling/placement, explainer text,
home notice) and **C** (auto-switch notice/indicator). Blocks B and
C are owner design-scope questions — NOT touched by the Block A
cure; the owner scoped them separately (next section).

**Block A (WCAG 4.1.3 / 2.4.3) — cured.** Three seats converged: the
toggle's sr-only live region was destroyed in the same commit that
set its text (`flip()` called `onSelect` — whose `setRun(null)`
unmounts Play — and only then `setAnnouncement`), so the switch
announcement could never be announced; the header comment claiming
"the live-region announces the change" was false on this path; and
the activated switch was destroyed with no focus landing anywhere.
The cure:

- **Hoisted announcement** — the text state and the `role="status"`
  region (`data-testid="map-mode-announcer"`) now live in GameApp,
  rendered as the first child of every screen branch so the DOM node
  survives the Play → home branch switch; `handleManualMapMode` sets
  the text (the existing `scout-copy.ts` wording) as part of the exit.
- **Focus landing** — the exit flags focus to move to the home h1
  (`headingRef` threaded GameApp → Choose → h1, which also gains
  `id="home-heading"`); the h1's stale comment (it cited the deleted
  boot offer dialog) now cites the manual-switch landing.
- **Toggle cleaned** — its announcement state, its dead live region,
  and the false header claim are removed; the header now states
  plainly that the toggle owns no live region and why.
- **E2E pins** (`scout-toggle`) — after a manual switch, with home
  displayed: (a) the hoisted region holds the announcement text, and
  (b) `document.activeElement` is the home heading. Both fail on the
  pre-cure structure by construction: the announcer element did not
  exist, and nothing in the exit path ever moved focus.
- **Doc nit from the same run** — `docs/scout-offer-policy.md` no
  longer calls the toggle exit "the same exit as the Editions
  button": Editions KEEPS the persisted run record (pause); the
  toggle REMOVES it (the run is discarded for good).

Cure gates (this tip): `tsc` clean; `npm test` scripts **790 pass /
9 skip / 0 fail** + src **1363 pass / 0 fail**; lint-cards **GATE
PASSED**; `build:pages` green; scout E2E family (9 spec files)
**38/38 passed** (`--workers=1`, Ko-fi env set) — incl. the new
Block A pin (toggle spec now 6 tests).

## Pipeline round 1 — Blocks B + C cured (owner-approved scope 2026-10-20)

Owner approvals, verbatim, 2026-10-20:

- Block B: "Yes — make the warning unmissable + home notice"
- Block C: "Yes — small notice + visible Scout indicator"

**Block B — the warning is unmissable, the copy is honest, home says
what happened.** In `map-mode-toggle.tsx` the game-ending warning moved
ABOVE the switch row at the explainer's size and contrast
(`text-xs text-white/70`, `data-testid="map-mode-warning"`); it used to
sit below the switch at 11px / 50% white. The explainer no longer says
"Same game, same rounds" over a run-ending action — it now reads "A
lighter outline map — easier on your phone." After a manual switch
lands the player home, a dismissible notice (the idle-ended-note
pattern, `data-testid="map-switched-notice"`) states the switch and the
kept score: "You switched to Scout Map — your next game uses Scout Map.
Your score is kept." (full-map twin in `scout-copy.ts`). The Block A
announcer and this notice are siblings: the announcer speaks the moment
for screen readers, the notice is the persistent visual record; both
draw their words from `scout-copy.ts`.

**Block C — silent is not invisible.** When boot silently applies
Scout from a fresh qualification (no stored record), Home now shows a
small dismissible note (`data-testid="scout-auto-notice"`): "You're on
Scout Map — the lighter map, picked for this device so the game runs
well. You can change it with the map button on this page." Stored-record
boots and seam-suppressed boots do not show it. Home also hosts the map
control itself: `MapModeToggle` gains a `context` prop, and on Home
(`context="home"`) it sits beside the sound toggle with a visible mode
pill (`data-testid="map-mode-indicator"`, "Scout Map" / "Full map").
Picking a mode at home writes the manual record and applies at once —
no run exists, so nothing is discarded and the popover shows no
game-ending warning there; the announcer speaks "Scout Map off — your
next game uses the full map" (home wording, also in `scout-copy.ts`).
In-Play behavior is unchanged (force-home + warning). Design judgments,
recorded: the home popover stays open after a flip so the switch
visibly flips as feedback; the home notices render in the idle-note
in-flow stack (with the other Home notices), not as the fixed dark
toast the accident paths use.

E2E pins added: popover DOM order (warning before the switch,
`DOCUMENT_POSITION_FOLLOWING`) + the switched notice naming the kept
score (toggle spec); weak-device boot shows the auto note + Scout
indicator and a home flip writes the manual record, clears the note,
and the next run builds full — no run discarded; capable-device boot
shows no note and a Full indicator (capability spec). Docs updated:
`docs/scout-offer-policy.md` and handbook ch06 §4 state the final
behavior; `scout-copy.ts` remains the single copy home.

Cure gates (B+C tip): `tsc` clean; `npm test` scripts **799 (790 pass /
9 skip / 0 fail)** + src **1363 pass / 0 fail**; lint-cards **GATE
PASSED**; `build:pages` green. Scout E2E family: the combined run under
heavy VM load (load avg 7–12, other crews active) finished **35 passed
/ 7 failed** — every failure a known `startGlobeRun`/`commitPin`
pacing predicate, none at a new assertion. Adjudicated by standalone
re-runs: capability-offer **10/10** (both new Block C tests pass),
toggle **8/8** across re-runs (Block A pin + both new Block B tests
pass), offer **4/4**, switch-note **6/6** (the 360px width test passes
solo). One test remains environment-bound: `scout-throttled` (6× CPU
throttle stacked on the loaded VM) failed twice solo at the `commitPin`
20s predicate (helpers.ts:440) AFTER its boot/auto-switch assertions
passed; it passed in the round-1 panel family run at the previous tip,
and this cure touches no gameplay code — the re-vote run should
re-exercise it.

## Panel re-vote at `30e1faf` — NOT READY again; cure round 2 here

The re-vote judged the A+B+C tip: tally **APPROVE ×1 /
APPROVE-WITH-NITS ×4 / BLOCK ×7**, DevEx PASS-WITH-NITS. Blocks A
and B verified CURED (B's score-kept claim proven from the code:
banking happens at pin-commit and the handler never touches the
session store). Block C's visible parts all work — but its notice
lifecycle failed, and one structural catch sat in the force-home
exit itself. Four new BLOCKs, each cured below with the blocking
seats' own specified fix:

1. **BLOCK-1 — an in-game flip never retired the auto-switch note**
   (6 seats). `handleManualMapMode` set the switched notice but not
   `setAutoScoutNote(false)` — a weak-device boot (note up,
   undismissed) → run → flip in Play landed Home with BOTH notices
   stacked and contradicting each other. **Cured:** the manual
   handler retires the auto note, mirroring the home handler; pin in
   `scout-capability-offer`: *"weak boot + in-game flip: home shows
   ONLY the switched notice — the auto note retires (BLOCK-1)"*.
2. **BLOCK-2 — a home flip never invalidated the switched notice.**
   Play-flip to full, then home-flip back to Scout left the stale
   "your next game uses the full map" standing. **Cured:**
   `handleHomeMapMode` now clears `mapSwitchedNote`; pin in
   `scout-toggle`: *"a home flip retires the stale switched notice
   from an earlier in-game flip (BLOCK-2)"*.
3. **BLOCK-3 — one event, two live regions.** The manual handler
   sets the announcer AND mounts the switched notice in one commit;
   both were `role="status"`, so some screen readers would announce
   the switch twice. **Cured:** `role="status"` dropped from both
   VISIBLE notices (map-switched + scout-auto); the hoisted
   announcer is the sole speaker. Existing pins already asserted
   the notices by testid/text, so none needed re-aiming.
4. **BLOCK-4 — force-home did not deterministically land Home
   (structural).** The exit cleared run/menu/tutorial but never
   `loopOpen` / `coldTrailOpen` / `starting`, and render precedence
   lets a lurking flag win. Reachable, not theoretical: Editions
   exit keeps the run record → enter GeoDetective (its open flag
   persists) → reload restores both → flip → the run dropped and
   **LoopScreen rendered, not Home** — stranding Block A's focus
   flag and hiding Block B's notice. **Cured:** the exit also clears
   `loopOpen` (+ `writeLoopOpen(false)`), `coldTrailOpen`, and
   `starting`; pin in `scout-toggle`: *"manual switch lands HOME
   even with a persisted GeoDetective flag under the restored run
   (BLOCK-4)"* — it walks the exact repro (real run → Editions →
   GeoDetective → reload → flip) and asserts Home, the notice, the
   h1 focus landing, and the persisted flag gone.

Two panel nits absorbed in the same round:

- **Indicator pill not programmatically linked** (UX Researcher,
  Major nit): the Home button's accessible name now carries the
  current mode ("Map mode settings — currently Scout Map" / "…
  Full map") — the same words the pill shows. Pin in
  `scout-capability-offer`.
- **Home popover clipped at narrow widths** (Frontend, HIGH nit):
  measured pre-cure on the real page — at 340px the left-anchored
  256px popover ran off the viewport entirely; at 360px the hero's
  `overflow: hidden` clipped it; right-anchoring would break 320px
  instead (the button wraps to the row's start there). **Cured:**
  on Home the popover is fixed-positioned from the button's
  measured rect, clamped inside the viewport; the Play popover is
  byte-for-byte the old anchor. Pin in `scout-capability-offer`
  asserts the popover box lies inside the viewport at 320/340/360/
  390px.

Docs this round: `docs/scout-offer-policy.md` gained the two
landing rules (deterministic Home + one notice at a time, visual
only) in plain words; the handbook's §4 statement stays true at its
level and is unchanged. The scout-helpers contract comment records
the notices' no-role rule and the popover testid.

**Rebase:** main advanced while this cured (PR #184 merged; main
`11a95a7`). The branch was rebased onto it — the only conflict was
this file, resolved by keeping the branch's own record — new tip
`1e695f6`.

**Cure round 2 gates** (at `1e695f6`, Ko-fi env at build + test,
E2E `--workers=1`): `tsc` clean; `npm test` scripts **799 (790
pass / 9 skip / 0 fail)** + src **1366 pass / 0 fail** (1366, not
1363 — main's #184 tests joined in the rebase); lint-cards **GATE
PASSED**; `build:pages` green; scout E2E family (9 spec files)
**47 passed / 0 failed** in one serial run, `scout-throttled`
included — no flake claims needed this time. Every new pin was
first run against the pre-cure build (`30e1faf`) and failed there:
BLOCK-1 at the auto-note count, BLOCK-2 on the stale notice,
BLOCK-4 at "Home never renders after the flip", both nit pins on
their assertions. (The BLOCK-1 pin's first form passed pre-cure —
vacuously: `startGlobeRun` re-navigates, and the second boot reads
the auto record the first boot wrote, retiring the note for an
unrelated reason. The shipped pin runs the single-boot repro.)

## Ready to merge?

**NO — panel re-vote round 3 on the final tip + Veeresh's word.**
Per the owner's rule the panel approves the final tip itself;
merge only on READY + his per-PR word. Two caveats ride at this
decision point, neither settled by this branch:

- **Issue #154 item 1 is still owed** (see the flag section
  above): the production test seam `window.__meridianSuppress
  ScoutOffer` now guards the silent auto-switch. Keep-vs-test-only
  is the owner's open call.
- **`scout-throttled` is environment-bound on this VM:** the
  panel's calm-VM re-run of the full scout family passed 39/39
  including it; under load its `commitPin` 20s wall-clock poll can
  still trip on any branch. A harness follow-up, not a branch
  defect — the family result recorded for this tip says which
  conditions it ran under.

