# World wars movie notes

Clips in `clips.json` order. Each movie is a local render of that clip's still and narration. The files stay in `docs/scaling/journals/world-wars/render-out/`. `public/videos/journal-manifest.json` is unchanged. `buildGate` stays `closed`.

The player file named in `clips.json` is `public/videos/journals/world-wars/<clip>.mp4`. Those files are absent from this repo. `CardFilm` keeps the still when the movie is missing.

No background bed was available. Silence fills the seconds after the narration. The script prints `bed: none`.

Loudness is an ebur128 gain toward -18 LUFS, then a limiter at linear 0.831 (about -1.6 dB). That headroom keeps the encoded peak at or under -1 dB. The gain below is from the narration padded to 10 seconds.

## school-morning

- Still `public/images/journals/world-wars/school-morning.webp`
- Narration `docs/scaling/journals/world-wars/render-out/school-morning.mp3`
- Movie `docs/scaling/journals/world-wars/render-out/school-morning.mp4`
- Gain +0.20 dB from -18.2 LUFS. Source peak -1.4 dBFS.

```
ffprobe -v error -show_entries format=duration:stream=codec_name,codec_type,width,height,pix_fmt,avg_frame_rate,nb_frames,sample_rate,channels -of json docs/scaling/journals/world-wars/render-out/school-morning.mp4
```

duration 10.000000. h264, 1152x768, yuv420p, 24/1, 240 frames. aac, 48000 Hz, mono, 470 frames.

```
ffmpeg -v error -i docs/scaling/journals/world-wars/render-out/school-morning.mp4 -f null -
```

Exit 0.

```
ffmpeg -hide_banner -nostats -i docs/scaling/journals/world-wars/render-out/school-morning.mp4 -af ebur128=peak=true:framelog=quiet -f null -
```

I -18.0 LUFS. True peak -1.6 dBFS.

Frames at 2 s, 6 s, and 9.5 s are the school still. The 6 s frame is a closer crop with darker edges. No new objects. No text.

## quiet-hour

- Still `public/images/journals/world-wars/quiet-hour.webp`
- Narration `docs/scaling/journals/world-wars/render-out/quiet-hour.mp3`
- Movie `docs/scaling/journals/world-wars/render-out/quiet-hour.mp4`
- Gain +0.30 dB from -18.2 LUFS. Source peak -1.3 dBFS.

```
ffprobe -v error -show_entries format=duration:stream=codec_name,codec_type,width,height,pix_fmt,avg_frame_rate,nb_frames,sample_rate,channels -of json docs/scaling/journals/world-wars/render-out/quiet-hour.mp4
```

duration 10.000000. h264, 1152x768, yuv420p, 24/1, 240 frames. aac, 48000 Hz, mono, 470 frames.

```
ffmpeg -v error -i docs/scaling/journals/world-wars/render-out/quiet-hour.mp4 -f null -
```

Exit 0.

```
ffmpeg -hide_banner -nostats -i docs/scaling/journals/world-wars/render-out/quiet-hour.mp4 -af ebur128=peak=true:framelog=quiet -f null -
```

I -18.0 LUFS. True peak -1.6 dBFS.

Frames at 2 s, 6 s, and 9.5 s are the clearing still. The 6 s frame is a closer crop with darker edges. No new objects. No text.

## Listen

Veeresh's listen is the final check. This pass cannot judge the narration by ear.
