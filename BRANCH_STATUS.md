# BRANCH_STATUS.md — fix/audio-rework

## Veeresh's requirements (2026-10-06)
1. [ ] TURN OFF globe spin swish — remove startGlobeSpin/stopGlobeSpin calls (keep API)
2. [ ] NEW: playEditionEntrance() — epic gladiator/Colosseum brass horn fanfare on edition select
3. [ ] FIX: wire playWin/playLose to guess outcomes in regular game (currently win only on first-ever, lose never)
4. [ ] Make win/lose MORE Mario-like: bolder ascending fanfare (right), distinctive descending "death" tune (wrong). Original melodies only.

## Work items
- [x] sfx.ts: add playEditionEntrance(), rewrite playWin/playLose
- [x] satellite-map.tsx: spin sound triggers removed (safeguard stops kept)
- [x] game-app.tsx: entrance fanfare in openRun, win/lose on reveal complete via dropHitRef
- [x] Unit tests: sfx.test.ts 19/19 pass
- [ ] E2E verification
- [ ] tsc clean, full suite green
- [ ] Open PR

## Notes
- "Mario-like" = STYLE (bouncy arcade), NOT Nintendo melodies. All original.
- All sounds respect meridian.sound mute gate.

## 2026-10-06 23:00 — PR #81 opened
- https://github.com/veeresh-bikkaneti/Meridian/pull/81
- Unit: 19/19 sfx tests pass, full suite fail 0
- tsc clean
- E2E: 6/7 game-sfx pass; 'NO loop texture' test failing (investigating — source change verified in build)
- Ready for Veeresh's review/merge decision
