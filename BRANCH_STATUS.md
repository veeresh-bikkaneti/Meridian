# BRANCH_STATUS — fix/storyteller-poke-dismiss (2026-10-14)

**PUSH OK, DO NOT MERGE** — owner merges. Rebased onto main after #152.

## What this fixes

After the home greeting, the next mascot tap should show a poke line (text only). It was replaying `greet-0N.mp3` instead. The dismiss click's pointerdown starts the clip before React leaves `greeting_text`, so the dismissed flag never stuck.

#152's entering-tap and 600ms debounce stay. This commit only adds the dismiss snapshot.

## What changed

- `src/components/storyteller-audio-guards.ts` — `shouldMarkGreetingDismissed` next to #152's helpers.
- `src/components/storyteller-home.tsx` — dismiss snapshots the live element and the existing `phaseRef` before `stopAudio` clears them.

## Not changed

- Poke copy stays text-only. No AudioContext.
- Tour-return dismiss still does not burn the greeting.
- An unheard greeting that the kid did not dismiss still replays.
- #148's `tap\u00A0Try again` notice is not this branch.

A dismissed greeting stays off the figure tap. "Hear again" under the figure replays that clip and puts the greeting line back.

## Pending

- [x] `npx tsc --noEmit` — clean
- [x] `npm run build:pages` — green
- [x] Playwright — full `storyteller-home.mobile.spec.ts` 23/23, including both pokes and Hear again
- [x] Follow-up taps play `poke-01` then `poke-02` (am_fenrir, same voice as the greeting)
- [ ] Owner merge

**Ready to merge? Owner's call.** Sits on #152. #148's nbsp notice is not here.
