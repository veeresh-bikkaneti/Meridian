# Pair-Art Asset Lock — PR A (model sheets)

Painted-parts paper-doll for Holmes & Watson, cut from the owner-approved mockup art (keeper: bench still, Cold Trail film register). Engine contract: `DetectivePair.tsx` @ main `9e49da3` — Holmes viewBox 120×178, Watson 134×140, parts rendered at 2 px per viewBox unit.

**Runtime total: 171,918 bytes / 500,000 budget — PASS** · **Decoded: 2.436 MB / 32 MB — PASS** · Palm error (assembled parts, harness, converged cure tip, 2026-11-08): Holmes 0.58 rig px, Watson 2.00 rig px / ≤3 rig px — PASS · Assembly-vs-plate diff: Holmes 0.450, Watson 0.448 / ≤0.60 — PASS · THEN (superseded): Holmes 0.53 / Watson 0.56 rig px (harness, pre-round-2 art), 0.22 / 0.33 before the open-palm repaint; plates then read 0.72 / 0.71 rig px (PIL, cluster-nearest-anchor)

Pose plates and silhouettes are docs/test assets and are excluded from the runtime total.

**Manifest alignment:** `public/assets/detective/pair-art/manifest.json` exports this lock's geometry (per-character natural size, per-face-kind `faceBox`, per-part placement/pivot/palm data) in harness/engine shape — one source, two readers: this lock is the audit record, `manifest.json` is the harness/engine contract. Face-floor measure (≥38/44/48/52 px) reads `faceBox` from the manifest. The manifest also carries a top-level `plates` map (plate filename → `{faceBox}` as fractions of that plate), derived from the per-character data — the shape the kid-test spec and smoke script actually read; the per-character data remains the source of truth. **Face-floor result on the delivered sheets (smoke re-run, 2026-11-08): Holmes BELOW floor in every cell (31/35/39/43 px vs 38/44/48/52); Watson 38/43/48/53 px (768 missed by 1 px). Recorded, not cured — coordinator ruling (f) in `BRANCH_STATUS.md`, as demoted by spec §16.5: the floors are PENDING THE OWNER'S RULING and are NOT binding law until he rules; the §8.3 size band stands; the choice — re-proportion Holmes's head vs amend the floors — is the owner's and is deferred.** (Panel art cure 2026-11-08 did not re-proportion heads; face boxes are unchanged.)

## Runtime files (lazy-loaded by PR B)

| File | Bytes | WxH px | Decoded MB | Placement rect (viewBox x0,y0,x1,y1) |
|---|---:|---|---:|---|
| holmes-hat.png | 2,495 | 73x54 | 0.0158 | [37.5, -1.0, 74.0, 26.0] |
| holmes-leg-a.png | 2,620 | 99x140 | 0.0554 | [35.5, 109, 85, 179] |
| holmes-leg-b.png | 3,173 | 99x140 | 0.0554 | [35.5, 109, 85, 179] |
| holmes-arm-back.png | 2,656 | 60x120 | 0.0288 | [28, 47, 58, 107] |
| holmes-arm-front.png | 2,335 | 64x92 | 0.0236 | [66, 47, 98, 93] |
| holmes-arm-raised.png | 2,314 | 70x92 | 0.0258 | [70.0, 20.5, 105.0, 66.5] |
| holmes-torso.png | 8,289 | 112x194 | 0.0869 | [32.0, 42.0, 88.0, 139.0] |
| watson-hat.png | 2,455 | 139x48 | 0.0267 | [27.5, -1.0, 97.0, 23.0] |
| watson-leg-a.png | 3,268 | 159x108 | 0.0687 | [27, 87, 106.5, 141] |
| watson-leg-b.png | 3,879 | 159x108 | 0.0687 | [27, 87, 106.5, 141] |
| watson-arm-front.png | 2,381 | 72x112 | 0.0323 | [13, 43, 49, 99] |
| watson-arm-raised.png | 2,159 | 66x92 | 0.0243 | [8.5, 16.0, 41.5, 62.0] |
| watson-arm-back.png | 2,493 | 80x120 | 0.0384 | [70, 43, 110, 103] |
| watson-torso.png | 9,834 | 165x170 | 0.1122 | [25.5, 32.0, 108.0, 117.0] |
| holmes-face-neutral.png | 3,946 | 102x86 | 0.0351 | [32.5, 21.0, 83.5, 64.0] |
| watson-face-neutral.png | 5,399 | 161x84 | 0.0541 | [27.5, 18.0, 108.0, 60.0] |
| holmes-face-focused.png | 3,912 | 102x87 | 0.0355 | [32.5, 20.5, 83.5, 64.0] |
| watson-face-focused.png | 5,350 | 161x85 | 0.0547 | [27.5, 17.5, 108.0, 60.0] |
| holmes-face-thinking.png | 3,976 | 102x89 | 0.0363 | [32.5, 19.5, 83.5, 64.0] |
| watson-face-thinking.png | 5,382 | 161x87 | 0.056 | [27.5, 16.5, 108.0, 60.0] |
| holmes-face-attentive.png | 3,897 | 102x86 | 0.0351 | [32.5, 21.0, 83.5, 64.0] |
| watson-face-attentive.png | 5,305 | 161x84 | 0.0541 | [27.5, 18.0, 108.0, 60.0] |
| holmes-face-hushed.png | 3,918 | 102x86 | 0.0351 | [32.5, 21.0, 83.5, 64.0] |
| watson-face-hushed.png | 5,352 | 161x84 | 0.0541 | [27.5, 18.0, 108.0, 60.0] |
| holmes-face-wonder.png | 3,932 | 102x91 | 0.0371 | [32.5, 18.5, 83.5, 64.0] |
| watson-face-wonder.png | 5,414 | 161x89 | 0.0573 | [27.5, 15.5, 108.0, 60.0] |
| holmes-face-reading.png | 3,891 | 102x86 | 0.0351 | [32.5, 21.0, 83.5, 64.0] |
| watson-face-reading.png | 5,380 | 161x84 | 0.0541 | [27.5, 18.0, 108.0, 60.0] |
| holmes-face-marking.png | 3,869 | 102x87 | 0.0355 | [32.5, 20.5, 83.5, 64.0] |
| watson-face-marking.png | 5,349 | 161x85 | 0.0547 | [27.5, 17.5, 108.0, 60.0] |
| holmes-face-delighted.png | 3,822 | 102x86 | 0.0351 | [32.5, 21.0, 83.5, 64.0] |
| watson-face-delighted.png | 5,246 | 161x84 | 0.0541 | [27.5, 18.0, 108.0, 60.0] |
| holmes-face-surprised.png | 4,046 | 102x91 | 0.0371 | [32.5, 18.5, 83.5, 64.0] |
| watson-face-surprised.png | 5,519 | 161x89 | 0.0573 | [27.5, 15.5, 108.0, 60.0] |
| holmes-face-pout.png | 3,972 | 102x87 | 0.0355 | [32.5, 20.5, 83.5, 64.0] |
| watson-face-pout.png | 5,222 | 161x85 | 0.0547 | [27.5, 17.5, 108.0, 60.0] |
| holmes-head.png | 3,946 | 102x86 | 0.0351 | [32.5, 21.0, 83.5, 64.0] |
| watson-head.png | 5,399 | 161x84 | 0.0541 | [27.5, 18.0, 108.0, 60.0] |
| prop-glass.png | 878 | 55x55 | 0.0121 | [2.0, 1.0, 29.5, 28.5] |
| prop-card.png | 807 | 53x65 | 0.0138 | [0.0, 0.0, 26.5, 32.5] |
| prop-notebook-pencil.png | 856 | 60x65 | 0.0156 | [1.0, 2.0, 31.0, 34.5] |
| prop-cup.png | 805 | 34x23 | 0.0031 | [0.0, 2.0, 17.0, 13.5] |
| holmes-halo.png | 3,449 | 240x356 | 0.3418 | [0, 0, 120, 178] |
| watson-halo.png | 3,328 | 268x280 | 0.3002 | [0, 0, 134, 140] |

## Docs / test assets (excluded from runtime total)

| File | Bytes | WxH px |
|---|---:|---|
| holmes-pose-dock.png | 14,690 | 240x356 |
| holmes-pose-walk.png | 14,699 | 240x356 |
| holmes-pose-search.png | 15,609 | 240x356 |
| holmes-pose-berth-think.png | 15,611 | 240x356 |
| holmes-pose-ack.png | 15,243 | 240x356 |
| holmes-pose-announce.png | 16,568 | 240x356 |
| holmes-pose-gaze-up.png | 15,552 | 240x356 |
| holmes-pose-card-look.png | 15,076 | 240x356 |
| holmes-pose-celebrate-jump.png | 16,467 | 240x356 |
| holmes-pose-high-five.png | 16,526 | 240x356 |
| holmes-pose-clap.png | 14,665 | 240x356 |
| holmes-pose-pout.png | 18,688 | 240x356 |
| watson-pose-walk.png | 16,491 | 268x280 |
| watson-pose-read.png | 16,595 | 268x280 |
| watson-pose-think.png | 16,929 | 268x280 |
| watson-pose-station-idle.png | 16,651 | 268x280 |
| watson-pose-notebook-mark.png | 17,784 | 268x280 |
| watson-pose-gasp.png | 18,829 | 268x280 |
| watson-pose-celebrate-jump.png | 15,954 | 268x280 |
| watson-pose-high-five.png | 18,640 | 268x280 |
| watson-pose-clap.png | 16,064 | 268x280 |
| watson-pose-pout.png | 16,834 | 268x280 |
| silhouette-holmes-104.png | 2,450 | 43x104 |
| silhouette-watson-104.png | 2,647 | 63x104 |

## Pivots & anchors (viewBox units)

- Holmes: frontArm (78,58) · swingArm (44,58) · head (62,54) · torso (60,132) · leg-a (52,118) · leg-b (64,118) · palm anchor (99,25) · base hand points: front (87,83), back (37,98)
- Watson: frontArm (36,54) · noteArm (82,54) · head (60,50) · torso (60,110) · leg-a (52,92) · leg-b (66,92) · palm anchor (15,21) · base hand points: front (26,89), note-arm (97,93)
- Measured palm error on the regenerated high-five plates: Holmes {'measured_vb': [98.89, 25.36], 'contact_vb': [99, 25], 'error_px': 0.37, 'skin_px': 229} · Watson {'measured_vb': [15.44, 20.91], 'contact_vb': [15, 21], 'error_px': 0.45, 'skin_px': 224}
- Base arm palms (panel cure): every arm part contains its hand; skin centroid within 0.6 vb of the rig hand point; shoulder pivot inside painted pixels (alpha 235–250). Per-file numbers in `ASSET_LOCK.json` → `arm_palm_measurements_cure`.

## Silhouette gate (104 px, grayscale)

- Holmes: PASS — tall/thin, deerstalker reads (43 px wide at 104 px high)
- Watson: PASS — short/stout, bowler reads (63 px wide at 104 px high)
- Distinguishable at a glance: PASS

## Scale lock

- Watson ≈ 0.76 × Holmes in every frame (MOCKUP-NOTES staging law): 390 px → Holmes 170 / Watson 130; 1280 px → Holmes 150 / Watson 115.

## Identity distractors (TEST assets — excluded from the runtime total)

| File | Bytes | WxH px | Subject |
|---|---:|---|---|
| tracker-standing.png | 15,949 | 173x338 | Cold Trail tracker child |
| jolly-standing.png | 22,945 | 261x338 | Jolly, cream plush |

## Notes

- Parts are cropped to their alpha bbox; rect_vb gives each part's placement rect in rig viewBox units (x0,y0,x1,y1). Assemble in order: halo, legs (leg-a + leg-b), arm-back/note, torso, arm-front, face, hat.
- Faces: holmes-face-<kind>.png / watson-face-<kind>.png are full head parts with the expression drawn in the character's own features; holmes-head.png / watson-head.png are the neutral bases.
- POSE-PLATE REGENERATION 2026-11-08 (high-five geometry cure): the painted pose plates' raised arms disagreed with the rig pose spec (DetectivePair.tsx @ 9e49da3) — in the old high-five plates the anchor hand was a flat rig-colour disc (242,196,154), not painted skin, the arm rose from the wrong shoulder line, and a duplicate base-position front hand remained. All six arm-pose plates were regenerated as composites of the cured parts at the pose-spec angles (high-five: arm-front rotated about its pivot by the harness angle, hand segment extended along the arm axis so the painted palm lands on HIGH_FIVE_CONTACT; celebrate/clap: parts at CELEBRATE/CLAP spec angles, arms behind/over torso in rig draw order). Measured on the shipped plates (harness skin band, >=40px cluster within 30 vb): Holmes high-five palm (98.89,25.36) vb, 0.37 vb from (99,25), 229 px; Watson (15.44,20.91), 0.45 vb from (15,21), 224 px. Celebrate palms 0.39-0.90 vb from rig targets; clap palms 0.29-0.36 vb. Glass: high-five and Holmes celebrate/clap carry zero pale-lens px (glass = null); Watson celebrate carries the prop glass at the rig position. NOTE: the parts-assembly palm number is bounded by rigid-arm geometry — the arm-front part's palm radius (26.6 vb Holmes) is shorter than the contact radius (39.1 vb), so a pure rotation assembly lands ~7.3 rig px short regardless of plate content; the rig itself draws a longer explicit arm for high-five. Plates now show the true anchor geometry.
- PANEL CURE 2026-11-08 (glass): the earlier claim that the painted magnifier had been cleared was FALSE for the parts and plates as shipped. The baked hand + magnifier has now been inpainted out of holmes-torso.png, the Holmes leg parts and every Holmes pose plate (plaid/trouser clone-tile fill, contained to the original silhouette). Measured with a narrow skin band (see arm_palm_measurements_cure.band): holmes-torso hand-zone skin 165 -> 0 px below y=130 (8 skin px remain at the neck, which is the neck); Holmes leg parts 190 -> 0 / 4 px; pale-lens pixels in the baked-glass box of every Holmes plate -> 0 (<=1). prop-glass.png is now the single glass source: dock/search/berth-think/ack/announce/gaze-up/card-look/walk plates carry exactly one glass (400 pale-lens px, the prop), celebrate-jump/high-five/clap carry zero (glass = null, section 4.2/3.5).
- PANEL CURE 2026-11-08 (arms): all four arm parts were repainted to the rig geometry — shoulder cap centred on the pivot, sleeve to a cream cuff, painted hand centred on the rig hand point (Holmes front (87,83), Holmes back (37,98), Watson front (26,89), Watson note-arm hand (97,93) measured from the notebook hand in the source painting). See arm_palm_measurements_cure.
- PANEL CURE 2026-11-08 (legs split): holmes-legs.png / watson-legs.png are replaced by leg-a + leg-b parts (complementary masks over the same placement rect; pivots Holmes (52,118)/(64,118), Watson (52,92)/(66,92) recorded in pivots_vb and the manifest, each pivot inside its part's painted hip, alpha 254-255). Watson's book + hand were also inpainted out of his leg parts (coat plaid fill) — legs carry legs only. The fused holmes-legs.png / watson-legs.png files are removed.
- PANEL CURE 2026-11-08 (seams): the flat keyline rows at the interior cut edges of every face/head/torso/hat part (3 rows of RGB(32,22,14) at the bottom edge) were re-cut — those rows now carry mirrored source pixels from directly above the cut (coat/collar texture), so no straight bar can appear at the neck/chest junction. Verified on assembled figures from the cured parts: no junction row in either assembly contains a keyline run of 8 px or more, at natural size or at 128 px render.
- PANEL CURE 2026-11-08 (halo): holmes-halo.png / watson-halo.png are new runtime parts — silhouette-shaped cream halo + dark keyline underlays at full figure size, placed behind the assembled doll (assembly order above). The assembled composites show the cream halo around both figures (1,848 / 1,400 cream px on a mid-tone ground). No live filters.
- PANEL CURE 2026-11-08 (pout): holmes-face-pout.png redrawn to section 6.2 — brow angled down-in, mouth an inverted arc (measured: dark-stroke top edge at mouth centre y=1.0 vs y=4.0 at the edges of the mouth box), and the chin fist removed (it read as berth-think). watson-face-pout.png likewise (inverted arc below the moustache: centre y=1.0 vs edges y=2.8; brows angled down-in). watson-face-delighted.png strengthened: a wide open smile with teeth now reads below the moustache (mouth-band dark px 91 in neutral -> 177 in delighted). holmes-pose-pout.png now uses the cured pout face and a 3-degree forward slump rotation about the torso pivot — it no longer reads as thinking.
- DUPLICATES DISCLOSED: holmes-head.png is byte-identical to holmes-face-neutral.png, and watson-head.png is byte-identical to watson-face-neutral.png (the head part IS the neutral face plate; both filenames are kept because the harness expects the inventory). holmes-face-surprised.png is likewise byte-identical to holmes-face-wonder.png, and watson-face-surprised.png to watson-face-wonder.png. watson-pose-walk.png is NO LONGER byte-identical to watson-pose-station-idle.png: it is the station figure with a split-leg stride applied below the coat hem (3,527 px differ) — walk = station figure + leg swing, the same semantics the engine's leg-a/leg-b swing gives the doll.
- Watson's painted notebook remains in his torso/arm region where the source art places it; prop-notebook-pencil.png is also provided for the engine.
- High-five raised arms are drawn explicitly to the anchor (same technique as the SVG rig), sleeve in coat plaid, palm disc centred on HIGH_FIVE_CONTACT; error measured from the assembled plates' skin-cluster centroid.
- Identity distractors (tracker-standing.png, jolly-standing.png) are TEST assets for the identity trial: listed separately, EXCLUDED from the runtime 500 KB total.
- FOLLOW-UP CURE 2026-11-08 (raised-arm parts): holmes-arm-raised.png / watson-arm-raised.png are new runtime parts — the dedicated raised arm the rig draws explicitly for pose 'high-five' ONLY (DetectivePair.tsx @ 9e49da3, Holmes lines 347/425–433, Watson 511/598–606: Holmes stroke M78,58 L97,27 + hand circle at HIGH_FIVE_CONTACT (99,25) r=4.6; Watson M36,54 L17,23 + hand circle at (15,21) r=4.6 — drawn explicitly so the anchor never drifts with a rotation guess). The base arm-front palm radius (26.6 vb Holmes) cannot reach the anchor radius (39.1 vb) by any rotation, so a rotation assembly reads ~7.3 rig px short through no plate defect; these parts close that structural gap. Each part is the raised arm of the regenerated high-five pose plate, isolated in the same register (palette-lossless), placed at its rect with NO rotation; in the high-five assembly it replaces arm-front — the kid-test measurer (tests/e2e/pair-art-kidtest.spec.ts) detects it by part id `arm-raised` (matches /raised/ on the part field), excludes arm-front, and draws it at its rectPx unrotated. Narrow-band self-check, part at rect: Holmes hand cluster 244 px, centroid (98.77, 25.50) vb — 0.56 vb from (99,25); Watson 235 px, centroid (15.50, 20.96) vb — 0.50 vb from (15,21). Assembled in harness draw order, the wide-band palm measurement reproduces the plates' own numbers exactly (Holmes 229 px @ (98.89,25.36), 0.22 rig px; Watson 224 px @ (15.44,20.91), 0.33 rig px; gate ≤3 rig px), and assembly-vs-plate differing fraction is 0.563 / 0.520 (gate 0.60). Full record: `ASSET_LOCK.json` → `raised_arm_parts_cure`.
- manifest.json (beside the assets) is the harness/engine-shaped export of this lock's geometry — see manifest_alignment.
