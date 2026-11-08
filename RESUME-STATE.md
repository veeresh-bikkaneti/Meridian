# RESUME STATE — Home-first entry lane (PR #368) — STOOD DOWN 2026-11-08

> Written under the owner's SEQUENTIAL PIPELINE LAW (Veeresh, voice 2026-11-08
> ~09:15 CST): one Meridian lane at a time on this VM. This lane is FIFTH in the
> queue — (1) Watson-station cure, (2) #364 follow, (3) U11 renders, (4) PR A
> cures, (5) Home-first. Heavy work (builds, E2E) is STOPPED. This note is the
> reactivation brief: read it first when the lane's turn comes.

## The owner's order

"Page by default is loading GeoDetective — we should always push the player
onto homescreen." (2026-11-08 ~00:53 CST, from his phone.) A default/bare entry
must always land on the HOME screen (edition picker + resume offers live
there). Explicit intent still works: edition tap, resume tap, shared
challenge/case link.

## Mechanism — verified live + code BEFORE any change

**Cause: the persisted localStorage flag `meridian.loop.open` = `"1"`.**

- Set on every GeoDetective entry (`src/components/game-app.tsx`, card tap,
  `writeLoopOpen(true)`), cleared ONLY by explicitly leaving the screen.
  Closing the tab/app never clears it.
- At boot, the initial state read the flag at first render
  (`game-app.tsx:1530` — `useState(() => readLoopOpen())`; Cold Trail twin at
  `:1537`) and the render precedence put LoopScreen (`:3414`) above Home.
  So any returning player who had EVER played GeoDetective booted straight
  back inside it — mid-case resume, or (flag alone, no saved case) a freshly
  auto-dealt case.
- Cold Trail carries the identical flag: `meridian.coldtrail.open`.
- Full evidence: `~/workspace/meridian-entry-evidence/` (`notes.md`,
  `live-results.json`, 6 screenshots, both live hosts, 390px relay captures).
  Key frames: `workers-inflight.png` (flag + store → inside GeoDetective,
  "Case #4"), `workers-flagonly.png` (flag only → inside, auto-dealt Case #1),
  `workers-storeonly.png` (store, NO flag → Home + "Resume your case" ✅),
  `workers-fresh.png` / `pages-fresh.png` (fresh profile → Home ✅).
- The in-flight store is `meridian.loop.v2`; the Home resume offer is
  `peekLoopProgress()` (`src/game/loop/store.ts:762-785`), button in
  `game-app.tsx` (~:4841). The resume OFFER on Home is designed behaviour
  (owner ruling on PR #365) — landing INSIDE the game was the defect.
- URL params: `#c=` challenge hash — mc1 commits a run directly; mc2/mc3 show
  a welcome card over Home. `?loop-puzzle=` is an E2E seam inside LoopScreen
  only; it cannot open GeoDetective by itself.

## Reconciliation — why the clean-room crew landed on Home but the owner landed inside GeoDetective

No contradiction: **the two groups carried different persisted state.**

- The clean-room acceptance crew (2026-11-08) tested LIVE production with
  fresh browser contexts — no `meridian.loop.open` in storage — so every
  visit correctly landed on Home. Their result is true FOR A FRESH PROFILE.
- The owner plays on his real phone, where the flag was written by his own
  earlier GeoDetective sessions and never cleared (he never uses the
  in-screen leave path that clears it). Every open of the site therefore
  booted him inside a case.
- Same code, different storage → different landing. The verifier proved the
  split on the live hosts by seeding exactly the owner's state (flag +
  in-flight store) into the same fresh contexts the crew used: they then
  landed inside GeoDetective, identically, on both hosts.

## What is built (PR #368, tip `edb7383`, branch `fix/entry-home-landing`)

- Boot ignores BOTH persisted open flags: `loopOpen` and `coldTrailOpen`
  initialise to `false` in `game-app.tsx`; the flag read/write helpers were
  deleted with all call sites (the key constants remain ONLY so the
  Start-over reset can delete stale values — documented in code).
- Progress persistence untouched: `meridian.loop.v2` /
  `meridian.coldtrail.v2` stores, dealing, deck order, #365 tail-return,
  `endSession` — all byte-unchanged.
- Cold Trail had NO Home resume offer; the PR adds `peekColdTrailProgress()`
  (read-only, mirrors `peekLoopProgress`) + the "▶ Resume your trail" card
  state, so an in-flight trail stays reachable from Home exactly like a case.
- Docs updated: README, `docs/geodetective.md`, handbook ch.02 (entry rule
  recorded with the owner's words), BRANCH_STATUS capsule on the branch.
- Scope held: NO hot files — `DetectiveHost.tsx`, `detective-state.ts`,
  `companion.ts`, `follow.ts` untouched (verified by Silo QA + Senior
  Architect + Office Hours from the diff).
- Files: 40 changed (564 + / 315 −), incl. new `tests/e2e/entry-routing.spec.ts`
  (16 tests) + 22 evidence PNGs, 5 re-pinned E2E specs, `playwright.config.ts`
  project registration.
- Derived scope decisions (from the owner's words; flagged in the PR body,
  not stalled): (1) `#c=` challenge links keep entering the game — a link tap
  is explicit intent; (2) a mid-case REFRESH now lands on Home + resume offer
  — a reload expresses no intent (this supersedes the PR #203 reload-parity
  behaviour deliberately); (3) Cold Trail's identical flag fixed in the same
  PR; (4) sessionStorage map-run restore left untouched — see OPEN RULING.

## Verification state at stand-down

- Builder gates: tsc exit 0 (direct unmasked re-run on the tip), unit, worker
  145/145, lint-cards PASSED, build:pages green.
- CI on `edb7383`: build (22.x) ✅ · e2e ✅ · GitGuardian ✅.
- Panel (clean-context silos, RETRO LAW): **12 of 13 seats APPROVE-WITH-NITS,
  0 BLOCK among them** — Game Designer, Game Developer, Game Audio Designer,
  Game Narrative Designer, Game Economy Designer, Game Level Architect,
  Senior Architect, Senior Developer, Frontend Developer, UX Researcher,
  UX Designer, Office Hours.
- DevEx: APPROVE-WITH-NITS. Benchmark: PASS (no bundle regression).
- Visual tester (promises-only brief): PASS — resume offers photographed
  IN FRAME at 390/768/1280 (`~/workspace/m368-visual-evidence/`); Cold Trail
  resume shows Case #001, Rings placed 1 of 3, gold ring drawn on the map.
- Silo QA (key PR#368@edb7383): PASS-WITH-NITS on every executed gate — tsc
  exit 0, scripts 1032, src 2269/2269, worker 145/145, lint PASSED, build
  green, scope + re-pin audits clean. Its E2E gate was ENVIRONMENT-BLOCKED
  (browser-launch policy absent after a VM restart + the shared E2E lock
  held by another lane's census), not failed.
- Game Player evidence: `~/workspace/m368-gameplayer-evidence/`
  (consolidated timed play log + screenshots).

## OPEN RULING — blocks the merge (escalated to Veeresh via options card)

The Game Player seat voted **BLOCK on scope, not on the fix**: the
sessionStorage map-quiz restore (`bootSavedRun`, `meridian.run` /
`meridian.run.mc2` / `meridian.run.mc3`) still boots a same-tab reload
straight into a Globe/Country/State quiz — played and proven at 390/1280,
including a Cold Trail reload landing in a leftover Globe game. GeoDetective
and Cold Trail pass everything at every width. The seat states on the record:
an owner ruling that quiz-session restore is intended pre-existing behaviour
flips it to APPROVE-WITH-NITS. Office Hours flagged the same path (MEDIUM
nit, "always" overclaims while it exists).

- If the owner rules "quiz restore is fine": the panel is 13/13
  READY-WITH-NITS → finish the E2E re-run → merge dance → live verify.
- If the owner rules "always Home covers quizzes too": extend the same fix to
  the run restore FIRST (that path additionally needs a Home resume offer for
  quiz runs — none exists today), then panel re-vote on the new tip.

## What remains on reactivation (in order)

1. Read this note + the owner's ruling on the quiz-restore question (check
   with Chitti — the options card was put to Veeresh 2026-11-08).
2. Re-check main HEAD. Lanes 1–4 will have merged ahead of this one;
   merge-up main into `fix/entry-home-landing` (expected conflict surface:
   BRANCH_STATUS.md — keep both records) and re-run the gates on the merged
   tree. If the merge-up changes the diff's substance, the panel re-votes;
   records-only/identical diffs follow the identical-diff rule.
3. The E2E re-run that never completed: in the Silo QA clone
   (`~/workspace/m368-siloqa` @ edb7383 or a fresh equivalent), under
   `flock ~/workspace/.e2e.lock`, `--workers=1`,
   `PLAYWRIGHT_CHROMIUM_EXECUTABLE=~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`
   — entry-routing project; geodetective + geodetective-hint; desktop specs
   chunk-boundary-copy / reset-history / scout-toggle; friend-challenge
   desktop. KNOWN BASELINE: the geodetective "win path" share-URL failure is
   pre-existing on unmodified main (expects Workers origin, harness serves
   Pages) — verify against main before calling anything a regression.
4. Run the NEGATIVE-TEST LIST below (owner's law — mainly negative; happy-path
   coverage does not count). Items 2–5 are NOT covered by the PR's current
   tests and must be added/proven on reactivation.
5. Merge dance on READY: fresh CI read seconds before merge (required
   contexts `build (22.x)` + `e2e` + `GitGuardian`; `Workers Builds` is NOT
   required) → `gh pr merge 368 --squash` → verify branch auto-deleted →
   append tip SHA to `~/workspace/deleted-branches-2026-11-02.txt` → live
   build-meta on BOTH hosts → live screenshots at 390/768/1280 (bare entry
   with seeded in-flight state → Home + resume offer) → post-merge
   BRANCH_STATUS staleness check on main.
6. Follow-up issues to file from the panel's nits (do not fold into this PR):
   peek-validation parity for `peekColdTrailProgress` (Senior Developer's
   MAJOR nit — parseable-but-corrupt Cold Trail blob can offer a Resume the
   loader then sanitises away; reuse an `isProgress`-grade check + pin the
   Cold Trail E2E leg to a seeded ring marker); scrolled/full-page evidence
   frames for resume scenarios (closed for THIS tip by the visual tester's
   in-frame captures — keep the practice); resume-below-the-fold findability
   (UX Researcher MEDIUM — owner's call: slim resume strip vs fold into the
   open findability study); orphaned legacy flag keys cleanup-on-boot;
   stale `handleManualMapMode` docstring ("rehydrates from a persisted
   flag" — false at this tip).

## NEGATIVE-TEST LIST (owner's law, 2026-11-08 — applies on reactivation)

Enumerate what must NEVER happen, before what must:

1. **NO entry path lands inside a game uninvited** — bare root, refresh
   mid-case, back-button, PWA relaunch, cold open with a case in flight
   (in-flight = Home resume OFFER, never auto-entry).
2. **A shared link never drops the player into a case without the Home offer
   step.**
3. **The resume offer never restores an outright-ended case** (the #365
   end-outright fate must stay dead — no resurrection via Resume).
4. **Entry routing never loses a pause-preserved case** (the #365 pause fate
   must survive every entry path exactly — same case, same clue/guess state,
   counts once when it later closes).
5. **Flag OFF = today's entry behaviour exactly** (any kill-switch/gating
   added on reactivation must reproduce the pre-fix entry behaviour when off;
   note the current PR adds no flag — if one is introduced, this test binds).

Coverage honesty at stand-down: item 1 is proven for bare root, refresh, and
cold open (seeded) by the entry-routing E2E + visual + Game Player passes;
back-button and PWA relaunch are NOT yet pinned. Items 2, 3, 4, 5 have no
dedicated negative tests yet — they are reactivation work, not done work.
