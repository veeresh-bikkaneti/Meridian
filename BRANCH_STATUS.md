# BRANCH_STATUS — fix/storyteller-entering-tap (2026-10-13)

**PUSH OK, DO NOT MERGE** — owner merges.

## What this fixes (plain language)

On the home page the storyteller sat in `data-phase="entering"` for as long as the "New to Meridian?" invite was up. `started` stayed false, so the 150ms beat that leaves `entering` never ran. Tapping the mascot fell through to a poke line, and that line only renders after start — the click did nothing and narration never armed.

## What changed (files)

- `src/components/storyteller-audio-guards.ts` — `decideEnteringFigureTap`. A figure tap during `entering`, or before start, starts the greeting. In-flight audio and the send-off are left alone.
- `src/components/storyteller-home.tsx` — that tap releases the invite lock and plays the greeting on the gesture (text-only when sound is off or the clip is not ready). The entering timer ignores itself if a tap already settled the beat. A 2s watchdog leaves `entering` if the 150ms timer never fires. Re-entering `entering` (tour-return follow-up) can settle again.
- `src/components/storyteller-audio-guards.test.ts` — four cases for the new decision.

## What was verified

- [x] `node --experimental-strip-types --test src/components/storyteller-audio-guards.test.ts` — 27/27
- [ ] `npx tsc --noEmit` — not run here (no `node_modules` in this checkout)
- [ ] `npm test` — not run here
- [ ] `npm run build:pages` — not run here
- [ ] Playwright storyteller specs — not run here

## Deliberately NOT changed

- Greeting still waits for the invite to clear before it auto-starts. Only a mascot tap (a real gesture) starts it early.
- Tour-return stays text-only. Mute still does not auto-play.
- No CSS change. The stuck phase was JavaScript, not a transitionend hang.

## Pending

- [ ] Full unit suite, typecheck, pages build, storyteller E2E
- [ ] Owner merge

**Ready to merge? NO** — gates above are still open.
