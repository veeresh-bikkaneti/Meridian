# Great leaders clips

STATUS: BLOCKED

The goal was to show the three KEEP clips with a still, the real caption, and narration, and to leave every CUT row out. Stills and captions are wired. Narration audio and the clip mp4s are not, because the local Kokoro ONNX cache is missing and nothing was downloaded.

## SHAs

- Base: `8eb34cb4305719f88ef8c2568e4dd624cbaf8608` (`origin/main`).
- Parent not carried: `0487d67db0b7f9fbcae818cfe27cdf237f07040d` (dirty `mockup/scale-play`).
- Stills branch commit: `f291891b7c0177890699f020ccde48f799661b92`.
- Video branch commit: filled after the video commit.

## Method

Screenplays first. Then stills, caption files, and Play Lab wiring. `CardFilm` is reused and was not edited. Narration text is the caption cues joined with single spaces. A node test reads the `.vtt` files and compares them character for character.

Play Lab is not on `origin/main`. The committed Play Lab tree from the parent SHA was added so the Lincoln placeholder could be replaced. Uncommitted mockup dirt was not added. That dirt included the math subject screen, why-learn films, and Docker edits.

## Clips

Built (still and caption, no audio file):

- `great-leaders:lincoln-memorial`
- `great-leaders:jhansi-fort`
- `great-leaders:netaji-bhawan`

Cut, not built:

- `great-leaders:mlk-memorial`

## Tools

- ffmpeg and ffprobe, local.
- Node checks listed in `docs/branch-status/feat-journal-great-leaders-clips.md`.
- Kokoro was not run.

## Money

0. No paid API. No download.

## PRs

- Stills draft against main: https://github.com/veeresh-bikkaneti/Meridian/pull/447
- Video draft against the stills branch: filled after the draft PR exists.

## Council

NOT RUN

## Listen list

No audio file exists. Veeresh cannot do the ear check yet. The words that would be spoken, and nothing else, are:

- Hey kids, have you heard about this place? Washington, D.C., 1922. Thirty-six columns outside. Inside, Lincoln sits, carved in marble.
- Hey kids, have you heard about this place? Queen Lakshmibai ruled Jhansi for her young son.
- Hey kids, have you heard about this place? Netaji Subhas Bose lived here. He made the greeting 'Jai Hind' famous.

## Defects

1. Narration BLOCKED. Missing path: `C:\Users\veere\.cache\huggingface\transformersjs\onnx-community\Kokoro-82M-v1.0-ONNX\onnx`. Also missing: `kokoro-js` from `C:\Users\veere\workspace\aidemo-pilot\engine`. `/opt/hatch/bin/tts` is absent. The only Kokoro cache on disk is `C:\Users\veere\.cache\huggingface\hub\models--hexgrad--Kokoro-82M` (`kokoro-v1_0.pth`, `af_heart.pt`, `bf_emma.pt`). That is not the offline kokoro-js path, so it was not used.
2. No clip mp4. No `meridian-media` checkout. Renders would go to the gitignored `docs/scaling/journals/great-leaders/render-out/`.
3. A pipeline probe, not a clip, was rendered from the Lincoln still plus a 220 Hz sine. Rechecked with ffprobe and a full decode. Duration 10.000000, h264 1152x768, 24/1, aac 48000 Hz stereo. Full decode exit 0. Frames extracted at 2 s, 6 s, and 9.5 s. True peak -1.2 dBFS. Integrated loudness -2.7 LUFS, which is the limited sine, not speech mastered to -18 LUFS. The script prints `no bed`. The probe stays gitignored. See `video-attempt.md`.
4. The three stills are new paintings. No existing watercolor matched these places. They are flat shapes, not the detailed storybook wash used by the 106 journal pictures. No text is drawn. The Lincoln still shows a seated figure in the chair between columns.
5. Lincoln's old step-two explanation said he was carved in 28 blocks of Georgia white marble. That sentence is not in the caption. It now quotes `Inside, Lincoln sits, carved in marble.`
6. `card-film.tsx` was not changed, so the reduced-motion still path was not re-run in a browser. The component already returns `stillUrl` when reduced motion is on.
