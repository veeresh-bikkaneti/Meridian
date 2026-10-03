# BRANCH_STATUS.md — feat/question-disambiguation

Question disambiguation: qualify place names in the question bubble and
result card so same-name places are distinguishable ("Manhattan, Nebraska,
United States" instead of "GLOBE / Manhattan").

## Done
- [x] Explored wiring: `src/components/game-app.tsx` (pool ~L1086, place
      ~L1113, `<QuestionBubble>` ~L1522, `<ResultCard>` ~L1532),
      `src/components/question-bubble.tsx`, `src/components/result-card.tsx`
      (~L233 title), `src/game/run.ts` (Edition), `src/game/regions.ts`
      (COUNTRIES, ADMIN1_BY_COUNTRY), `src/game/generated-places.ts`
      (toStarter drops iso2 — confirmed), `src/game/starters.ts` (327
      curated starters, no iso2).
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
      helpers.
- [x] `src/game/starters.ts` — `iso2?: string` on `Starter`; optional iso2
      param on `place()`; iso2 populated on the 12 curated globe starters
      (EG/AU/PE/JO/KH/NP/ZW/CL/GR/EC/TZ/IS — grounded in card stories/coords).
- [x] `src/game/generated-places.ts` — `toStarter` threads `iso2` through.
- [x] `src/components/game-app.tsx` — collision-map `useMemo` (globe only),
      `questionLabel` memo; passed to `<QuestionBubble placeName>` and
      `<ResultCard placeLabel>`.
- [x] `src/components/result-card.tsx` — `placeLabel` prop on the title;
      region small-caps line unchanged.
- [x] `src/game/question-label.test.ts` — 22 tests, all green, incl. iso2
      coverage over all 64 chunks (124k+ places) and all 12 curated globe
      starters; registered in `npm test`.

## Pending
- [ ] `src/game/question-label.ts` — pure label builder + iso2→name resolver
      + collision-map helpers (no React).
- [ ] `src/game/starters.ts` — add `iso2?: string` to `Starter`; optional
      iso2 param on `place()`; populate iso2 on the 12 curated globe starters
      (regionId "globe" can't resolve a country — see Notes).
- [ ] `src/game/generated-places.ts` — thread `iso2` through `toStarter`.
- [ ] `src/components/game-app.tsx` — collision-map `useMemo` over pool;
      compute label; pass to `<QuestionBubble placeName>` and `<ResultCard>`.
- [ ] `src/components/result-card.tsx` — accept `placeLabel` prop for the
      title (region small-caps line unchanged).
- [ ] `src/game/question-label.test.ts` — unit tests incl. iso2 coverage over
      all 64 chunks; register in `npm test` script.
- [ ] Gates: `npx tsc --noEmit`, `npm test`, `npm run build:pages`
      (runs prebuild: write-build-meta + check-generated-places + lint-cards).
- [ ] Commit + push early and often (named files only, never `git add -A`).
- [ ] Report to coordinator (no merge, no PR — coordinator handles it).

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
