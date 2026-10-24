/**
 * Site analytics policy — Cloudflare Web Analytics only, optional, cookieless.
 *
 * WHY (owner decision, cited: "I deleted clarity and ga4 from
 * cloudflare account", 2026-10-21 — that day both IDs were deleted
 * from the `meridian` worker's Workers Builds variables and the
 * repo's GitHub Actions secrets were deleted on the owner's order,
 * done and verified the same day): Meridian is directed to
 * children, so every visitor is treated as a child. Google Analytics
 * (gtag) and Microsoft Clarity were removed outright — not consent-gated —
 * because both set cookies / persistent identifiers and Clarity records
 * sessions. A consent toggle would still have shipped third-party
 * trackers to a kids' audience the moment a grown-up tapped "yes".
 *
 * What remains: Cloudflare Web Analytics' beacon, which sets no cookies,
 * stores nothing in localStorage, and reports aggregate page-view counts.
 * It is injected ONLY when the build-time env var `VITE_CF_BEACON_TOKEN`
 * is set; unset → nothing renders (fail-closed, same convention the old
 * VITE_* analytics IDs used). Local/dev builds ship no analytics at all.
 *
 * Keep this the single source of the beacon URL: the Content-Security-
 * Policy in public/_headers allow-lists exactly this script host and the
 * `cloudflareinsights.com` connect host — nothing else analytics-related.
 */

/** The only third-party analytics script Meridian may load. */
export const CF_BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";

/** Attributes for the beacon <script>, or null when analytics is off. */
export interface CfBeaconScript {
  src: string;
  /** JSON payload Cloudflare reads from the tag: {"token": "..."} */
  "data-cf-beacon": string;
  defer: true;
}

/**
 * Pure: turn the (optional) build-time token into script attributes.
 * Rejects anything that is not a plain token (hex/alnum, dash, underscore)
 * so a mis-pasted secret can never inject markup or another URL.
 */
export function cfBeaconScript(token: string | undefined | null): CfBeaconScript | null {
  const t = typeof token === "string" ? token.trim() : "";
  if (!t || !/^[A-Za-z0-9_-]{8,128}$/.test(t)) return null;
  return { src: CF_BEACON_SRC, "data-cf-beacon": JSON.stringify({ token: t }), defer: true };
}
