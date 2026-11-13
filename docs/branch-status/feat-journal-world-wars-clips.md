# feat/journal-world-wars-clips

A child can open school-morning and quiet-hour in Play Lab and see that clip's still, place name, and caption. The two cut drafts stay out.

## Done

- Screenplays for school-morning and quiet-hour.
- Still pictures under `public/images/journals/world-wars/`.
- `JournalStillPanel` uses `CardFilm` for the picture. Reduced motion, save-data, low memory, and a failed film load keep the still. `card-film.tsx` was not edited.
- Play Lab treats `world-wars:school-morning` and `world-wars:quiet-hour` as ready. They do not show Coming soon, and they have no quiz.
- Narration was rendered locally for both captions. The files are not in git. They sit in `docs/scaling/journals/world-wars/render-out/` on the machine that rendered them. Voice id `am_fenrir`. No background bed.

## Next

1. Branch `feat/journal-world-wars-clips-video` from this branch.
2. Render the 10 second movies with `scripts/journal-still-motion.mjs`.
3. Open a second draft pull request whose base is this branch.

## Open questions

- The narration files are not committed. No existing public audio path serves this kind of clip. Say to commit `public/audio/journals/world-wars/school-morning.mp3` and `quiet-hour.mp3` if the player should fetch them.
- The stills are soft washes of a school and a clearing. They are not the painted storybook drawings used for the place journal. Say to replace them if you want that match.
- Listen to both narration files. Nobody here can check them by ear.

## Ruled out

- `christmas-truce` and `letters-home`. Do not build them and do not narrate them.
- A second film fallback. `CardFilm` already has one.
- Movies in this repo.
- A paid image or video model.
- Cloning `meridian-media`. It was not already on disk.

## Resume

```
git fetch origin
git checkout feat/journal-world-wars-clips
node --experimental-strip-types --test src/play-lab/play-lab.test.ts src/play-lab/journal-still.test.ts
```

Worktree for the render files: `docs/scaling/journals/world-wars/render-out/`. That folder is gitignored.
