# Phase 1 slice 1: audio port + ClueScene

Branch: `feat/phase1-audio-clue-scene`, off `origin/main`
`7bc4d8f2adb147816f309e1f4a5b0d38c4090dde` (PR #548 merged).
Tier 2 (new module, API/storage class per AGENTS.md §3). Cap 400k tokens,
shared by lead and helpers. Estimate 120k–180k (estimate, no meter).

## Capsule (§F)

TASK / requested outcome: one place owns browser audio I/O. A typed port
in `src/platform/audio/` wraps the existing voice channel; ClueScene (the
shared subject component) plays its act-3 summary narration through the
port instead of calling `new Audio(` itself. No player-visible change.

Interpretations considered and selected reading: slice 1 only — ClueScene
is the one screen that moves. Storage and JSON transport ports, and the
other seven files that call `new Audio(`, are later slices.

Done condition / evidence:
- Contract tests for the port pass against the in-memory fake and the
  browser implementation (same suite, two drivers).
- ClueScene behaves the same; Playwright spec
  `tests/e2e/math-clue-scene.desktop.spec.ts` (pins the act-3 summary:
  `data-summary`, the play control, standing text) passes, `--workers=1`.
- The one baseline entry `src/subjects/shared/ClueScene.tsx|new Audio()`
  is removed from `eslint/layer-baseline.json`; `npm run lint:arch` and
  `scripts/layer-baseline.test.mjs` pass.
- All §9 gates plus `lint:nav`, `lint:subjects`, `check:provenance`,
  `check:entry-size` pass or are reported NOT RUN with a reason.

Files and interfaces in scope:
- New: `src/platform/audio/voice.ts`, `browser-voice.ts`, `fake-voice.ts`,
  `use-voice.ts`, `voice.contract.test.ts`, `use-voice.test.ts`.
- Edited: `src/subjects/shared/ClueScene.tsx`,
  `src/subjects/shared/clue-scene.test.ts` (one source pin moves to the
  port), `eslint/layer-baseline.json` (one entry removed), this file.
- Out of scope: every other `new Audio(` caller (including
  `src/subjects/shared/SubjectCase.tsx`), `package.json`, storage and
  transport ports, any other lane's files.

Dependencies / ordering: contract tests first (failing), then the port,
then the ClueScene migration, then gates, then panel review.

Verification contract: targeted tests locally per AGENTS.md §4; CI carries
the full suite. Playwright: only the named spec.

Assumptions, risks, unknowns: the port's handle is single-use (ClueScene
creates one performance at a time and never replays an element), matching
today's create-per-performance code.

Simpler or rejected approach: leaving the mute/visibility gates in
ClueScene — rejected in the arena (below); the gates are the port's job,
as in `summary-celebration-line.ts`'s centralised gate.

Budget: cap 400k total. Allocations: arena 2×~10k, tests ~25k,
implementation ~35k, migration ~25k, panel ~30k, lead the rest.

Approvals needed: none to build or open a draft PR (the assignment asks
for one). Merge is Veeresh's, on the synced head SHA.

## Facts, re-run on 7bc4d8f2 [tested]

- `grep -rl "new Audio(" src --include='*.ts' --include='*.tsx' | grep -v .test.`
  → 8 files, 10 call sites: comet-greeting.tsx ×2, grandpa-ask.ts,
  storyteller-home.tsx ×2, storyteller.tsx, summary-celebration-line.ts,
  detective-audio.ts, ClueScene.tsx, SubjectCase.tsx. The lane brief
  listed 7 files from cbc119c; SubjectCase.tsx is the extra file on this
  main. It is not part of slice 1.
- ClueScene has exactly one baseline entry:
  `src/subjects/shared/ClueScene.tsx|new Audio()` in `noRawIo`, and none
  in `noUpwardImport` (read from `eslint/layer-baseline.json` at base).
- Open PRs at start: #549 and #546 (ci-required), #547 (read-aloud
  modal), #545 (stale lint-arch draft). None touches ClueScene,
  `src/platform/**`, or this slice's baseline entry (checked via each
  PR's file list).

## Statechart (the port's one lifecycle)

```text
createVoice returns null — no handle, no claim — when any gate is shut:
sound off, tab hidden, channel busy and the claim is not user-initiated,
or no Audio constructor exists (SSR).

            createVoice (gates pass, claim won)
  (none) ───────────────────────────────► idle
  idle ──play()──► loading ──canplay──► ready ──playing──► playing
  loading ──playing──► playing            (ready may be skipped)
  loading/ready/playing ──ended──► ended        claim released, onEnded
  loading/ready/playing ──error, or play() rejected──► error
                                                  claim released, onError
  idle/loading/ready/playing ──channel stop──► interrupted
                                                  element paused, onInterrupted
  any live state ──stop()──► aborted      pause, clear src, release claim,
                                            no callbacks; idempotent
  ended / error / interrupted / aborted are terminal: play() is a no-op.
```

Reduced motion: creating a voice never starts playback. Play begins only
on an explicit `play()` call, so a caller's reduced-motion and read-aloud
gates keep their current meaning; a tapped play under reduced motion
still plays, as today.

## Architect: layers and import direction

| File | Layer | Imports (all point down) |
| :--- | :--- | :--- |
| `src/platform/audio/voice.ts` | 3 platform | types only, no runtime imports |
| `src/platform/audio/browser-voice.ts` | 3 platform | `src/game/audio/voice-channel.ts`, `sfx.ts`, `play-guards.ts` (layer 2) |
| `src/platform/audio/fake-voice.ts` | 3 platform | `voice-channel.ts` (layer 2), `./voice.ts` |
| `src/platform/audio/use-voice.ts` | 3 platform | `react` (package), `./voice.ts`, `./browser-voice.ts` |
| `src/subjects/shared/ClueScene.tsx` | 5 feature | `../../platform/audio/use-voice` (layer 3) |

## Arena record (two workers, one option each per choice; lead picks)

- C1, where the mute/visibility gates live. Both workers: inside
  `createVoice`, returning null when gated. **Picked.** ClueScene already
  treats a null claim as "run on captions"; the celebration-line player
  centralises the same gates for the same reason (a gate a screen can
  forget is a bug waiting). Behaviour is unchanged: the checks run at the
  same moment, at performance start.
- C2, element abstraction. Both workers: a structural minimal interface
  plus an injectable `createAudio` dep, mirroring
  `CelebrationAudioElement`. **Picked.** One contract suite then runs
  against both implementations in `node:test`, with no DOM and no
  `globalThis.Audio` stub.
- C3, the hook. Split: one worker had ClueScene call `createVoice`
  directly; the other had it consume `useVoice`. Both put the hook in
  `src/platform/audio/` (layer 4 `src/hooks/` may not do I/O itself).
  **Picked: ClueScene consumes `useVoice`.** The lane brief names the
  hook as the screen-facing surface ("One hook, useVoice, for screens"),
  and the hook owns the unmount release the brief requires. The hook is
  imperative — `play(src, opts)` returns whether audio started, `stop()`,
  `currentTime()` — so ClueScene's performance logic (perf-id guards,
  caption timers, the safety timer) keeps its exact shape.

## Graph (§7: nodes/edges for the integrator; this branch does not edit graph.json)

- Add node: platform audio port (`src/platform/audio/`), layer 3.
- Add edge: `src/subjects/shared/ClueScene.tsx` depends-on the audio port.
- Add edge: the audio port depends-on `src/game/audio/voice-channel.ts`.

## Status

- Done: base verified, facts re-run, lane collision check, capsule,
  statechart, arena; port built, ClueScene migrated, gates green on the
  old base; slice synced onto main
  `730d76b800865f2ea6af6d336cd1f7656bfc340b`.
- Baseline: main's `eslint/layer-baseline.json` still carried the
  ClueScene `new Audio()` entry; removed exactly that one line.
- Next: panel review pending.
- Open questions: none.
- Ruled out: touching SubjectCase or any other audio caller in this PR;
  editing `package.json`; a state-subscription API on the handle
  (callbacks plus a `state` getter cover the contract tests and the one
  caller).
