export type LonLat = [number, number];

export type RingId = "lincoln" | "region" | "nebraska" | "usa" | "world";

export type Shape =
  | { kind: "point"; coordinates: LonLat }
  | { kind: "polygon"; coordinates: LonLat[] };

export type Place = {
  id: string;
  name: string;
  ring: RingId;
  difficulty: 1 | 2 | 3 | 4 | 5;
  reveal: LonLat;
  shape: Shape;
  story: string;
  source: { label: string; href: string };
};

export type Edition = "world" | "home";

export type HomeChoice = "lincoln" | "visitor";

export type MapStyle = "roads" | "bare";

export type ThemeChoice = "system" | "night" | "paper";

export type BonusKind = "country" | "continent" | "none";

export type Guess = {
  lon: number;
  lat: number;
  distanceKm: number;
  /** Rounded distance curve, before a country or continent lift. */
  distanceScore: number;
  /** Rounded score after the lift. This is what the round weight multiplies. */
  score: number;
  weight: number;
  bonus: BonusKind;
  knew: boolean | null;
  scoringVersion: 2;
};

export type Run = {
  edition: Edition;
  dateKey: string;
  home: HomeChoice;
  placeIds: string[];
  pending: LonLat | null;
  guesses: (Guess | null)[];
  index: number;
  phase: "aim" | "reveal";
  done: boolean;
};
