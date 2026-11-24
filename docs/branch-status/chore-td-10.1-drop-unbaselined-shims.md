# TD-10.1 — drop the five unbaselined shims

## Capsule

Story: TD-10.1 (Wave 3, unbaselined-shim slice only). Delete the five
one-line `export *` shims #573 left at old paths and retarget their
importers to the canonical files. The four baselined shims
(`pack-shelf-data`, `flag-img`, `tile-fallback-copy`, `DetectivePair`)
and `pack-shelf-data` itself are NOT touched. No behavior change: same
exports, same lazy `GrownUpGate` chunk shape (still `lazy()` + the same
`.then` mapping), same imagery constants.

## Base

Branched from `origin/main` `7dbf62eb3be0976856f174f0725874e03abbaede`
(PR #582 merged; the handoff tip `72b9fa03` had moved). Baseline counts
on this tip, unchanged by this diff: `noRawIo` 10, `noUpwardImport` 129,
`shell-ban` 14 (3 + 0 + 0 + 2 + 9). `eslint/layer-baseline.json` untouched.

## Deleted shims -> canonical

- `src/map/imagery.ts` -> `src/lib/imagery.ts`
- `src/components/summary-celebration-line.ts` -> `src/components/ui/summary-celebration-line.ts`
- `src/components/bounded-text.tsx` -> `src/components/ui/bounded-text.tsx`
- `src/components/age-profile/GrownUpGate.tsx` -> `src/components/ui/GrownUpGate.tsx`
- `src/components/age-profile/ReadAloudButton.tsx` -> `src/components/ui/ReadAloudButton.tsx`

## Retargeted importers

- imagery: `src/routes/credits.tsx`, `src/map/satellite-map.tsx`,
  `src/map/imagery.test.ts` folded into `src/lib/imagery.test.ts`
  (deleted), `src/lib/imagery.test.ts` rewritten to assert the canonical
  values directly (shim-equality test removed).
- summary-celebration-line: `src/components/summary-detective-celebration.tsx`,
  `src/components/summary-celebration-line.test.ts`,
  `src/components/ui/pack-shelf-data-shim.test.ts` (shim cases removed;
  pack-shelf-data shim tests intact).
- bounded-text: `src/components/result-card.tsx`,
  `src/components/scroll-cue.tsx`, `src/components/storyteller.tsx`,
  `src/components/bounded-text.test.ts` (not in the brief's file list;
  real importer found by grep, retargeted and disclosed),
  `src/components/ui/moved-components.test.ts` (shim cases removed;
  `DetectivePair` shim cases intact).
- GrownUpGate: `src/routes/contact.tsx`, `src/components/age-profile/AgeProfileSettings.tsx`
  (both stay lazy).
- ReadAloudButton: no production importer remained;
  `src/components/age-profile/read-aloud-button.test.ts` (not in the
  brief's file list; real importer found by grep, retargeted and disclosed).

Only comments mention the old paths now (`tests/e2e/bounded-text.mobile.spec.ts`,
`tests/e2e/helpers.ts`); both left alone.

## Evidence

- Red first: deleting the five shims made all 7 affected test files fail
  (0/7, `ERR_MODULE_NOT_FOUND`).
- Green after retarget: 37/37 in the six remaining files.
- Gates: tsc, lint:arch, lint:nav, provenance, build:pages, lint-cards
  PASS; entry-size 323,420 B gzip vs 323,865 B limit (445 B spare).

## Open questions

- None. Ready for the Reviewer.
