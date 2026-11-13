# feat/journal-world-wars-clips

A child can open school-morning and quiet-hour in Play Lab and see that clip's still, place name, and caption. The two cut drafts stay out.

## Done

- Screenplays for school-morning and quiet-hour.
- Still pictures under `public/images/journals/world-wars/`.
- `JournalStillPanel` uses `CardFilm` for the picture. Reduced motion, save-data, low memory, and a failed film load keep the still. `card-film.tsx` was not edited.
- Play Lab treats `world-wars:school-morning` and `world-wars:quiet-hour` as ready. They do not show Coming soon, and they have no quiz.
- Narration was rendered locally for both captions. The files are not in git. They sit in `docs/scaling/journals/world-wars/render-out/` on the machine that rendered them. Voice id `am_fenrir`. No background bed.

- `scripts/journal-still-motion.mjs` renders a 10.0 s, 1152x768, 24 fps movie from a still and a narration file.
- Local movies for school-morning and quiet-hour are in `docs/scaling/journals/world-wars/render-out/`. Probe numbers are in `docs/scaling/journals/world-wars/movie-notes.md`. No background bed.

- Stills draft pull request: https://github.com/veeresh-bikkaneti/Meridian/pull/446
- Video draft pull request: https://github.com/veeresh-bikkaneti/Meridian/pull/456

## Next

1. Listen to both narration files and both movies.

## Open questions

- The narration files are not committed. No existing public audio path serves this kind of clip. Say to commit `public/audio/journals/world-wars/school-morning.mp3` and `quiet-hour.mp3` if the player should fetch them.
- The stills are soft washes of a school and a clearing. They are not the painted storybook drawings used for the place journal. Say to replace them if you want that match.
- Listen to both narration files. Nobody here can check them by ear.

## Ruled out

- `christmas-truce` and `letters-home`. Do not build them and do not narrate them.
- A second film fallback. `CardFilm` already has one.
- Committing the mp4 files. They stay in the gitignored render folder.
- A paid image or video model.
- Cloning `meridian-media`. It was not already on disk.

## Resume

```
git fetch origin
git checkout feat/journal-world-wars-clips-video
node --experimental-strip-types --test src/play-lab/play-lab.test.ts src/play-lab/journal-still.test.ts
```

Worktree for the render files: `docs/scaling/journals/world-wars/render-out/`. That folder is gitignored.
