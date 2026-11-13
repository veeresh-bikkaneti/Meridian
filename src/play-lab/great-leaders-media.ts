/**
 * Built KEEP clips for the great-leaders journal.
 * captionText is the caption cues joined with single spaces.
 * play-lab.test.ts fails if that string drifts from the .vtt file.
 * narrationUrl stays null until a local Kokoro render exists.
 * CardFilm is muted, so a future narration file is a separate audio element.
 * assetBase is copied from storyteller-lines.ts so node:test can load this
 * file without the Vite "@/" alias.
 */
function assetBase(): string {
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
  const base = env?.BASE_URL ?? "/";
  return base.endsWith("/") ? base : `${base}/`;
}
export interface GreatLeadersClipMedia {
  id: string;
  stillUrl: string;
  videoUrl: string;
  captionUrl: string;
  captionText: string;
  narrationUrl: string | null;
}

const STILL_DIR = "images/journals/great-leaders";
const MEDIA_DIR = "videos/journals/great-leaders";

function clipMedia(
  id: string,
  fileStem: string,
  captionText: string,
): GreatLeadersClipMedia {
  const base = assetBase();
  return {
    id,
    stillUrl: `${base}${STILL_DIR}/${fileStem}.webp`,
    videoUrl: `${base}${MEDIA_DIR}/${fileStem}.mp4`,
    captionUrl: `${base}${MEDIA_DIR}/${fileStem}.vtt`,
    captionText,
    narrationUrl: null,
  };
}

export const GREAT_LEADERS_MEDIA: Record<string, GreatLeadersClipMedia> = {
  "great-leaders:lincoln-memorial": clipMedia(
    "great-leaders:lincoln-memorial",
    "lincoln-memorial",
    "Hey kids, have you heard about this place? Washington, D.C., 1922. Thirty-six columns outside. Inside, Lincoln sits, carved in marble.",
  ),
  "great-leaders:jhansi-fort": clipMedia(
    "great-leaders:jhansi-fort",
    "jhansi-fort",
    "Hey kids, have you heard about this place? Queen Lakshmibai ruled Jhansi for her young son.",
  ),
  "great-leaders:netaji-bhawan": clipMedia(
    "great-leaders:netaji-bhawan",
    "netaji-bhawan",
    "Hey kids, have you heard about this place? Netaji Subhas Bose lived here. He made the greeting 'Jai Hind' famous.",
  ),
};

export function greatLeadersMedia(id: string): GreatLeadersClipMedia | null {
  return GREAT_LEADERS_MEDIA[id] ?? null;
}
