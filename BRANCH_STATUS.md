# BRANCH_STATUS.md — fix/comet-audio-tap-race

## Active work
- [x] Fix tap-to-start vs tap-to-dismiss race (Bug A)
- [x] Fix stale dismiss timer cutting audio (Bug B)
- [ ] Open PR

## Root cause (Veeresh 2026-10-06: "audio says oop then dies")
User taps bubble → pointerdown starts audio → click dismisses bubble → dismiss() pauses audio.
The tap that starts the greeting kills it ~100-500ms later. No error fires.

Fix:
1. Record audio start time; ignore bubble clicks within 600ms of audio start.
2. Clear stale dismissTimer at top of playGreetingAudio.
