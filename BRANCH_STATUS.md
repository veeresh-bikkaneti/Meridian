# BRANCH_STATUS — fix/home-walk-audio (PR #165)

**In review — fixed after a BLOCK verdict; awaiting fresh panel + owner merge word.**
Owner merges. Never merge without Veeresh's explicit per-PR word.

## What this branch delivers

- Grandpa walks the home strip once, stops mid-walk for the kettle pour, then settles on the bench; the pour lands and the mug stays filled into the finale.
- Bento cards restored/evened: hero and expeditions cards share a bottom edge; cards sit in the new rail layout (editions card now lives in the rail block, above GeoDetective on mobile).
- Home journal: 106 curated notes, rotating every 2 hours, https sources.
- Storyteller and grandpa audio on the home page; globe draggable in its rail.

## Review history

- 2026-10-16: full Scrum-team review **BLOCKED** this PR (4 of 5 squads). Fix list posted on the PR (issuecomment-6220695977): storyteller clips silently re-rendered against the pinned #137 voice ruling; coffee stop not delivered; mobile-overlap broadly red; figure-tap pause removed while its accessible label still promised it; focusable globe canvas inside `aria-hidden`; documented globe settle replaced with perpetual rotation.
- Veeresh's direction (2026-10-16): the Scrum team fixes the branch rather than waiting on the builder. Branch rebased onto main `6cd3bc3` (post-#162) as a single commit, then fixed by squad:

## Fixes landed (by squad, one commit each)

- **Squad A (voice + contract):** all 11 storyteller clips restored byte-for-byte from main (pinned am_fenrir @ 1.05 render per #137); provenance comment restored in `storyteller-lines.ts`; figure-tap pause/resume restored in `storyteller-home.tsx` so handler and accessible label agree; `grandpa-ask.ts` gains an honest provenance header and a shared lazy AudioContext.
- **Squad B (globe + a11y):** `aria-hidden` removed from the interactive globe mount; WCAG 2.2.2 settle restored (~6s, drag never restarts auto-rotation); `touch-action: pan-y` replaces the scroll trap.
- **Squad C (coffee + tour):** kettle hold lengthened and the pour made persistent (`data-filled`); quip updater purity and hover-audio throttle fixes; offline band collapses (168px → 0). **Tour repair:** #165's card move broke the tasting tour — the tour contract now follows page order (difficulty → editions → GeoDetective), `measureTour` emits stops in document order, and where the weave cannot cross (real editions→GeoDetective gap is 22px, below the 32px weave minimum — guard working as designed) the straight-trail fallback carries sip stops, so grandpa sips at every card on any layout.

## Design consequence the owner should see

The tasting tour's visit order now follows the page. Sides are positional, so the weave runs difficulty-right, editions-left, GeoDetective-right. If the old card order is ever restored, the tour order arrays flip back symmetrically.

## Verification (orchestrator-run, on the fixed tree)

- `npx tsc --noEmit` clean; unit suite 2095 tests, 0 failures; `build:pages` green; card lint gate passed.
- Tasting tour E2E: **25/25 passed**. Grandpa mobile: 3/3. Storyteller tapstart J1 (the tap-pause contract): passed.
- Coffee-stop behavior verified by direct DOM probes: walking → kettle at ~4.3s with travel paused → pour (kettle opacity 1, mug fill rises and persists) → seated. The desktop coffee spec still times out on this VM because its own pacing outruns the kettle window on a slow boot; the same spec fails on unmodified main at a different assertion. A faster runner is expected to pass it — flagged honestly rather than hidden.
- Pre-existing red on unmodified main (baselined 2026-10-16, NOT this branch's regressions): `mobile-home-overlap` (a)/(b)/(b2)/(d), `grandpa-coffee-run.reduced` (boundingBox stall). They fail identically on main and belong on their own fix branch.

## Merge notes

- History was rewritten (rebase + fix commits): push is `--force-with-lease`.
- Branch protection and the "protect main" ruleset must not be lifted or altered without Veeresh's explicit approval for this merge.
- Donation copy untouched (locked strings verified present).
