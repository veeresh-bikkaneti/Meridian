# Branch status — feat/journal-modern-world-clips

Base is `8eb34cb4305719f88ef8c2568e4dd624cbaf8608` on `origin/main`. The dirty `mockup/scale-play` worktree was stashed and was not committed.

## Done

- Screenplays for `modern-world:greenwich-zero`, `modern-world:liverpool-manchester`, and `modern-world:hearts-content-cable`.
- Storybook stills, captions, and local Kokoro narration. The caption matches the narration character for character.
- Play Lab shows those three clips with CardFilm, the caption, and the wav. No quiz choices. `card-film.tsx` is unchanged.
- Draft PR: https://github.com/veeresh-bikkaneti/Meridian/pull/445

## Not done

- The 10 second mp4 files are the next branch, `feat/journal-modern-world-clips-video`. They are not in Meridian git history.
- Veeresh still needs to listen. This pass did not judge the voice by ear.

## Resume

```
git fetch origin
git switch feat/journal-modern-world-clips
```

Media commit `edf602436c395351815477cbd412a1a12ea511de`. Play Lab commit `4a8ca6c3b435c8c2bb432c5b2a7aa1634b86a9eb`.
