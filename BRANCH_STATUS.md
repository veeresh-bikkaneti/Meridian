# BRANCH_STATUS.md — fix/audio-rework

## Veeresh's requirements (2026-10-06)
1. [ ] TURN OFF globe spin swish — remove startGlobeSpin/stopGlobeSpin calls (keep API)
2. [ ] NEW: playEditionEntrance() — epic gladiator/Colosseum brass horn fanfare on edition select
3. [ ] FIX: wire playWin/playLose to guess outcomes in regular game (currently win only on first-ever, lose never)
4. [ ] Make win/lose MORE Mario-like: bolder ascending fanfare (right), distinctive descending "death" tune (wrong). Original melodies only.

## Work items
- [ ] sfx.ts: add playEditionEntrance(), rewrite playWin/playLose
- [ ] satellite-map.tsx: remove spin sound triggers
- [ ] game-app.tsx: entrance fanfare in openRun, win/lose on reveal complete
- [ ] Unit tests
- [ ] E2E verification
- [ ] tsc clean, full suite green
- [ ] Open PR

## Notes
- "Mario-like" = STYLE (bouncy arcade), NOT Nintendo melodies. All original.
- All sounds respect meridian.sound mute gate.
