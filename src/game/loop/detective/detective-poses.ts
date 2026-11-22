/** Pose names for the detective pair rigs. */
export const HOLMES_POSES = [
  "dock",
  "walk",
  "search",
  "berth-think",
  "ack",
  "announce",
  "gaze-up",
  "card-look",
  "celebrate-jump",
  "high-five",
  "clap",
  "pout",
] as const;
export type HolmesPose = (typeof HOLMES_POSES)[number];

export const WATSON_POSES = [
  "walk",
  "read",
  "think",
  "station-idle",
  "notebook-mark",
  "gasp",
  "celebrate-jump",
  "high-five",
  "clap",
  "pout",
] as const;
export type WatsonPose = (typeof WATSON_POSES)[number];
