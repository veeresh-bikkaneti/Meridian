import type { CardFilmMedia } from "@/lib/card-film-media";
import mathVideoUrl from "./math-film.mp4";
import mathPosterUrl from "./math-poster.webp";
import mathStillUrl from "./math-still.webp";
import physicsVideoUrl from "./physics-film.mp4";
import physicsPosterUrl from "./physics-poster.webp";
import physicsStillUrl from "./physics-still.webp";
import chemistryVideoUrl from "./chemistry-film.mp4";
import chemistryPosterUrl from "./chemistry-poster.webp";
import chemistryStillUrl from "./chemistry-still.webp";
import socialStudiesVideoUrl from "./social-studies-film.mp4";
import socialStudiesPosterUrl from "./social-studies-poster.webp";
import socialStudiesStillUrl from "./social-studies-still.webp";
import journalsVideoUrl from "./journals-film.mp4";
import journalsPosterUrl from "./journals-poster.webp";
import journalsStillUrl from "../home-v5/journal-tree.webp";
import globeStillUrl from "../home-v5/globe-fallback.webp";

/**
 * Subject card media for the Why Learn picker (feat/why-learn-living-atlas,
 * the owner's "Living Atlas" pick, 2026-11-14) — the swap point for the
 * picker's card pictures, kept beside why-learn-art.ts the way
 * src/assets/home-v5/card-media.ts serves the home cards. Every card
 * renders through the one shared CardFilm component
 * (src/components/card-film.tsx), which takes each card's film, poster
 * and still from here and nowhere else — a re-animated take ships by
 * replacing the files beside this module, never by editing component
 * code.
 *
 * Each film is a short seamless loop animated from the card's own
 * still (the still is the film's source image and its settle frame,
 * the home-card method): math's cart crosses the bridge over the
 * river, physics' pendulum swings while the rocket lifts and the
 * apple drops, chemistry's three flasks bubble, the social-studies
 * sailboat crosses the river town, and the journals tree sways with
 * drifting leaves. All five encode at 640×360, audio stripped, with
 * a 0.6 s crossfade at the seam:
 *   math-film.mp4            4.6 s   117,766 bytes
 *   physics-film.mp4         3.4 s    78,090 bytes
 *   chemistry-film.mp4       5.0 s    70,097 bytes
 *   social-studies-film.mp4  4.0 s   110,706 bytes
 *   journals-film.mp4        5.0 s   177,739 bytes
 * Posters are each film's own first frame (640×360 WebP, 12–21 KB).
 * Stills are the source scenes at 960×540 WebP quality 75 (20–32 KB);
 * the journals still is the home journal card's own tree art and the
 * general-knowledge still is the home globe's fallback map — both
 * are the repo's existing files, imported, never copied.
 *
 * General knowledge has NO film, deliberately: three attempts to
 * animate the relief map redrew it (the continents tiled, then
 * duplicated, then a storm bank and a relight), and a card film that
 * redraws the map teaches a wrong map. Its card keeps the pristine
 * still and takes its motion from overlays above the art instead
 * (src/subjects/shared/GkGlobeOverlay.tsx) — the same recipe the
 * home hero uses over its mountain painting.
 *
 * Content rules, the why-learn-art.ts checklist: all art is original
 * work generated for this page; no TV-show imagery, characters,
 * logos or footage, no biology, no politics. The social-studies
 * townscape's buildings include a church tower, standing as one
 * piece of town architecture among the houses.
 */
export const SUBJECT_CARD_MEDIA: Record<string, CardFilmMedia> = {
  math: { videoUrl: mathVideoUrl, posterUrl: mathPosterUrl, stillUrl: mathStillUrl },
  physics: { videoUrl: physicsVideoUrl, posterUrl: physicsPosterUrl, stillUrl: physicsStillUrl },
  chemistry: {
    videoUrl: chemistryVideoUrl,
    posterUrl: chemistryPosterUrl,
    stillUrl: chemistryStillUrl,
  },
  "social-studies": {
    videoUrl: socialStudiesVideoUrl,
    posterUrl: socialStudiesPosterUrl,
    stillUrl: socialStudiesStillUrl,
  },
  journals: {
    videoUrl: journalsVideoUrl,
    posterUrl: journalsPosterUrl,
    stillUrl: journalsStillUrl,
  },
};

/** The still every picker card can stand on — the gated fallback for
 *  the film cards, and the whole picture for general knowledge. */
export const SUBJECT_CARD_STILLS: Record<string, string> = {
  math: mathStillUrl,
  physics: physicsStillUrl,
  chemistry: chemistryStillUrl,
  "general-knowledge": globeStillUrl,
  "social-studies": socialStudiesStillUrl,
  journals: journalsStillUrl,
};
