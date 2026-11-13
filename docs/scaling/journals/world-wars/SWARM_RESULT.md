# World wars swarm result

STATUS: ISSUES

origin/main SHA: 8eb34cb4305719f88ef8c2568e4dd624cbaf8608

stills branch SHA: ca5b37329ca082a46b157c3fc6a874f6b790a140

video branch SHA: 6ed70e8f972c3d49b3299aa0c84b1f0ed5e0dd50

The video SHA is the commit that holds the motion script and the loudness fix. This result file is the following commit on `feat/journal-world-wars-clips-video`.

## Method

One ffprobe and one full decode per mp4, in `clips.json` order. school-morning, then quiet-hour.

school-morning:

```
ffprobe -v error -show_entries format=duration:stream=codec_name,codec_type,width,height,pix_fmt,avg_frame_rate,nb_frames,sample_rate,channels -of json docs/scaling/journals/world-wars/render-out/school-morning.mp4
ffmpeg -v error -i docs/scaling/journals/world-wars/render-out/school-morning.mp4 -f null -
```

duration 10.000000. h264, 1152x768, yuv420p, 24/1, 240 frames. aac, 48000 Hz, mono. Decode exit 0. ebur128 I -18.0 LUFS. True peak -1.6 dBFS. Gain +0.20 dB. Limiter 0.831. Bed none.

quiet-hour:

```
ffprobe -v error -show_entries format=duration:stream=codec_name,codec_type,width,height,pix_fmt,avg_frame_rate,nb_frames,sample_rate,channels -of json docs/scaling/journals/world-wars/render-out/quiet-hour.mp4
ffmpeg -v error -i docs/scaling/journals/world-wars/render-out/quiet-hour.mp4 -f null -
```

duration 10.000000. h264, 1152x768, yuv420p, 24/1, 240 frames. aac, 48000 Hz, mono. Decode exit 0. ebur128 I -18.0 LUFS. True peak -1.6 dBFS. Gain +0.30 dB. Limiter 0.831. Bed none.

Frames at 2 s, 6 s, and 9.5 s match the source still for each clip. The 6 s frame is a closer crop with darker edges. No new objects. No text.

Card-film end-to-end test: NOT RUN. `card-film.tsx` was not changed.

## Clips built

- world-wars:school-morning (school-morning)
- world-wars:quiet-hour (quiet-hour)

## Clips cut

- christmas-truce
- letters-home

## Tools used per clip

- school-morning: local still, because no catalog watercolor matched the place. Narration voice id `am_fenrir`, the male storyteller id pinned by `scripts/render-storyteller-voice.mjs`. Magnus and Briggs were not present as local voice ids. Movie via `scripts/journal-still-motion.mjs` and ffmpeg. No background bed.
- quiet-hour: the same tools and the same voice id. No background bed.
- christmas-truce: none.
- letters-home: none.

## Money spent

0

## Draft pull requests

- Stills, base `main`: https://github.com/veeresh-bikkaneti/Meridian/pull/446
- Video, base `feat/journal-world-wars-clips`: https://github.com/veeresh-bikkaneti/Meridian/pull/456

## Council

NOT RUN

## Defects

1. The player asks for `/audio/journals/world-wars/school-morning.mp3` and `/audio/journals/world-wars/quiet-hour.mp3`. Those files are not in the commit. No existing public audio path serves this kind of clip, so the narration stayed in `docs/scaling/journals/world-wars/render-out/`. The audio element has nothing to fetch until those two files are added.
2. The stills are flat washes. school-morning is a school with four windows, a door, and two round trees. quiet-hour is trees around an oval clearing. They are not the painted storybook pictures used for the place journal. No catalog still matched these places.

## What Veeresh must listen to

This pass cannot judge the narration by ear. Listen to these local files:

- `docs/scaling/journals/world-wars/render-out/school-morning.mp3`
- `docs/scaling/journals/world-wars/render-out/school-morning.mp4`
- `docs/scaling/journals/world-wars/render-out/quiet-hour.mp3`
- `docs/scaling/journals/world-wars/render-out/quiet-hour.mp4`
