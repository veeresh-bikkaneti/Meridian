import type { AgeBandId } from "@/game/age-profile";
import { assetBase } from "./storyteller-lines.ts";

export type PeoplePlacesGroup = "7-10" | "10-18" | "18+";

export type PeoplePlacesFilm = {
  id: string;
  clip: string;
  group: PeoplePlacesGroup;
  placeName: string;
  caption: string;
};

/**
 * The five screened clips, in clips.json order. Spoken words are the
 * caption string and nothing else. Narration files stay empty until a
 * local Kokoro ONNX model is on disk.
 */
export const PEOPLE_PLACES_FILMS: readonly PeoplePlacesFilm[] = [
  {
    id: "people-places:akashi-span",
    clip: "akashi-span",
    group: "7-10",
    placeName: "Akashi Kaikyo Bridge, between Kobe and Awaji Island, Japan",
    caption: "Hey kids, have you heard about this place? Its middle span is 1,991 meters long.",
  },
  {
    id: "people-places:pont-du-gard",
    clip: "pont-du-gard",
    group: "7-10",
    placeName: "Pont du Gard, over the Gard River, southern France",
    caption: "Hey kids, have you heard about this place? This bridge in France has 35 arches on its top row.",
  },
  {
    id: "people-places:eratosthenes-earth",
    clip: "eratosthenes-earth",
    group: "10-18",
    placeName: "Alexandria, Egypt",
    caption: "Hey kids, have you heard about this place? In Alexandria, Eratosthenes multiplied 5,000 stadia by 50.",
  },
  {
    id: "people-places:andean-roads",
    clip: "andean-roads",
    group: "10-18",
    placeName: "Cusco, Peru (one city on the Andean road network, not the whole network)",
    caption: "Hey kids, have you heard about this place? These Andean roads stretch about 30,000 kilometers.",
  },
  {
    id: "people-places:aconcagua-height",
    clip: "aconcagua-height",
    group: "18+",
    placeName: "Aconcagua, Mendoza, Argentina, on the Chilean border",
    caption: "Hey kids, have you heard about this place? Aconcagua, in Argentina, is the Americas' tallest peak. Its published heights disagree.",
  },
];

const RANK: Record<PeoplePlacesGroup, number> = { "7-10": 0, "10-18": 1, "18+": 2 };

export function filmsForBand(band: AgeBandId): PeoplePlacesFilm[] {
  const cap = RANK[band];
  return PEOPLE_PLACES_FILMS.filter((film) => RANK[film.group] <= cap);
}

export function peoplePlacesMedia(clip: string): {
  videoUrl: string;
  posterUrl: string;
  stillUrl: string;
} {
  const stillUrl = `${assetBase()}images/journals/people-places/${clip}.webp`;
  return {
    stillUrl,
    posterUrl: stillUrl,
    videoUrl: `${assetBase()}videos/journals/people-places/${clip}.mp4`,
  };
}

/** Empty until a local voice file is added. The caption is the words. */
const NARRATION_FILES: Record<string, string> = {};

export function peoplePlacesNarrationUrl(clip: string): string | null {
  return NARRATION_FILES[clip] ?? null;
}
