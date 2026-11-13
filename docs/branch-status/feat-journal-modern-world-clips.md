# Branch status for feat/journal-modern-world-clips

Base is `8eb34cb4305719f88ef8c2568e4dd624cbaf8608` on `origin/main`. The dirty `mockup/scale-play` worktree was stashed and stayed off this branch.

## Done

- Screenplays for `modern-world:greenwich-zero`, `modern-world:liverpool-manchester`, and `modern-world:hearts-content-cable`.
- Storybook stills, captions, and local Kokoro narration. The caption matches the narration character for character.
- Play Lab shows those three clips with CardFilm, the caption, and the wav. `getInteractiveSpec` stays null for them. `card-film.tsx` matches the base.
- Stills draft PR is https://github.com/veeresh-bikkaneti/Meridian/pull/445
- `scripts/journal-still-motion.mjs` on `feat/journal-modern-world-clips-video` renders each still to a local 10 second film. Probe numbers are 10.000000 s, 1152x768, 24 fps, h264 and AAC, decode exit 0. Loudness is -18.1, -18.0, and -18.0 LUFS. Peaks are -4.2, -4.1, and -4.3 dBFS.
- Video draft PR is https://github.com/veeresh-bikkaneti/Meridian/pull/455 and targets the stills branch.

## Still open

- The mp4 files stay in `docs/scaling/journals/modern-world/render-out/`, which git ignores.
- Veeresh still needs to listen. This pass did not judge the voice by ear.
- Council was not run.

## Resume

```
git fetch origin
git switch feat/journal-modern-world-clips-video
```

Media commit `edf602436c395351815477cbd412a1a12ea511de`. Play Lab commit `4a8ca6c3b435c8c2bb432c5b2a7aa1634b86a9eb`. Earlier status commit `0779904ed29240bcaca06244992a4c13e1452336`. Renderer commit `a1a919686c7fe0a15ec6a54e80df0e25a5412d01`.
