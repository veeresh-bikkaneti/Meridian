# BRANCH_STATUS — fix/grandpa-ask-connect-chain (issue #189)

**State: fix built + gated. NOT ready to merge — the full review pipeline
and the owner's merge word are still owed** (standing rule: the panel
approves the final tip itself).

Base: `origin/main 1ac7aaf`. Files changed (5): `src/components/grandpa-ask.ts`,
`src/components/grandpa-ask.test.ts` (new), `tests/e2e/sfx-stub.ts` (comment
only), `docs/handbook/04-audio-and-tts.md`, this file.

## The bug

`src/components/grandpa-ask.ts` `playCough()` wired its Web Audio graph with
one chained expression:

```ts
src.connect(filter).connect(gain).connect(ctx.destination);
```

`AudioNode.connect()` returns the destination node in modern browsers, but
returns `undefined` on old Safari (WebKit bug 188834 — iOS/desktop Safari 11).
A chain consumes that return value, so on old-Safari semantics the second
`.connect` is called on `undefined` and throws
`TypeError: Cannot read properties of undefined (reading 'connect')` —
uncaught, from grandpa's walking effect, seconds after Home loads.

- **Introduced by PR #165** (commit `13347ae`, 2026-10-16) — the file's
  first commit; the first code ever to chain `connect()`.
- **Census:** 52 `connect()` sites in `src/`; this was the ONLY one that
  consumed the return value. `sfx.ts`'s 49 are unchained statements inside
  try/catch-wrapped functions (fail-soft by construction).
- `playCough()` also had **no try/catch**, and `getSharedCtx()` constructed
  its context unguarded — the only audio code in the repo without the
  fail-soft armor.

## Blast radius

- **Modern browsers: unaffected** — proven during the investigation with an
  unstubbed boot of the production build (zero page errors; native
  `connect()` returns the destination node).
- **Old Safari (iOS ≤11-era devices): real exposure.** The throw is uncaught
  on Home; the observability handler captures it and reports a `js_error`
  (payload verified in the investigation repro). Whether any real player has
  hit it in prod is unverified (would need worker/Discord records).

## The fix (exactly the investigated proposal)

1. **De-chained** the graph into three statements
   (`src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);`)
   with a comment at the site: `connect()` returns undefined on old Safari —
   never chain it.
2. **Fail-soft hardening**, mirroring sfx.ts's house rule ("Audio
   unavailable — every play call is a silent no-op"): `playCough()`'s body is
   wrapped in try/catch; `getSharedCtx()`'s `new Ctx()` is guarded the same
   way and returns null on failure. No behavior change on healthy browsers.
3. **`tests/e2e/sfx-stub.ts`: comment only.** Its fake `connect()` returning
   undefined is DELIBERATE — it simulates old-Safari semantics and is the
   only reason this bug was caught. The comment says so, at the
   FakeAudioContext class. Stub behavior unchanged.
4. **New unit test** `src/components/grandpa-ask.test.ts` in the repo's
   fake-context style: an old-Safari fake whose `connect()` returns
   undefined; asserts `playCough`/`playTrail` do not throw and the source's
   `start()` is called.
5. **Handbook** `docs/handbook/04-audio-and-tts.md` §5: the "Never crashes,
   never blocks" rule now names `grandpa-ask.ts` explicitly (it was written
   for sfx only), plus a "Never chain `connect()`" rule recording the lesson.

## Discrimination evidence (the pins fail pre-fix, pass post-fix)

- **Unit test:** pre-fix run — 2 tests, **0 pass / 2 fail**, both with the
  exact production TypeError, stack pinned to `grandpa-ask.ts:93`
  (`playCough ← playFile ← playTrail`). Post-fix: **2/2 pass**.
- **E2E, pre-fix** (investigation, main `a8105ce`, first-hand):
  motionmaxxing **6/6 failed**, cleared-mode applause pair **2/2 failed**,
  all with the `.connect` signature in the traces.
- **E2E, post-fix** (this branch's build, serial `--workers=1`, Ko-fi env):
  - cleared-mode.spec.ts: **11/11 passed** — the applause pair (medium
    applause Easy, grand fanfare Hard) is green with no spec changes.
  - motionmaxxing.spec.ts: **5/6 passed**. The one failure is "tap storm"
    (spec:145), and it is NOT the audio crash — see below.

### The tap-storm failure, adjudicated honestly

Tap storm failed 3× at the 90 s test timeout with a **fully rendered,
healthy Home** in the failure snapshot and **zero** occurrences of the
`.connect` signature in its error context. A timed probe replaying the
test's exact steps (throwaway spec, since removed) **passed every one of
the test's assertions** and showed where the budget goes: the first State
click navigates in 1.1 s; clicks 2–12 then each burn their **full 5.0 s
timeout** (the button is gone after navigation; the test catches and
continues by design) = 55 s; the mascot phase repeats the pattern
(~47 s). Total 109.2 s > the 90 s budget. The behavior the test asserts is
correct; the test's redundant clicks deterministically consume their full
timeouts on this VM, so the test cannot finish inside its own budget here.
This is a pre-existing test-design fragility (the same pacing family as the
documented tapstart flakes), NOT a regression of this fix — the diff
touches only the cough's graph wiring, and the test could not pass pre-fix
either (it died on the crash). Recorded here for the panel; the claim in
this branch record is 5/6 + adjudication, not 6/6.

## Gates (final tip, Ko-fi env at build + test, E2E serial under the lock)

- `npx tsc --noEmit` — **clean**
- `npm test` — scripts **799 (790 pass / 9 skip / 0 fail)** + src
  **1368 pass / 0 fail** (1366 on main + the 2 new grandpa-ask tests)
- `node scripts/lint-cards.mjs` — **GATE PASSED**
- `npm run build:pages` — **green**
- E2E — cleared-mode **11/11**; motionmaxxing **5/6** (tap storm adjudicated
  above)

## Ready to merge?

**NO** — full review pipeline on this tip + the owner's word.
