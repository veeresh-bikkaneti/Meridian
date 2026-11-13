import { assetBase } from "../components/storyteller-lines.ts";

export type JournalFilm = {
  id: string;
  placeName: string;
  caption: string;
  stillUrl: string;
  posterUrl: string;
  videoUrl: string;
};

const NORMANDY_CAPTION =
  "Hey kids, have you heard about this place? Above the beach, it was dedicated in nineteen fifty-six. How many years ago?";

const ARIZONA_CAPTION =
  "Hey kids, have you heard about this place? This Hawaii memorial is one hundred eighty-four feet long. How many ten-foot steps is that?";

function publicUrl(path: string): string {
  return `${assetBase()}${path}`;
}

export const JOURNAL_FILMS: readonly JournalFilm[] = [
  {
    id: "ww2-monuments:normandy-where",
    placeName: "Normandy American Cemetery, Colleville-sur-Mer, France",
    caption: NORMANDY_CAPTION,
    stillUrl: publicUrl("images/journals/ww2-monuments/normandy-where.webp"),
    posterUrl: publicUrl("images/journals/ww2-monuments/normandy-where.webp"),
    videoUrl: publicUrl("videos/journals/ww2-monuments/normandy-where.mp4"),
  },
  {
    id: "ww2-monuments:arizona-how-far",
    placeName: "USS Arizona Memorial, Pearl Harbor, Hawaiʻi",
    caption: ARIZONA_CAPTION,
    stillUrl: publicUrl("images/journals/ww2-monuments/arizona-how-far.webp"),
    posterUrl: publicUrl("images/journals/ww2-monuments/arizona-how-far.webp"),
    videoUrl: publicUrl("videos/journals/ww2-monuments/arizona-how-far.mp4"),
  },
];

const BY_ID = new Map(JOURNAL_FILMS.map((film) => [film.id, film]));

export function getJournalFilm(id: string): JournalFilm | null {
  return BY_ID.get(id) ?? null;
}
