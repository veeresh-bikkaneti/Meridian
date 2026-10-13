# BRANCH_STATUS — fix/storyteller-entering-tap (2026-10-13)

**PUSH OK, DO NOT MERGE** — owner merges.

## What this fixes (plain language)

On the home page the storyteller sat in `data-phase="entering"` for as long as the "New to Meridian?" invite was up. `started` stayed false, so the 150ms beat that leaves `entering` never ran. Tapping the mascot fell through to a poke line, and that line only renders after start — the click did nothing and narration never armed.

## What changed (files)

- `src/components/storyteller-audio-guards.ts` — `decideEnteringFigureTap`. A figure tap during `entering`, or before start, starts the greeting. In-flight audio and the send-off are left alone.
- `src/components/storyteller-home.tsx` — that tap releases the invite lock and plays the greeting on the gesture (text-only when sound is off or the clip is not ready). The entering timer ignores itself if a tap already settled the beat. A 2s watchdog leaves `entering` if the 150ms timer never fires. Re-entering `entering` (tour-return follow-up) can settle again.
- `src/components/storyteller-audio-guards.test.ts` — four cases for the new decision.
- `tests/e2e/storyteller-entering-tap.mobile.spec.ts` — mobile proof: invite up, phase is `entering`, figure tap leaves `entering` and shows today's greeting.

## What was verified

- [x] Storyteller unit tests — 43/43 (`storyteller-audio-guards.test.ts` + `storyteller-home.test.ts`)
- [x] `npx tsc --noEmit` — clean
- [x] `npm run build:pages` — green
- [x] New mobile E2E — 1/1. Before tap: phase `entering`, invite visible. After figure tap: phase left `entering`, caption is today's greeting.
- [x] Existing invite specs (`storyteller-home.mobile.spec.ts -g invite`) — 3/3. Dismiss-as-gesture, no audio under a tour, no mp3 under the text-only return line.
- [ ] `npm test` full suite — not run
- [ ] Rest of the storyteller Playwright folder — not run

## Deliberately NOT changed

- Greeting still does not auto-start while the invite is up. Only a mascot tap or "Not now" starts it. The 2s watchdog does not run until `started` is true, so an untouched invite still sits in `entering`.
- Tour-return stays text-only. Mute still does not auto-play.
- No CSS change.

## Pending

- [ ] Full unit suite and the rest of the storyteller E2E folder
- [ ] Owner sign-off: a mascot tap while the invite is up shows the greeting on the same screen as the invite
- [ ] Owner merge

**Ready to merge? NO** — full suite still open. The new path is proven on one mobile E2E plus the three invite regressions.
