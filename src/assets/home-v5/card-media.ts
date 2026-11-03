import geodetectiveVideoUrl from "./geodetective-film.mp4";
import geodetectivePosterUrl from "./geodetective-poster.webp";
import geodetectiveStillUrl from "./geodetective-still.webp";
import coldtrailVideoUrl from "./coldtrail-film.mp4";
import coldtrailPosterUrl from "./coldtrail-poster.webp";
import coldtrailStillUrl from "./coldtrail-still.webp";
import reviewVideoUrl from "./review-film.mp4";
import reviewPosterUrl from "./review-poster.webp";
import reviewStillUrl from "./archive-tools.webp";
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
 * Smooth blend (feat/smooth-cards): the slot's wrapper carries a
 * gradient overlay in home-v5.css (.hv5-card-film::after) that
 * dissolves the bottom of the picture into the card colour, so
 * the picture meets the text area with no hard line. The overlay
 * sits inside the existing box and covers the film, the poster,
 * and the still alike. Both cards use the same stops, clear at
 * 64% of the box height and solid #fdfbf3 at the bottom edge,
 * because both pictures dissolve into the same card colour.
 * The fade belongs to the `.hv5-pic` slots only: the `.hv5-art`
 * slots keep their own radial mask edge, and home-v5.css keeps
 * the fade overlay off them.
 *
 * ── The three spot illustrations (Review, Journal, Grown-ups) ──
 *
 * Added 2026-11-03 on the owner's ruling: the same film treatment
 * as the game cards, by the same method. Each card's existing
 * illustration is the animation's source image, the film's settle
 * frame, and the still this module exports for it — the stillUrl
 * imports above point at the original illustration files
 * (archive-tools / journal-tree / binoculars-hat), not at copies.
 * Slots are small, so the films encode at twice the still's own
 * size: Review 800×538 (slot 172 CSS px wide, 400/269), Journal
 * 720×720 (slot 148 px, square), Grown-ups 800×800 (slot 178 px,
 * square). Posters are each film's own first frame, as above.
 *
 * Beats, as generated (per-take notes with prompts, attempts, and
 * frame evidence: ~/workspace/meridian-smooth-cards-evidence/
 * takes/TAKE-NOTES.md):
 *   Review — the magnifying glass sweeps over the satchel as if
 *     checking the misses over, then returns and rests. Three raw
 *     takes failed the identity/settle checks (no settle; layout
 *     redrawn; the lens vanishing in the last frame), so the
 *     shipped film is take 1 edited there-and-back at its apex
 *     (2.6 s): forward sweep, then the same frames reversed, so it
 *     settles on its own opening frame exactly. Disclosed here and
 *     in the PR body for the owner's call. The brief's "one card
 *     tips up under the glass" beat has no card to act on — the
 *     illustration holds a satchel, a compass, and the glass — so
 *     the sweep itself carries the checking verb.
 *   Journal — wind moves through the tree, light warms over the
 *     hills. Take 1 of 1 shipped, retimed 10 s → 7.8 s. Disclosed
 *     drift: the canopy ends a little more wind-blown than the
 *     still (last frame vs still PSNR 16.5 dB at 360 px), the
 *     light ends warmer, and a few tiny birds cross once mid-take.
 *     Nothing morphs and no text exists to garble.
 *   Grown-ups — the binoculars rise upright as if lifted to watch
 *     over the kids, and the hat tips once. Take 2 of 2 shipped
 *     (take 1 ended with the binoculars lying on their side).
 *     Minor redraw drift at settle, disclosed in the take notes.
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
 * cabin, which is still distant.
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
 * 1094×616, silent.
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
 *     (shipped 58,354 bytes at quality 82).
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
