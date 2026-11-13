export const ROBBEN_ISLAND_CLIP_ID = "freedom-fighters:robben-island";

export const ROBBEN_ISLAND_CAPTION =
  "Hey kids, have you heard about this place? Nelson Mandela was held here. Today it is a museum.";

export const ROBBEN_ISLAND_FILM = {
  videoUrl: "/videos/journals/freedom-fighters/robben-island.mp4",
  posterUrl: "/images/journals/freedom-fighters/robben-island.webp",
  stillUrl: "/images/journals/freedom-fighters/robben-island.webp",
} as const;

export const ROBBEN_ISLAND_NARRATION_URL = "/audio/journals/freedom-fighters/robben-island.m4a";

const READY = new Set<string>([ROBBEN_ISLAND_CLIP_ID]);

export function clipLeavesComingSoon(id: string): boolean {
  return READY.has(id);
}
