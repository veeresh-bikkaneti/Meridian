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

;
