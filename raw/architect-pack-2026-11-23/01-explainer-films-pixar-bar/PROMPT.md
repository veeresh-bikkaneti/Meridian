# 01 — Explainer films at the Disney/Pixar acting bar

## Intent (one line)
Short educational films where Holmes & Watson genuinely *act* the explanation — real character performance, not posed stills with camera moves.

## Why (origin)
Owner, 2026-11-20, on the template-rendered Moon sample: "feeling like a picture collage" → **"if itss not real disney pixar acting, we dont need that."** The posed-still format is rejected outright; the bar is real Disney/Pixar-level character acting or no film at all.

## Scope IN
- A production route that delivers actual acted performance (body + face) for the pair.
- First episode exists as data: "Why does the Moon change shape?" (45 s, script/beats/stills/audio all produced).

## Scope OUT
- Any posed-still / collage / Ken Burns format — rejected by the owner, do not re-pitch.
- Paid per-run cloud rendering presented as "free" (Atlas Cloud was checked: $25 minimum prepaid top-up, no free tier).

## Locked decisions
- Narration voices: production TTS (Chitti reference voice; Holmes `avocado_v2:atlas`, Watson `avocado_v2:pb1_music_02`, speed 100); final mix −16 LUFS.
- The reusable series template (Remotion, data-driven episodes) is built and shelved — it is machinery, not a format approval.
- Measured hardware limit: full Blender animation on this VM ≈ 110 s/frame under software GL → ≈32 h per 45 s episode. Not viable as-is.

## Acceptance criteria
- A route whose per-episode render cost fits this VM (or a clearly priced alternative the owner approves with eyes open).
- A 10-second acted test clip the owner judges against his Pixar bar before any full episode is attempted.

## Assets & related work (in this folder)
- `moon-phases-sample.mp4` — the rejected sample (45.1 s, 1280×720) — judge the gap yourself.
- `TEMPLATE-STATUS.md` — what the shelved template does and its honest limits (no lip sync, no facial-expression channel in the game GLB rigs).
- `explainer-README.md` — the pipeline runbook. `episode.json` — the Moon episode as data.
- Source repo: `~/workspace/explainer-videos/` (branch `template/series-template`).

## Open questions for the architect
1. Is there a credible route to acted performance for these two rigs (motion libraries, retargeting, a different renderer/GPU path) without a 32 h/episode render?
2. If not: what is the smallest honest version of "acting" (e.g. full-body motion-capture clips on a limited move set) that could clear the owner's bar?
3. Should the shelved template be kept, or does a new route make it dead weight?

## Status & evidence
- Moon sample delivered 2026-11-19; template completed 2026-11-20; owner's 👎 verdict 2026-11-20 09:29–09:41 CST. No series production proceeds. Direction pick awaited from the owner.
