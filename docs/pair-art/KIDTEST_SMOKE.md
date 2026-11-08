# Kid test — SMOKE results (PR A)

Run: 2026-11-08 · Script: `scripts/kidtest-smoke.mjs` · Plates: `public/assets/detective/pair-art/`

This is the smoke run: automatic measures only, on whatever plates exist today. The human trials (find / identity / expression with 30 kids per cell) run at PR D per `scripts/kidtest-protocol.md`. NOT RUN means the measure could not be taken — never a pass, never a fail, and never a made-up number.

Face-box source: manifest.json face boxes for: holmes-pose-dock.png, holmes-face-neutral.png, holmes-face-focused.png, holmes-face-thinking.png, holmes-face-attentive.png, holmes-face-hushed.png, holmes-face-wonder.png, holmes-face-reading.png, holmes-face-marking.png, holmes-face-delighted.png, holmes-face-surprised.png, holmes-face-pout.png, watson-pose-station-idle.png, watson-face-neutral.png, watson-face-focused.png, watson-face-thinking.png, watson-face-attentive.png, watson-face-hushed.png, watson-face-wonder.png, watson-face-reading.png, watson-face-marking.png, watson-face-delighted.png, watson-face-surprised.png, watson-face-pout.png.

## Plate inventory

| Plate | File | Format | Natural size | Bytes |
| --- | --- | --- | --- | --- |
| holmes-arm-back | holmes-arm-back.png | PNG | 60×120 | 2656 |
| holmes-arm-front | holmes-arm-front.png | PNG | 64×92 | 2335 |
| holmes-arm-raised | holmes-arm-raised.png | PNG | 70×92 | 2314 |
| holmes-face-attentive | holmes-face-attentive.png | PNG | 102×86 | 3897 |
| holmes-face-delighted | holmes-face-delighted.png | PNG | 102×86 | 3822 |
| holmes-face-focused | holmes-face-focused.png | PNG | 102×87 | 3912 |
| holmes-face-hushed | holmes-face-hushed.png | PNG | 102×86 | 3918 |
| holmes-face-marking | holmes-face-marking.png | PNG | 102×87 | 3869 |
| holmes-face-neutral | holmes-face-neutral.png | PNG | 102×86 | 3946 |
| holmes-face-pout | holmes-face-pout.png | PNG | 102×87 | 3972 |
| holmes-face-reading | holmes-face-reading.png | PNG | 102×86 | 3891 |
| holmes-face-surprised | holmes-face-surprised.png | PNG | 102×91 | 4046 |
| holmes-face-thinking | holmes-face-thinking.png | PNG | 102×89 | 3976 |
| holmes-face-wonder | holmes-face-wonder.png | PNG | 102×91 | 3932 |
| holmes-halo | holmes-halo.png | PNG | 240×356 | 3449 |
| holmes-hat | holmes-hat.png | PNG | 73×54 | 2495 |
| holmes-head | holmes-head.png | PNG | 102×86 | 3946 |
| holmes-leg-a | holmes-leg-a.png | PNG | 99×140 | 2620 |
| holmes-leg-b | holmes-leg-b.png | PNG | 99×140 | 3173 |
| holmes-pose-ack | holmes-pose-ack.png | PNG | 240×356 | 15243 |
| holmes-pose-announce | holmes-pose-announce.png | PNG | 240×356 | 16568 |
| holmes-pose-berth-think | holmes-pose-berth-think.png | PNG | 240×356 | 15611 |
| holmes-pose-card-look | holmes-pose-card-look.png | PNG | 240×356 | 15076 |
| holmes-pose-celebrate-jump | holmes-pose-celebrate-jump.png | PNG | 240×356 | 16467 |
| holmes-pose-clap | holmes-pose-clap.png | PNG | 240×356 | 14665 |
| holmes-pose-dock | holmes-pose-dock.png | PNG | 240×356 | 14690 |
| holmes-pose-gaze-up | holmes-pose-gaze-up.png | PNG | 240×356 | 15552 |
| holmes-pose-high-five | holmes-pose-high-five.png | PNG | 240×356 | 16526 |
| holmes-pose-pout | holmes-pose-pout.png | PNG | 240×356 | 18688 |
| holmes-pose-search | holmes-pose-search.png | PNG | 240×356 | 15609 |
| holmes-pose-walk | holmes-pose-walk.png | PNG | 240×356 | 14699 |
| holmes-torso | holmes-torso.png | PNG | 112×194 | 8289 |
| jolly-standing | jolly-standing.png | PNG | 261×338 | 22945 |
| prop-card | prop-card.png | PNG | 53×65 | 807 |
| prop-cup | prop-cup.png | PNG | 34×23 | 805 |
| prop-glass | prop-glass.png | PNG | 55×55 | 878 |
| prop-notebook-pencil | prop-notebook-pencil.png | PNG | 60×65 | 856 |
| silhouette-holmes-104 | silhouette-holmes-104.png | PNG | 43×104 | 2450 |
| silhouette-watson-104 | silhouette-watson-104.png | PNG | 63×104 | 2647 |
| tracker-standing | tracker-standing.png | PNG | 173×338 | 15949 |
| watson-arm-back | watson-arm-back.png | PNG | 80×120 | 2493 |
| watson-arm-front | watson-arm-front.png | PNG | 72×112 | 2381 |
| watson-arm-raised | watson-arm-raised.png | PNG | 66×92 | 2159 |
| watson-face-attentive | watson-face-attentive.png | PNG | 161×84 | 5305 |
| watson-face-delighted | watson-face-delighted.png | PNG | 161×84 | 5246 |
| watson-face-focused | watson-face-focused.png | PNG | 161×85 | 5350 |
| watson-face-hushed | watson-face-hushed.png | PNG | 161×84 | 5352 |
| watson-face-marking | watson-face-marking.png | PNG | 161×85 | 5349 |
| watson-face-neutral | watson-face-neutral.png | PNG | 161×84 | 5399 |
| watson-face-pout | watson-face-pout.png | PNG | 161×85 | 5222 |
| watson-face-reading | watson-face-reading.png | PNG | 161×84 | 5380 |
| watson-face-surprised | watson-face-surprised.png | PNG | 161×89 | 5519 |
| watson-face-thinking | watson-face-thinking.png | PNG | 161×87 | 5382 |
| watson-face-wonder | watson-face-wonder.png | PNG | 161×89 | 5414 |
| watson-halo | watson-halo.png | PNG | 268×280 | 3328 |
| watson-hat | watson-hat.png | PNG | 139×48 | 2455 |
| watson-head | watson-head.png | PNG | 161×84 | 5399 |
| watson-leg-a | watson-leg-a.png | PNG | 159×108 | 3268 |
| watson-leg-b | watson-leg-b.png | PNG | 159×108 | 3879 |
| watson-pose-celebrate-jump | watson-pose-celebrate-jump.png | PNG | 268×280 | 15954 |
| watson-pose-clap | watson-pose-clap.png | PNG | 268×280 | 16064 |
| watson-pose-gasp | watson-pose-gasp.png | PNG | 268×280 | 18829 |
| watson-pose-high-five | watson-pose-high-five.png | PNG | 268×280 | 18640 |
| watson-pose-notebook-mark | watson-pose-notebook-mark.png | PNG | 268×280 | 17784 |
| watson-pose-pout | watson-pose-pout.png | PNG | 268×280 | 16834 |
| watson-pose-read | watson-pose-read.png | PNG | 268×280 | 16595 |
| watson-pose-station-idle | watson-pose-station-idle.png | PNG | 268×280 | 16651 |
| watson-pose-think | watson-pose-think.png | PNG | 268×280 | 16929 |
| watson-pose-walk | watson-pose-walk.png | PNG | 268×280 | 16491 |
| watson-torso | watson-torso.png | PNG | 165×170 | 9834 |

Face plates present (11): attentive, delighted, focused, hushed, marking, neutral, pout, reading, surprised, thinking, wonder. Face HEIGHT is measured below from the manifest faceBox entries (see the per-width table).

## holmes-standing

Figure of record: `holmes-pose-dock.png` (pose plate — no dedicated holmes-standing plate delivered).

| Width | Figure px | Face px | Coverage px² | Verdict per measure |
| --- | --- | --- | --- | --- |
| 390 | 128 render target (band 112–128); 240×356 natural | 31 (faceBox h 0.2416 × 128) | NOT RUN (spec-only measure) | size: READY (rendered rect measured by the spec) · face: FAIL (< 38 floor) · coverage: NOT RUN — owned by tests/e2e/pair-art-kidtest.spec.ts |
| 768 | 144 render target (band 128–144); 240×356 natural | 35 (faceBox h 0.2416 × 144) | NOT RUN (spec-only measure) | size: READY (rendered rect measured by the spec) · face: FAIL (< 44 floor) · coverage: NOT RUN — owned by tests/e2e/pair-art-kidtest.spec.ts |
| 1280 | 160 render target (band 144–160); 240×356 natural | 39 (faceBox h 0.2416 × 160) | NOT RUN (spec-only measure) | size: READY (rendered rect measured by the spec) · face: FAIL (< 48 floor) · coverage: NOT RUN — owned by tests/e2e/pair-art-kidtest.spec.ts |
| 1920 | 176 render target (band 160–176); 240×356 natural | 43 (faceBox h 0.2416 × 176) | NOT RUN (spec-only measure) | size: READY (rendered rect measured by the spec) · face: FAIL (< 52 floor) · coverage: NOT RUN — owned by tests/e2e/pair-art-kidtest.spec.ts |

## watson-standing

Figure of record: `watson-pose-station-idle.png` (pose plate — no dedicated watson-standing plate delivered).

| Width | Figure px | Face px | Coverage px² | Verdict per measure |
| --- | --- | --- | --- | --- |
| 390 | 128 render target (band 112–128); 268×280 natural | 38 (faceBox h 0.3 × 128) | NOT RUN (spec-only measure) | size: READY (rendered rect measured by the spec) · face: PASS · coverage: NOT RUN — owned by tests/e2e/pair-art-kidtest.spec.ts |
| 768 | 144 render target (band 128–144); 268×280 natural | 43 (faceBox h 0.3 × 144) | NOT RUN (spec-only measure) | size: READY (rendered rect measured by the spec) · face: FAIL (< 44 floor) · coverage: NOT RUN — owned by tests/e2e/pair-art-kidtest.spec.ts |
| 1280 | 160 render target (band 144–160); 268×280 natural | 48 (faceBox h 0.3 × 160) | NOT RUN (spec-only measure) | size: READY (rendered rect measured by the spec) · face: PASS · coverage: NOT RUN — owned by tests/e2e/pair-art-kidtest.spec.ts |
| 1920 | 176 render target (band 160–176); 268×280 natural | 53 (faceBox h 0.3 × 176) | NOT RUN (spec-only measure) | size: READY (rendered rect measured by the spec) · face: PASS · coverage: NOT RUN — owned by tests/e2e/pair-art-kidtest.spec.ts |

## What this smoke run does NOT cover

- Rendered figure rects and clue-text coverage: measured by `tests/e2e/pair-art-kidtest.spec.ts` against the built game page (real map, real clue layout).
- Find / identity / expression scores: human trials with kid panellists, PR D, recorded in `docs/pair-art/KIDTEST_RESULTS.md`.

**Smoke verdict: RAN** — numbers above are the measured/computed values for the plates present; every NOT RUN row names its reason.
