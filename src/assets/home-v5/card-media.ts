import geodetectiveVideoUrl from "./geodetective-film.mp4";
import geodetectivePosterUrl from "./geodetective-poster.webp";
import geodetectiveStillUrl from "./geodetective-still.webp";
import coldtrailVideoUrl from "./coldtrail-film.mp4";
import coldtrailPosterUrl from "./coldtrail-poster.webp";
import coldtrailStillUrl from "./coldtrail-still.webp";
import coldtrailLittleExplorerVideoUrl from "./coldtrail-film-little-explorer.mp4";
import coldtrailLittleExplorerPosterUrl from "./coldtrail-poster-little-explorer.webp";
import coldtrailLittleExplorerStillUrl from "./coldtrail-still-little-explorer.webp";
import reviewVideoUrl from "./review-film.mp4";
import reviewPosterUrl from "./review-poster.webp";
import reviewStillUrl from "./archive-tools.webp";
import reviewTrailScoutVideoUrl from "./review-film-trail-scout.mp4";
import reviewTrailScoutPosterUrl from "./review-poster-trail-scout.webp";
import journalVideoUrl from "./journal-film.mp4";
import journalPosterUrl from "./journal-poster.webp";
import journalStillUrl from "./journal-tree.webp";
import grownupsVideoUrl from "./grownups-film.mp4";
import grownupsPosterUrl from "./grownups-poster.webp";
import grownupsStillUrl from "./binoculars-hat.webp";

/**
 * THE swap point for the five home cards' animated pictures:
 * GeoDetective + Cold Trail (the `.hv5-pic` slots in game-app.tsx)
 * and Review, Journal, and Grown-ups (the `.hv5-art` slots).
 *
 * All five cards render through the one shared CardFilm component
 * (src/components/card-film.tsx), which imports each card's film,
 * poster, and still from here and nowhere else — so a re-animated
 * take ships by replacing the files beside this module, never by
 * editing component code. Keep it that way. There is one motion
 * system on the home page, CardFilm; the CSS settling passes the
 * three `.hv5-art` cards carried for one round were removed on the
 * owner's ruling (2026-11-03) and must not come back.
 *
 * Smooth blend (feat/smooth-cards): on the `.hv5-pic` slots the
 * picture feathers into the text area. A mask on the media in
 * home-v5.css holds the scene at full opacity until 93% of the
 * box height and fades its own alpha out by the bottom edge —
 * a melt zone of about 7% of the box. No pigment is painted
 * over the scene anywhere: the melt is a pure alpha feather,
 * so the picture dissolves into the card surface it sits on
 * (--hv5-card, #fdfbf3 — the ground the text zone sits on too;
 * the full ground reasoning is in home-v5.css). The first build
 * painted a cream ramp over the scene instead, clear at 64% and
 * solid at 100%. The owner rejected it on 2026-11-03 as too
 * harsh on the eyes. Three softer variants were captured for
 * his pick. He could not tell them apart at capture size and
 * asked for the gradient reduced even further, and on
 * 2026-11-03 (10:25 CST) he ruled it very small and free of
 * anything covering the text or the cartoon: the feather
 * shrank from 84% to the last 7%, and the thin painted landing
 * strip the rework had put on the wrapper's ::after was
 * deleted entirely. The fade belongs to the `.hv5-pic` slots
 * only. The `.hv5-art` slots are full-bleed banners now and
 * carry no fade at all.
 *
 * ── The three spot illustrations (Review, Journal, Grown-ups) ──
 *
 * Added 2026-11-03 on the owner's ruling: the same film treatment
 * as the game cards, by the same method. Each card's existing
 * illustration is the animation's source image, the film's settle
 * frame, and the still this module exports for it — the stillUrl
 * imports above point at the original illustration files
 * (archive-tools / journal-tree / binoculars-hat), not at copies.
 * The films encode at sizes that hold up in the full-bleed
 * banner slots the rework gave these cards: Review 800×538
 * (400/269), Journal 720×720 (square), Grown-ups 800×800
 * (square). Posters are each film's own first frame, as above.
 *
 * Beats, as generated (per-take notes with prompts, attempts, and
 * frame evidence: ~/workspace/meridian-smooth-cards-evidence/
 * takes/TAKE-NOTES.md):
 *   Review — the magnifying glass sweeps over the satchel as if
 *     checking the misses over, then returns and rests. Three raw
 *     takes failed the identity/settle checks (no settle; layout
 *     redrawn; the lens vanishing in the last frame), so the
 *     first shipped film was take 1 edited there-and-back at its
 *     apex (2.6 s). The rework replaced that edit with the
 *     rewind cut below. The brief's "one card tips up under the
 *     glass" beat has no card to act on. The illustration holds a
 *     satchel, a compass, and the glass, so the sweep itself
 *     carries the checking verb.
 *   Journal — wind moves through the tree, light warms over the
 *     hills. Take 1 of 1 shipped, retimed 10 s → 7.8 s. Disclosed
 *     drift: the canopy ends a little more wind-blown than the
 *     still (last frame vs still PSNR 16.6 dB at 360 px), the
 *     light ends warmer, and a few tiny birds cross once mid-take.
 *     Nothing morphs and no text exists to garble.
 *   Grown-ups — the binoculars rise upright as if lifted to watch
 *     over the kids, and the hat tips once. Take 2 of 2 shipped
 *     (take 1 ended with the binoculars lying on their side).
 *     Minor redraw drift at settle, disclosed in the take notes.
 *
 * ── Loop treatment (rework, 2026-11-03) ──
 *
 * All five films loop now, on the owner's autoloop order. The
 * governance note lives in card-film.tsx, next to the code it
 * governs. Each film joins its own tail to its own head in a
 * different way, because each source allows a different join:
 *   GeoDetective — file untouched. It opens and closes on
 *     different scenes, and the cut reads as a replay.
 *   Cold Trail — ping-pong, built from the original walk take.
 *     The film plays forward, then the same frames run in
 *     reverse, so Jolly walks out along the trail and the film
 *     rewinds her walk back. 12.0 s, CRF 40, 389,320 bytes. Both
 *     joins are the film's own frames. The poster was re-derived
 *     from the new film's frame 0, per the standing rule below.
 *   Review — loop-native by construction. The owner asked for a
 *     new beat: something went wrong, so rewind it and rethink.
 *     The film is an editorial build from take 1 raw, disclosed
 *     here the way the earlier edit was. The glass sweeps and
 *     overshoots, then settles in the wrong place at 4.8 s. A
 *     0.4 s freeze holds that wrong beat. The film then rewinds
 *     at 1.7 times speed back to frame 0, and a 1.3 s freeze
 *     holds frame 0 as the rethink pause. The last frame is
 *     frame 0, so the loop has no seam. 9.54 s, CRF 34, 179,821
 *     bytes.
 *   Journal — the shipped film with its last 0.8 s crossfaded
 *     into its first 0.8 s (an xfade build). Duration stays
 *     7.9 s, CRF 38. The content is otherwise untouched.
 *   Grown-ups — the same treatment with a 0.4 s crossfade.
 *     Duration stays 6.0 s, CRF 34.
 *
 * ── Poster vs still — these are DIFFERENT pictures, on purpose ──
 *
 * The POSTER is the film's own opening frame. It is what the
 * <video> element shows before the film can play, so the picture
 * never jumps when playback starts.
 *
 * The STILL is the picture a player sees when the film never runs
 * at all: prefers-reduced-motion, Save-Data, a low-memory device,
 * or a video that failed to load. It is the settled design each
 * film lands on — for GeoDetective that is the owner's own image
 * (the film's last frame hands back to it exactly); for Cold Trail
 * it is the approved keyframe the animation was made from. Do not
 * "simplify" this by using one file for both jobs: the poster must
 * match the film's first frame, the still must match its settled
 * composition, and for GeoDetective those are two different beats
 * of the story (top-down table map vs the detective at her desk).
 * End axis: GeoDetective settles on the owner's image at the front
 * angle, and Cold Trail settles on the wide trail scene with Jolly
 * mid-trail, still walking the footprint trail toward the lit
 * cabin, which is still distant. The current file is that take
 * played forward and then in reverse (the ping-pong build in
 * the loop paragraph above), so the walk loops.
 *
 * ── GeoDetective ──
 *
 * Provenance: the round-2 reshoot film, shipped AS-IS on the
 * owner's word (2026-11-02, "Build this in production"). Four
 * beats: top-down table map → magnifying glass → over the
 * detective's shoulder → front angle, the detective alive, landing
 * exactly on the owner's image. Known flaw, OWNER-ACCEPTED with
 * the flaw disclosed before he chose build-as-is over a drawn-rig
 * fix: in beat 4 the generated front angle drifts for ~1 s (the
 * desk robots morph, the "TRACE IT FIRST" sign garbles) before
 * handing back to his exact image. Do not fix it here; a fix is a
 * new take and a new owner decision, not a file tweak.
 *
 * Sources (outside the repo, in the workspace):
 *   - Film:   ~/workspace/meridian-card-arena/round-2-reshoot/
 *             geodetective-reshoot.mp4 (1092×614, 25 fps, 7.0 s)
 *   - Poster: frame 0 of the shipped film itself (extracted
 *             from geodetective-film.mp4 — the film opens on a
 *             tight crop of the pinned map's centre, NOT the
 *             wide desk plate; see the cure note below)
 *   - Still:  ~/workspace/meridian-card-arena/round-2/assets/
 *             geo-owner.webp (the owner's image, 1094×729)
 *
 * ── Cold Trail ──
 *
 * Provenance: NEW character animation made for this port, on the
 * owner's correction (2026-11-02, verbatim): "I want the avatar
 * chasing the clue like walking not the zoom in and out of card".
 * The round-2 pull-back take (round-2-reshoot/coldtrail-capture.mp4)
 * is SUPERSEDED by that correction — never ship it, never imitate
 * it. The shipped film is image-to-video take 1 of 3 generated from
 * the approved keyframe: Jolly (the cream plush mascot) walks the
 * footprint trail toward the lit cabin — legs stepping, new prints
 * appearing under its feet, frost creeping over the oldest print
 * behind it — and the child tracker follows with her flashlight.
 * The camera is locked (static wide shot; the framing at 1.5 s and
 * 5.9 s is the same tree line, mitten, and foreground print). Full-
 * quality take + the frame strips that chose it live in the build
 * evidence: ~/workspace/meridian-card-port-evidence/coldtrail-takes/
 * and coldtrail-frames/ (take1-legs-strip.png shows the stepping).
 *
 * Sources:
 *   - Keyframe: ~/workspace/meridian-card-arena/round-2/assets/
 *               cold-card.webp (1094×616 — the still, and the
 *               animation's source image)
 *   - Take 1:   media-generation-coldtrail-walk-1-*.mp4 in the
 *               evidence dir above (1264×704, 24 fps, 6.0 s)
 *
 * ── Re-deriving the assets (read this before replacing anything) ──
 *
 * The slot renders 547×308 CSS px; every asset ships at 1094×616
 * (2×, 16:9 — the .hv5-pic box's own aspect ratio).
 *
 * The .mp4 files — shrink a take to web size, in this shape:
 *   ffmpeg -i <take>.mp4 -vf scale=1094:616 -c:v libx264 \
 *     -crf <tuned> -preset veryslow -an -movflags +faststart <film>.mp4
 * (Cold Trail's take is 1264×704, a hair wider than 16:9, so its
 * scale is scale=1094:616:force_original_aspect_ratio=increase
 * followed by crop=1094:616.)
 * That is: H.264, audio stripped (-an), faststart so the film can
 * start before it has fully downloaded. HARD CAP: ≤ ~400 KB per
 * film (the verdict clip's league; it shipped at 329,051 bytes).
 *
 * Measured deviation, recorded honestly: the brief's CRF 28–32
 * range cannot meet that cap on these two sources — the
 * GeoDetective film is dark and rainy (film grain is per-frame
 * noise) and Cold Trail's is falling snow (same problem). At CRF 32
 * with -preset veryslow they measured 505,840 and ~500 KB. The
 * shipped encodes tune the CRF past the range instead of switching
 * technique: GeoDetective CRF 35 veryslow → 371,759 bytes (SSIM
 * 0.932 vs a CRF-10 reference; at the 547 px display size the frame
 * grabs are visually near-identical and the desk sign stays
 * legible), Cold Trail CRF 36 veryslow → 326,786 bytes (flat
 * cartoon colours hold up cleanly at display size). The full sweep
 * is in the evidence dir (logs/media-encode.txt). A replacement
 * take must stay in the same league: ≤ ~400 KB, H.264 in an .mp4,
 * 1094×616, silent. The current Cold Trail file is the ping-pong
 * build in the loop paragraph above (12.0 s at CRF 40 → 389,320
 * bytes). The 6.0 s single-play encode it replaced is the one
 * this paragraph measured.
 *
 * The .webp files — poster and still, both at 1094×616:
 *   GeoDetective poster: the shipped film's own first frame
 *     (shipped 79,846 bytes at quality 82). CURE (panel BLOCK,
 *     PR #321): the first shipped poster was the wide desk plate
 *     from geo-table.webp — a different picture from frame 0
 *     (poster↔frame-0 MAD 102.4/255), so playback popped hard.
 *     Re-derived from frame 0 like Cold Trail's; MAD now 1.29/255.
 *   GeoDetective still: geo-owner.webp centre-cropped to 16:9 —
 *     crop=1094:616:0:56 — so it matches the film's landing frame
 *     geometry exactly (shipped 90,376 bytes at quality 82).
 *   Cold Trail poster: the shipped film's own first frame
 *     (59,952 bytes at quality 82; re-derived for the ping-pong
 *     film, whose frame 0 is the same picture with CRF 40 grain).
 *   Cold Trail still: the keyframe itself, re-encoded at quality
 *     82 (shipped 76,010 bytes).
 * A new take means re-deriving its poster from its own first
 * frame — never ship a poster from a different picture.
 *
 * Frame 0 of a shipped film, extracted and encoded as a poster
 * (the two commands from the GeoDetective cure, verbatim):
 *   ffmpeg -i src/assets/home-v5/geodetective-film.mp4 \
 *     -vf "select=eq(n\,0)" -vframes 1 frame0.png
 *   ffmpeg -i frame0.png -c:v libwebp -q:v 82 geodetective-poster.webp
 * For the other card, substitute its film and poster filenames and
 * write the output beside this module.
 *
 * One hard rule, same as the verdict clip: replacement takes must
 * be silent. The audio track is stripped on purpose — the home
 * page is a reading surface, the films are decoration, and they
 * play muted in the browser anyway.
 *
 * ── Band variants (band-motion port, Units 2–3) ──
 *
 * Two cards carry a second film, chosen by the player's age band
 * through the two pure selectors at the bottom of this module.
 * The selectors are the ONLY band→media path on the home page:
 * game-app.tsx passes each affected slot's media through its
 * selector, and every other slot keeps its plain record. A
 * selector matches its band exactly and fails closed — the
 * standard record comes back for every other value, including
 * "11-13", null, undefined, and any string that is not the one
 * band id. CardFilm itself does not change: it receives whichever
 * record the selector returned, with the same gates, the same
 * lazy mount, and the same slot box, so a variant costs its band
 * one film download and costs every other band nothing.
 *
 * Little Explorer Cold Trail (band "5-7" only) —
 * COLDTRAIL_FILM_LITTLE_EXPLORER. The softer-tone take of the
 * same walk: Jolly on the footprint trail, at the mock's slower
 * pacing. Provenance: generated for the age-band motion mockups
 * (raw take ~/workspace/meridian-band-motion/videos/
 * little-explorer-coldtrail.mp4, 1264×704, 10 s, 24 fps) and
 * prepared in ~/workspace/meridian-band-port-evidence/media-prep/
 * (README there carries the full prep record). The walk never
 * returns to its start inside the take, so the shipped film is a
 * ping-pong build in the same shape as the standard Cold Trail
 * film: the first 6 s forward, then the same 6 s reversed — walk
 * out, walk back, 12.0 s total. Encode: scale with
 * force_original_aspect_ratio=increase + crop to 1094×616 (the
 * recipe above), H.264, silent, faststart, 12 fps, CRF 38 →
 * 349,224 bytes. Seams, greyscale MAD (0–255) against the
 * neighbouring frame: the forward/reverse join is 0.30 (the
 * reverse starts from the forward's own last frame); the loop
 * join (last frame vs first frame) is 4.05 — the content frame
 * is identical by construction, and the number is encoder drift
 * accumulated over 12 s of falling snow, not a content jump.
 * Poster and still are one picture, frame 0 of the encode, WebP
 * quality 82, 50,100 bytes each: the ping-pong returns to its
 * start, so the settle frame IS frame 0. They stay two files —
 * the poster/still distinction above still holds, and a future
 * take whose first and resting frames differ swaps each on its
 * own (the locked tile's media module made the same call).
 *
 * Trail Scout Review (band "8-10" only) — REVIEW_FILM_TRAIL_SCOUT.
 * A regenerated take of the Review card's sweep beat, made as
 * this band's tone: the magnifying glass sweeps out and back
 * over the satchel, then the picture settles on the shipped
 * still's composition. Provenance: generated from the shipped
 * still (archive-tools.webp) with the Little Explorer Review
 * take's beat; prep record in the same media-prep README. The
 * take invents nothing — frames checked at start, middle, and
 * end hold the same glass, compass, and satchel, with no
 * documents and no text anywhere. (An earlier mock take of this
 * card invented case-file documents with pseudo-text; that file
 * is banned and must never enter the repo.) Identity, greyscale
 * MAD (0–255) against the shipped still, each frame resized to
 * the take's 1200×768: first frame 19.77, settle (last) frame
 * 20.67, first vs last 2.93 (it comes back to its own start),
 * first vs mid 15.49 (the sweep really moves). Calibration, same
 * method: the accepted Little Explorer Review take scores 22.24
 * settle against the same still, so this take's settle frame
 * sits closer to the shipped still than the accepted take's
 * does; the numbers run high for every take because the shipped
 * still is a 400×269 corner-art file compared at 1200×768.
 * Encode: the raw take (1200×768, 10 s, 24 fps, 2,548,929 bytes)
 * re-encoded at the Review slot size with the recipe shape above
 * — scale=800:538:force_original_aspect_ratio=increase +
 * crop=800:538, H.264, silent (-an), faststart, preset veryslow,
 * 24 fps kept. CRF sweep on this take: 24 → 431,622 bytes (over
 * the cap), 26 → 322,998, 28 → 241,829, 32 → 142,643,
 * 34 → 112,678, 36 → 92,347, 38 → 75,093, 40 → 62,426. The
 * shipped encode is CRF 28 → 241,829 bytes, SSIM 0.978 against
 * a CRF-10 reference at the same geometry — flat illustration
 * compresses cleanly, so this take meets the cap inside the
 * brief's original CRF range instead of past it. The poster is
 * frame 0 of this encode, WebP quality 82, 31,792 bytes. The
 * still is the existing archive-tools.webp import — the same
 * file the standard Review record uses; it is not duplicated.
 */
export const GEODETECTIVE_FILM = {
  videoUrl: geodetectiveVideoUrl,
  posterUrl: geodetectivePosterUrl,
  stillUrl: geodetectiveStillUrl,
} as const;

export const COLDTRAIL_FILM = {
  videoUrl: coldtrailVideoUrl,
  posterUrl: coldtrailPosterUrl,
  stillUrl: coldtrailStillUrl,
} as const;

export const REVIEW_FILM = {
  videoUrl: reviewVideoUrl,
  posterUrl: reviewPosterUrl,
  stillUrl: reviewStillUrl,
} as const;

export const JOURNAL_FILM = {
  videoUrl: journalVideoUrl,
  posterUrl: journalPosterUrl,
  stillUrl: journalStillUrl,
} as const;

export const GROWNUPS_FILM = {
  videoUrl: grownupsVideoUrl,
  posterUrl: grownupsPosterUrl,
  stillUrl: grownupsStillUrl,
} as const;

/**
 * Band variants — see the "Band variants" section of the module
 * doc above for provenance, seam/identity numbers, and the encode
 * recipes. These two records are reachable only through the
 * selectors below.
 */
export const COLDTRAIL_FILM_LITTLE_EXPLORER = {
  videoUrl: coldtrailLittleExplorerVideoUrl,
  posterUrl: coldtrailLittleExplorerPosterUrl,
  stillUrl: coldtrailLittleExplorerStillUrl,
} as const;

export const REVIEW_FILM_TRAIL_SCOUT = {
  videoUrl: reviewTrailScoutVideoUrl,
  posterUrl: reviewTrailScoutPosterUrl,
  // The settle composition IS the shipped illustration — the same
  // import the standard REVIEW_FILM uses, never a copy.
  stillUrl: reviewStillUrl,
} as const;

/**
 * The only band→media path for the Cold Trail card: the Little
 * Explorer ("5-7") band gets the softer film; every other value —
 * "8-10", "11-13", null, undefined, any other string — gets the
 * standard film. Exact match, fail closed on every doubt.
 */
export function coldtrailMediaForBand(band: string | null | undefined) {
  return band === "5-7" ? COLDTRAIL_FILM_LITTLE_EXPLORER : COLDTRAIL_FILM;
}

/**
 * The only band→media path for the Review card: the Trail Scout
 * ("8-10") band gets the regenerated sweep film; every other
 * value — "5-7", "11-13", null, undefined, any other string —
 * gets the standard film. Exact match, fail closed on every
 * doubt.
 */
export function reviewMediaForBand(band: string | null | undefined) {
  return band === "8-10" ? REVIEW_FILM_TRAIL_SCOUT : REVIEW_FILM;
}
