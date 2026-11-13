/**
 * The three modern-world films that leave Play Lab "Coming soon".
 * One row per clip. The narration string is the caption, character
 * for character. These rows have no quiz choices.
 */
export const MODERN_WORLD_FILM_IDS = [
  "modern-world:greenwich-zero",
  "modern-world:liverpool-manchester",
  "modern-world:hearts-content-cable",
] as const;

export type ModernWorldFilmId = (typeof MODERN_WORLD_FILM_IDS)[number];

export interface JournalFilm {
  id: ModernWorldFilmId;
  narration: string;
  stillUrl: string;
  posterUrl: string;
  videoUrl: string;
  captionUrl: string;
  audioUrl: string;
}

const GREENWICH =
  "Hey kids, have you heard about this place? The Greenwich line is the zero line on maps, set in 1884.";
const LIVERPOOL =
  "Hey kids, have you heard about this place? In 1830 a steam railway joined Liverpool and Manchester.";
const CABLE =
  "Hey kids, have you heard about this place? In 1866 a cable under the sea reached Heart's Content.";

function row(id: ModernWorldFilmId, narration: string, slug: string): JournalFilm {
  return {
    id,
    narration,
    stillUrl: `/images/journals/modern-world/${slug}.webp`,
    posterUrl: `/images/journals/modern-world/${slug}.webp`,
    videoUrl: `/videos/journals/modern-world/${slug}.mp4`,
    captionUrl: `/videos/journals/modern-world/${slug}.vtt`,
    audioUrl: `/audio/journals/modern-world/${slug}.wav`,
  };
}

export const JOURNAL_FILMS: Record<ModernWorldFilmId, JournalFilm> = {
  "modern-world:greenwich-zero": row("modern-world:greenwich-zero", GREENWICH, "greenwich-zero"),
  "modern-world:liverpool-manchester": row(
    "modern-world:liverpool-manchester",
    LIVERPOOL,
    "liverpool-manchester",
  ),
  "modern-world:hearts-content-cable": row(
    "modern-world:hearts-content-cable",
    CABLE,
    "hearts-content-cable",
  ),
};

export function getJournalFilm(id: string): JournalFilm | null {
  if ((MODERN_WORLD_FILM_IDS as readonly string[]).includes(id)) {
    return JOURNAL_FILMS[id as ModernWorldFilmId];
  }
  return null;
}
