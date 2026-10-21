/// <reference types="vite/client" />

/**
 * Build-time environment variables (GitHub Secrets → Actions env → Vite).
 *
 * Veeresh 2026-10-07: no hardcoded key details in source. All are
 * optional — when unset/empty at build time, the corresponding tag/link
 * does not render at all (fail-closed). Local dev builds fine without them.
 */
interface ImportMetaEnv {
  /**
   * Cloudflare Web Analytics beacon token (cookieless, aggregate only).
   * Unset → no analytics tag at all. Google Analytics and Microsoft
   * Clarity were removed 2026-10-21 (COPPA) — do not re-add their IDs.
   */
  readonly VITE_CF_BEACON_TOKEN?: string;
  /** Ko-fi tip-jar URL. Unset → support footer does not render. */
  readonly VITE_KOFI_URL?: string;
}
