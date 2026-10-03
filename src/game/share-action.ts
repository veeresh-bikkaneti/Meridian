import { BRAND } from "./brand.ts";
import type { SessionSummary } from "./session.ts";
import { shareText } from "./share.ts";

/**
 * Outcome of a share attempt.
 *
 * - `shared` — the native share sheet accepted the payload.
 * - `copied` — no share sheet; the text landed on the clipboard.
 * - `cancelled` — the user dismissed the native share sheet without
 *   sharing. NOT an error: the caller should stay quiet (auto-copying
 *   after a user-initiated cancel would be the wrong move).
 * - `failed` — neither path worked; the caller should render the text in
 *   a selectable `<pre>` so the player can copy it manually.
 */
export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/**
 * Share a score line through the native share sheet when available,
 * falling back to the clipboard. Zero-cost: no third-party SDKs.
 *
 * `navigator.share` requires a user gesture (this is always called from a
 * button click) and HTTPS; guarded by feature detection so older browsers
 * drop straight to the clipboard path.
 */
export async function shareScore(input: {
  title: string;
  text: string;
  url: string;
}): Promise<ShareOutcome> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: input.title, text: input.text, url: input.url });
      return "shared";
    } catch (err) {
      // A dismissed share sheet throws AbortError — the user changed their
      // mind, so surface nothing. Any other failure (not supported for the
      // payload, secure-context issue, …) falls through to the clipboard.
      // Name-only check (no DOMException gating): polyfills and embedded
      // webviews may reject with a plain Error named AbortError rather than
      // a DOMException, and both must stay silent.
      if ((err as { name?: string } | null)?.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  try {
    await navigator.clipboard.writeText(input.text);
    return "copied";
  } catch {
    return "failed";
  }
}

/**
 * The end-game session payload for `shareText()`: session totals only.
 *
 * The per-place emoji strip is deliberately omitted — the session banks
 * totals, never per-place scores, and the strip is optional in the
 * approved format. Nothing per-place (no place names, no distances) can
 * leak into the shared text through this builder.
 */
export function sessionShareText(input: {
  summary: SessionSummary;
  regionName: string;
  dateKey: string;
  now?: Date;
}): string {
  return shareText({
    regionName: input.regionName,
    dateKey: input.dateKey,
    totalScore: input.summary.totalScore,
    placesPlayed: input.summary.placesPlayed,
    averagePerPlace: input.summary.averagePerPlace,
    bestStreak: input.summary.bestStreak,
    now: input.now,
  });
}

/** The canonical share target — the text already carries it on its own line. */
export const SHARE_URL = BRAND.siteUrl;
