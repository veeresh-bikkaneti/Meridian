# BRANCH_STATUS — fix/storyteller-entering-tap (2026-10-13)

**PUSH OK, DO NOT MERGE** — owner merges.

## What this fixes (plain language)

On the home page the storyteller sat in `data-phase="entering"` for as long as the "New to Meridian?" invite was up. Tapping the mascot did nothing. The first cut of this branch started the greeting on top of the invite, so the line sat on the lead paragraph and was hard to read.

A mascot tap now dismisses the invite the same way "Not now" does (the tour stays seen — owner 2026-10-13), then starts the greeting inside that click. A second tap inside 600ms does not start another clip. The bubble stays in its existing spot under the banner, on a solid plate so the tagline does not show through.

## What changed (files)

- `src/game/tutorial.ts` — `TUTORIAL_INVITE_DISMISS_EVENT`. GameApp already owns "Not now".
- `src/components/game-app.tsx` — listens for that event and runs `onDismissInvite`. Does not start audio.
- `src/components/storyteller-audio-guards.ts` — `decideEnteringFigureTap` plus `isRapidFigureTap` (600ms, same window as a poke).
- `src/components/storyteller-home.tsx` — that tap dismisses the invite, then plays on the gesture. A second tap inside 600ms is ignored. The invite-cleared effect does not start a second clip.
- `src/components/storyteller-home.css` — popover background is opaque `--atlas-bg-1`. Position, size, and dismiss anchor unchanged.
- `tests/e2e/storyteller-entering-tap.mobile.spec.ts` — after the tap the invite is gone and today's greeting is visible.

## Deliberately NOT changed

- "Not now", "Take the tour", tour-return, mute, and poke/replay are the same paths as main.
- Greeting still does not auto-start while the invite is up. The 2s watchdog does not run until `started` is true.
- Popover still hangs below the banner (no reflow, still clear of the sound toggle).

## Pending

- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — scripts 756 pass / 7 skip, src 1226/1226 (1989 tests, 0 failures)
- [x] `node scripts/lint-cards.mjs` — GATE PASSED
- [x] `npm run build:pages` — green
- [x] Entering-tap mobile E2E — invite gone, one greeting clip after a second tap inside 600ms, opaque plate, caption above the tagline
- [x] Invite specs (3) and dismiss × sound-toggle overlap @390 and @360 — green
- [ ] Owner merge

Poke-after-dismiss still fails on `main` (`d7a0fc8`) in this browser. That path was not changed.

**Ready to merge? Owner's call.** This cut does not touch poke, tour-return, mute, or the story-card host.
