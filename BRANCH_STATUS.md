# BRANCH_STATUS.md — feat/question-disambiguation

Question disambiguation: qualify place names in the question bubble and
result card so same-name places are distinguishable ("Manhattan, Nebraska"
instead of "GLOBE / Manhattan").

## Done
- [x] Explored wiring: `src/components/game-app.tsx` (pool, place,
      `<QuestionBubble>`, `<ResultCard>`), `src/components/question-bubble.tsx`,
      `src/components/result-card.tsx` (title), `src/game/run.ts` (Edition),
      `src/game/regions.ts` (COUNTRIES, ADMIN1_BY_COUNTRY),
      `src/game/generated-places.ts` (toStarter dropped iso2 — confirmed),
      `src/game/starters.ts` (327 curated starters, no iso2).
- [x] Verified data facts: 64 chunks (50 state / 13 country / 1 globe),
      235 distinct iso2 codes; 12 curated globe starters carry
      regionId "globe" (NOT a country id — regionId path alone can't resolve
      them, see Notes); `Intl.DisplayNames` with `fallback:"none"` resolves
      every chunk iso2 in this runtime (Node 24 + Chromium full ICU).
- [x] Contract locked (Veeresh's spec): globe `{place}, {country}`;
      globe collision + resolvable state `{place}, {state}, {country}`;
      country `{place}, {state}`; state bare; fail closed to bare name;
      share text + GeoDetective untouched.
- [x] `src/game/question-label.ts` — pure label builder + fail-closed
      iso2→name resolver (Intl.DisplayNames, no hand table) + collision-map
      helpers. Collision key unified on the resolved country name (review P3).
- [x] `src/game/starters.ts` — `iso2?: string` on `Starter`; optional iso2
      param on `place()`; iso2 populated on the 12 curated globe starters
      (EG/AU/PE/JO/KH/NP/ZW/CL/GR/EC/TZ/IS — grounded in card stories/coords).
- [x] `src/game/generated-places.ts` — `toStarter` threads `iso2` through.
- [x] `src/components/game-app.tsx` — collision-map `useMemo` (globe only),
      `questionLabel` memo; passed to `<QuestionBubble placeName>` and
      `<ResultCard placeLabel>`; screen-reader live-region announcements
      (aim + story/miss) use `questionLabel` too (review P2).
- [x] `src/components/result-card.tsx` — `placeLabel` prop on the title;
      region small-caps line unchanged.
- [x] `src/components/question-bubble.tsx` — `title={placeName}` on both
      title elements so a truncated qualifier is visible on hover (review).
- [x] `README.md` — one line noting prompts carry country/state qualifiers.
- [x] `src/game/question-label.test.ts` — 22 tests, all green, incl. iso2
      coverage over all 64 chunks (124k+ places) and all 12 curated globe
      starters; registered in `npm test`.
- [x] Technical-architect review: approve-with-notes (P2 live-region fixed;
      P3s: collision-key unification applied; 3-part string gate, iso2 shape
      gate, module-level Intl noted as latent/advisory).
- [x] Tone/docs/accessibility review: approve-with-notes (BRANCH_STATUS
      corrected; truncation guard + README line applied; Victoria Falls story
      border mention declined as card-content churn).
- [x] Gates: `npm run typecheck` clean; `npm test` green (incl. 22 new
      question-label tests); `npm run build:pages` green (prebuild: GeoNames
      gate OK 124,690 places / 64 chunks, lint-cards GATE PASSED).

## Pending
- [ ] Playwright E2E on the built artifact (globe/country/state label
      assertions + clean console).
- [ ] Open PR, merge to main per standing auto-merge authorization, verify
      live Pages build, remove worktree.

## Notes / decisions
- No hand-maintained 235-entry iso2 table: `Intl.DisplayNames(["en"],
  {type:"region", fallback:"none"})` is the mapping — smallest correct,
  self-maintaining as data grows, fail-closed (malformed/unknown → null,
  never throws, never surfaces the raw code or "Unknown Region").
- Globe 3-part label is unreachable with current data (globe pools only hold
  regionId "globe" places, none with state info) — implemented per contract
  anyway; falls back to the honest 2-part label when the state is unresolvable.
- Country edition with unresolvable state falls back to bare name per the
  fail-closed clause (the region line already names the country).
- Everest→NP and Victoria Falls→ZW are conventional single-country
  attributions, annotated in code (Everest story itself says Nepal-China
  border; Victoria Falls curated coords are the Zimbabwe-side town).
