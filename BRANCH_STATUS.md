# BRANCH_STATUS — fix/storyteller-tap-start-and-mute

Branch: `fix/storyteller-tap-start-and-mute` · Base: origin/main @ c416187
· Created: 2026-10-10. **PUSH OK, DO NOT MERGE** — merge is the owner's
call, per standing policy. Coordinator handles gates, red-team, and PR.

Owner "Go" 2026-10-10: regression repair — narration is dead on his
phone. Three fixes, separate branch (never #121), PR open, owner merges.

Standing rules: named-file staging only, never `git add -A`. Do NOT
touch: Ko-fi cloud logic, PR #125 assets, auto-animate. Baselines in
`tests/e2e/visual-baselines/main-c416187/` are READ-ONLY — never
overwrite.

## Done (implementation, 2026-10-10)

### Fix 1 — figure tap starts narration from idle (`src/components/storyteller.tsx`)
- `handleFigureToggle`: added the missing branch — idle/failed/ended now
  calls `playNarrationAudio("replay")` (same path the replay button uses;
  "replay" keeps the telemetry trigger vocabulary unchanged, no new type).
  playing→pause, paused→resume unchanged. The early-return no longer
  blocks the start path (audioRef is null on ended/failed/idle).
- `figureLabel`: idle/failed/ended → "Play the story" ("Pause/Resume the
  story" kept). Label feeds GrandpaMascot's aria-label.
- GrandpaMascot unchanged: its tap already calls onToggle; blink-ack
  stays subordinate per the owner's tap choreography ruling.

### Fix 2 — visible mute state (`src/components/storyteller.tsx`)
- Imported `VolumeX` from lucide-react.
- Speaker button renders `<VolumeX>` when `!soundOn`, `<Volume2>` when
  soundOn — purely the indicator; toggle/play logic untouched.
- Root cause of the stale icon: `soundOn` was `useState(() =>
  isSoundEnabled())` snapshot-on-mount only. Added a
  `meridian:sound-change` listener (same channel `setSoundEnabled` in
  `sfx.ts` dispatches, same pattern as storyteller-home.tsx) so the icon
  reflects the live mute state when the global toggle (game-app) flips.

### Fix 3 — reset stale gesture flag after tour-kill (`src/components/storyteller-home.tsx`)
- In the yield effect: when `yielded` goes true and `wasNarrating`
  (`phase === "greeting_audio"`), after `stopAudio()` the effect now sets
  `gestureDoneRef.current = false` so the post-tour follow-up greeting
  can re-arm on the next tap. Reset ONLY on a mid-flight kill — a
  completed greeting keeps the flag consumed (no duplicate greeting).
  Tour-return mode is text-only and `onGesture` returns early there, so
  no interplay risk (verified: the follow-up effect flips mode to
  "greeting" + phase "entering", which re-arms via the greeting_text
  gesture listener).

## Gates (builder pass, 2026-10-10)

- `npx tsc --noEmit` — clean
- `npm test` — 1089/1089 green (node --test, zero fails)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `VITE_KOFI_URL="https://ko-fi.com/thesaltandpepperguy" npm run build:pages` — green

## Pending

- Independent review (Chitti/owner panel) — scrum verdict is the entry
  ticket, not the gate. PR open, never merge (owner's call).

## Verification (coordinator, 2026-10-10 ~20:00 CDT)

### Red-team pass — 2 BLOCKERS found and fixed
- **BREAK 1**: Muted figure tap played audible narration (new idle branch
  had no `isSoundEnabled()` check) — violated the owner's "sound off until
  I say so" ruling. Fixed: added the mute guard in `handleFigureToggle`
  (storyteller.tsx). New test R1: muted tap stays silent (zero requests,
  zero audio elements, icon shows VolumeX).
- **BREAK 2**: Gesture-flag reset fired even after natural end (phase
  lingers "greeting_audio" for POST_AUDIO_HOLD_MS after the clip ends) —
  greeting would replay. Fixed: capture `audioRef.current !== null`
  BEFORE `stopAudio()` nulls it; only reset the flag on a mid-flight kill
  (storyteller-home.tsx). New test R2: post-end tour-kill does NOT replay
  the greeting.

### Black-box journeys — 11/11 green (built dist)
- T1: idle figure tap starts REAL audio (element `paused===false`,
  `readyState≥2`, `currentTime` advancing — not just React state).
- R1: muted tap stays silent (red-team BREAK 1 regression).
- T2: speaker toggle flips Volume2↔VolumeX visibly.
- T3: tour-kill → post-tour tap starts audio (gesture flag re-armed).
- R2: post-end tour-kill does NOT replay greeting (red-team BREAK 2).
- J2/J3: full user journeys (fresh visit → tap → pause → resume).
- J1 (mobile 390px): fresh visit → tap → narration → pause → resume.

### Interaction-matrix re-walk — 4/4 green
- idle → tap starts; playing → tap pauses → tap resumes (element-level);
  failed → tap restarts; ended → tap replays.

### Visual regression — no out-of-scope changes
- 9 key screens at 390px + 1280px vs main-c416187 baselines.
- 2/9 pixel-identical. 5/9 differ by <0.01% (48-49px, anti-aliasing).
- 2/9 larger diffs (game-aim 12%, home-top 55%) are capture-state
  differences (tutorial overlay timing, satellite map tiles) — NOT from
  this PR's changes (aria-label, muted icon, flag reset are invisible in
  these captures).

### Gates (final)
- `npx tsc --noEmit` — clean
- `npm test` — 1089/1089 green (node --test)
- `node scripts/lint-cards.mjs` — GATE PASSED
- `npm run build:pages` — green
- Playwright: 11/11 tapstart specs green on rebuilt dist

### Test-environment note
- T1 initially flaked (`currentTime` stuck at 0): `paused===false` can be
  true while the decoder is starved on a loaded VM. Fixed by gating on
  `readyState ≥ 2` before asserting clock advancement. VM was at 1GB
  available RAM during the flakes.

## Judgment calls

- Reused telemetry trigger "replay" for the figure-tap start (task
  directed; no new trigger type). `narration_replayed` event still fires
  only from the replay button — the tap start emits `narration_started`
  with trigger "replay".
- Did NOT change the speaker button's aria-label ("Hear the storyteller's
  story") — it still plays narration when tapped even while muted
  (manual recovery path, same contract as the home greeting's
  muted-tap hint); the icon change is purely the indicator per scope.
