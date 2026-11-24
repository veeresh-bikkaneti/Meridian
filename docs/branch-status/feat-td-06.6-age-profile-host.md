# TD-06.6 — game-app-map step 4: age-profile host

Branch: `feat/td-06.6-age-profile-host`
Base: origin/main `8755ee54`
Story: TD-06.6 — extract the age-profile state owner and overlay host
out of `src/components/game-app.tsx`, behavior unchanged, so the
composer only mounts the host and passes the callbacks and slots it
still owns. Step 4 of `docs/architecture/game-app-map.md`. Step 5 and
the TD-06.4 router move are not started.

## What changed

`game-app.tsx`: 8,800 → 8,723 lines (`wc -l`).

- New `src/components/age-profile/use-age-profile-host.tsx`:
  `useAgeProfileHost()` owns the profile state and its change-event
  subscription, the ask-first state (`ageAsk`, `askAgeFirst`,
  `clearAgeAsk`), the lazy `AgeAskGate` / `AgeProfileSettings`
  elements, settings open/close with focus return to the trigger,
  the confirmation toast (state, timer, rendered node), the
  `LockedLoop` slot node, the `ReadAloudPrefSettings` footer-lead
  node, and `readAloudPrefEntry(onAnswered)`, which builds the
  first-visit queue's read-aloud sheet entry (or null once the
  preference is answered). The host imports `./age-profile.css`.
  The `Suspense` + `MapErrorBoundary` wrappers stay in the composer
  at the render sites, exactly where they were.
- The composer destructures the host's values where the age-profile
  state used to sit and passes them on unchanged: `ageAsk` still
  overlays Home and Subjects, `ageSettings(run !== null || loopOpen)`
  renders at both former sites, the locked-loop node reaches `Choose`
  as its new `lockedLoop` slot prop (Home never imports `LockedLoop`),
  the read-aloud settings node is Choose's footer `lead`, and the
  queue still pushes scout → tour → read-aloud sheet in that order.
- Checklist rows 1–6 cured: `./age-profile/AgeAskGate`,
  `./age-profile/AgeProfileSettings`, `./age-profile/LockedLoop`,
  `./age-profile/ReadAloudPrefPrompt`,
  `./age-profile/ReadAloudPrefSettings`, `./age-profile/age-profile.css`
  no longer appear in `game-app.tsx`; their six keys are deleted from
  `eslint/layer-baseline.json`. One new key takes their place:
  `src/components/game-app.tsx|./age-profile/use-age-profile-host` —
  the composer's leftover host import, which the map's §2 preamble
  sanctions ("A leftover host or hook import on the remaining
  composer is a new row, cleared only in the last PR"). Net
  `noUpwardImport`: 115 → 110 (the six widget imports cannot leave
  the game-app row count by six while the composer still mounts
  their host from its own layer; 109 would need the host itself in
  layer 6, which is the last PR's move).
- `scripts/check-game-app-size.mjs`: `GAME_APP_SIZE_CEILING` lowered
  8800 → 8723, matching the new count; its unit test updated.
- `scripts/test-regression-wave.mjs`: `LIMITS.noUpwardImport`
  ratcheted 120 → 110 with the new live count (comment and test
  fixtures updated to match).
- Pinning tests follow the moved symbols at the same strength:
  `locked-tile-film.test.ts` and `card-film.test.ts` now pin the
  byte-identical `LockedLoop` element in the host;
  `first-visit-queue-wiring.test.ts` pins the queue order at the
  composer's push site and the entry literal in the host.
  `src/subjects/shared/ask-age-first.test.ts` (the gate-holder pins)
  follows `ageAsk` / `askAgeFirst` / the settings mounts into the
  host the same way, and `src/subjects/shared/case-navigation.test.ts`
  follows the subjects-branch settings mount. `game-app-lazy-boundary.test.ts`
  (F4 lazy pins) passes unchanged — the wrappers never moved.
- New unit test `use-age-profile-host.test.ts` (5 tests): initial
  values, SSR safety, the locked-loop slot's element type and props
  (wired to the host's own `openAgeSettings`), the footer-lead slot,
  and the first-visit entry built while the preference is unset and
  withheld after it is answered.
- `docs/architecture/game-app-map.md`: step 4 marked done; checklist
  rows 1–6 marked cured. Nothing else in the plan touched.

## Gates

- `npx tsc --noEmit`: PASS
- `npm run lint:arch -- --max-warnings 0`: PASS (`noRawIo` 0,
  `noUpwardImport` 110 — base 115, six game-app keys out, one host
  key in)
- `npm run lint:nav -- --max-warnings 0`: PASS (`shell-ban` 10 —
  unchanged from base)
- `npm run check:provenance`: PASS (real local run on the reproduced
  range before push; CI re-runs it)
- `npm run build:pages`: FAIL locally at the postbuild
  `fingerprint-sw.mjs` step only ("placeholder __BUILD_ID__ not found
  in dist/client/sw.js") — the pristine base tree fails identically,
  so this is environmental on this machine; the vite build and
  prerender completed and CI is decisive
- `node scripts/lint-cards.mjs`: PASS (GATE PASSED)
- `npm run check:entry-size`: PASS (323,824 B gzip, limit 323,865 B;
  base measured 323,634 B on this machine — the host's named return
  values cost ~190 B of module overhead, still inside the limit)
- `node scripts/check-game-app-size.mjs`: PASS (8,723 lines, at the
  8,723 ceiling)
- `node scripts/check-e2e-registration.mjs`: PASS (266 matched,
  2 excepted)
- `node scripts/check-seed-seen-except.mjs`: PASS (GATE PASSED)
- Narrow tests: 183/183 PASS — all `src/components/age-profile/`
  tests (40, including the 5 new host tests), `card-film`,
  `first-visit-queue-wiring`, `game-app-lazy-boundary`, the Home
  wiring tests, the TD-06.5 hook tests, and the two subjects wiring
  suites that pin the moved symbols (`ask-age-first`,
  `case-navigation`, 19 each); script tests (`layer-baseline`,
  `check-game-app-size`, `test-regression-wave`) 26/26 PASS
- Full unit suites (`npm test`): PASS (scripts suite 1304 tests,
  0 fail; src suite 3417/3417 PASS)
- Playwright: NOT RUN — no host-owned spec needed; behavior is
  unchanged and the moved wiring is pinned by the unit tests above.
  The ask-age-first flow's spec is untouched.

## Not done / next

- Draft PR only. Reviewer reviews; Veeresh merges on his word only.
- Next map step (not this lane): step 5, session / idle / discarded.
  The TD-06.4 router move stays last, per the map — it is also the
  PR that clears this lane's one leftover host baseline row.

## Graph

- Adds node: `src/components/age-profile/use-age-profile-host.tsx`
  (the age-profile state owner and overlay host, game-app-map
  step 4, TD-06.6), `depends-on` the age-profile widgets and the
  `@/game/age-profile` profile/read-aloud ports it imports; edge
  `game-app.tsx` → host (the composer mounts it). Integrator folds
  these in at merge; this branch does not edit
  `docs/knowledge/graph.json`.
