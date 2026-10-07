# BRANCH_STATUS.md — fix/comet-audio-format

## Active work
- [x] Re-encode 12 greeting MP3s from 22.05kHz mono to 44.1kHz stereo
- [ ] Open PR

## Context
Veeresh 2026-10-06: "audio says oop and then dies there is no audio output"
Root cause: TTS generated 22.05kHz mono MP3s — some browsers can't decode
past the first frames. Re-encoded to standard 44.1kHz stereo for max compat.
