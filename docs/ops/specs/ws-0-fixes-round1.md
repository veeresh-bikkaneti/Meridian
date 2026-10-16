# ws-0 fixes, round 1 (from the DIFF REVIEWs of 4742ce6..7d57d7b)

Authoritative inputs: ARCH-REVIEWER verdict APPROVE-WITH-NITS, UX-REVIEWER verdict BLOCK (for turning the flag ON; fixes below clear it).
Execution: WORKER does section A-C only (code + docs; gates: `npx tsc --noEmit`, `npm test`, `node scripts/lint-cards.mjs`). The WORKER must NOT run `npm run build*` or Playwright (a full E2E run is reading dist/client). QA does section D afterwards.
Constraints: no LLM near place data; frozen Scout/map files untouched; no new storage keys / query params / window globals; never the word "lite"; stage nothing (orchestrator does git).

## A. src/components/run-start-notice.tsx
A1. `BOX`: change `border border-line` to `border border-fg/30` and `text-sm` to `text-base`. (Keep every other class.)
A2. Both `<Button>`s get `className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"` (ui/button.tsx has `outline-none`, which hides the global focus ring: WCAG 2.4.7).
A3. The `role="alert"` div gets `onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); error.onKeepPlaying(); } }}`.
A4. Copy (exact):
- band: `${error.label} needs the internet to bring its new places. Ask a grown-up to help you get online, then tap Try again!`
- region: `${sentenceCase(error.label)} needs the internet to bring its places. Ask a grown-up to help you get online, then tap Try again!`
 where `const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);` is a module-level helper (band labels are already capitalised, so apply it to both branches to be safe).

## B. src/components/game-app.tsx
B1. `openRun` catch (the block starting `const message = \`Could not load places for ${regionName}: ...\``): keep `message` EXACTLY as is for `emitEvent` (tests/e2e/crash-watchdog.spec.ts asserts the telemetry text). Change only what is stored for display: `setStartError({ message: staleBuild ? message : \`We couldn't open ${regionName} right now. Check that you're online, then tap it again.\`, staleBuild, edition, regionId, regionName, choice });`
B2. In the picker's `loadNotice` (search `{startError.message} Please try again.`) remove the trailing ` Please try again.` so it renders `{startError.message}` only.
B3. Clear the error when the run moves on: after `dismissStartError`, add
`useEffect(() => { setStartError(null); }, [run?.index, run?.phase]);` (verify `run` is the GameApp state variable in scope at that point; if the hook order/scope does not allow it, STOP and report).
B4. Add `setStartError(null);` as the first statement in `killIdleSession` and in `endTutorial` (setState is stable; no dependency array change).
B5. `startNoticeTarget`: in the region branch use label `target.regionId === "globe" ? "the Globe" : target.regionName`.
B6. Doc comments: put the existing `/** Kid-friendly hints for each learning path, shown under the picker. */` comment back directly above `DIFFICULTY_HINTS`, and give `BAND_LABELS` its own comment `/** Display names of the learning paths, used by the in-run start notice. */`.

## C. docs/feature-flags.md (the `globeTierSplit and offline play` paragraph)
- Say the box appears "near the top of the screen, above the card" (not "on the last card"); the button is "Play the globe"; the picker message is now kid copy ("We couldn't open Globe right now. Check that you're online, then tap it again."); the box stays until "Keep playing", Escape, or the next place is dealt.
- Add: with the flag off, the first Globe run of a page load still waits for `flags.json` (at most 1.5 s on a slow connection, then falls back to the full pool); the pool is unaffected.

## D. QA (after A-C and a rebuild, not the WORKER)
D1. tests/e2e/globe-promotion-offline.desktop.spec.ts: update asserted copy to the new text (A4); add: Escape closes the box and focus is on "Next place"; pressing "Next place" while the box is up clears it; the "Try again" button shows a visible focus ring (computed outline-style != none after Tab).
D2. tests/e2e/globe-tier-split.desktop.spec.ts T4 (and T2): hold the `flags.json` route on a promise released only AFTER the "Play the globe" click, so a resolver that never awaited loadFlags() would fail; assert tiers ["1","2"] and `aim`.
D3. Move the P1 precondition (`toHaveCount(0)` of tier-3/4 requests) to after `reachEasyCelebration`.
D4. src/game/generated-places.test.ts "flag off - every learning path gets the full canonical pool": assert `loadedGlobeTiersForTests()` immediately after the explicit `false` call, before any other load.

## E. Recorded, not fixed (spec §9 additions)
- Pre-existing (boot effect depends on difficultyChoice, run deleted): once fixed, `retryLastOpen` and the docs paragraph must be revisited.
- UX should-fix 5 (nothing explains the picker after "Try again"; mobile scroll) and nit 6 (box overlaps the card's hide button at 390px) and nit 9 (dark-mode edge) are deferred to the owner; A1 adds a stronger border.
- Review sessions in a row can reuse the previous deck (key `globe:review-deck:`), pre-existing.
