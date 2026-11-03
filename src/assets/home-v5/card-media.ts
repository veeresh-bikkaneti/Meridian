import geodetectiveVideoUrl from "./geodetective-film.mp4";
import geodetectivePosterUrl from "./geodetective-poster.webp";
import geodetectiveStillUrl from "./geodetective-still.webp";
import coldtrailVideoUrl from "./coldtrail-film.mp4";
import coldtrailPosterUrl from "./coldtrail-poster.webp";
import coldtrailStillUrl from "./coldtrail-still.webp";

/**
 * THE swap point for the two home game cards' animated pictures
 * (GeoDetective + Cold Trail, the `.hv5-pic` slots in game-app.tsx).
 *
 * Both cards render through the one shared CardFilm component
 * (src/components/card-film.tsx), which imports each card's film,
 * poster, and still from here and nowhere else — so a re-animated
 * take ships by replacing the files beside this module, never by
 * editing component code. Keep it that way.
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
