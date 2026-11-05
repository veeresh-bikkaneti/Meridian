import lockedVideoUrl from "./geodetective-locked-film.mp4";
import lockedPosterUrl from "./geodetective-locked-poster.webp";
import lockedStillUrl from "./geodetective-locked-still.webp";

/**
 * The swap point for the Little Explorer (5–7) locked GeoDetective
 * tile's picture (LockedTileFilm, src/components/age-profile/
 * LockedTileFilm.tsx). This is a separate module from card-media.ts
 * on purpose: that module serves the two playable game cards through
 * CardFilm; this tile is locked, its picture has no play/pause
 * toggle, and its media must only ever be fetched for the 5–7 band —
 * LockedLoop renders it, and LockedLoop itself only renders for
 * that band, so no other band downloads these files.
 *
 * ── Poster vs still ──
 *
 * Same doctrine as card-media.ts: the POSTER is the film's own
 * first frame; the STILL is the settled picture shown when the film
 * never runs (reduced motion, Save-Data, low memory, video error).
 * Here the film is built so its first frame, its last frame, and
 * the resting still are one and the same picture — the detective
 * asleep on her map — so the two files hold the same image. They
 * stay two files: one file doing both jobs is the shortcut
 * card-media.ts warns against, and a future take whose first and
 * resting frames differ must be able to swap each on its own.
 * That first-frame-equals-last-frame build is also what makes
 * the film loop seamlessly: LockedTileFilm loops it under
 * CardFilm's governance (owner ruling, 2026-11-04, superseding
 * the original play-once-and-rest design).
 *
 * ── The picture ──
 *
 * The detective asleep at her desk: head resting on the map,
 * magnifying glass set down on the map away from her hand, eyes
 * closed. She breathes twice, slowly (two 4-second breaths), then
 * the picture rests — and, since the 2026-11-04 loop ruling, the
 * film loops from that resting frame and she breathes again. The
 * film is a region-frozen composite built from the resting still
 * (PIL, script + measurements in
 * ~/workspace/meridian-band-port-evidence/): only the head-and-torso
 * region moves; the lamp and the window are the still's own pixels
 * in every frame. That fixes the mock take, which also breathed
 * the lamp glow and moved the rain.
 *
 * The grade is baked into the media, as approved in the mock:
 * desaturate 0.45 toward grey, brightness 0.94. The tile's CSS
 * grayscale(0.85) — written when the tile was text-only — now
 * scopes to the tile's text only (age-profile.css), so the two
 * grades never stack on the picture. At 0.85 the photo drained to
 * near-monochrome; the owner approved the mock at 0.45
 * (2026-11-03, "use them").
 *
 * Encode: 1094×616 (the home-v5 slot size), H.264, silent,
 * faststart, 10 s at 24 fps, 355,210 bytes — inside the ~400 KB
 * per-film cap card-media.ts sets. Constant QP 28, not CRF: at CRF
 * the encoder's rate control rebuilt the resting picture after
 * the mid-film keyframe with a visible whole-frame shift
 * (measured 2.49/255 against frame 0); at constant QP the resting
 * frames rebuild identically (final-second MAD ≤ 0.02). Poster
 * and still are frame 0 of the film / the resting frame, WebP
 * quality 82, 101,728 bytes each.
 */
export const LOCKED_GEODETECTIVE_FILM = {
  videoUrl: lockedVideoUrl,
  posterUrl: lockedPosterUrl,
  stillUrl: lockedStillUrl,
} as const;
