/**
 * Caption files for the clip fallback, loaded with Vite's ?raw import.
 *
 * Kept apart from items.ts and captions.ts so the unit tests (plain
 * Node, no Vite) never import it. Read-only: the .vtt files live under
 * docs/scaling/journals and are never edited here.
 */
import { cueText } from "./captions.ts";
import type { CaptionRef } from "./items.ts";

const RAW: Record<string, string> = {
  ...(import.meta.glob("../../../docs/scaling/journals/*/captions/*.vtt", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>),
  ...(import.meta.glob("../../../docs/scaling/journals/*/*.vtt", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>),
};

const BY_KEY = new Map<string, string>();
for (const [path, text] of Object.entries(RAW)) {
  const match = /\/journals\/([^/]+)\/(?:captions\/)?([^/]+\.vtt)$/.exec(path);
  if (match) BY_KEY.set(`${match[1]}/${match[2]}`, text);
}

/** The caption text for a clip, timestamps stripped, or null. */
export function captionTextFor(ref: CaptionRef | null): string | null {
  if (!ref) return null;
  const source = BY_KEY.get(`${ref.journal}/${ref.file}`);
  if (source === undefined) return null;
  const text = cueText(source);
  return text.length > 0 ? text : null;
}
