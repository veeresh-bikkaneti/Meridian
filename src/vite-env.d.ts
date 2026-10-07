/// <reference types="vite/client" />

/**
 * Build-time environment variables (GitHub Secrets → Actions env → Vite).
 *
 * Veeresh 2026-10-07: no hardcoded key details in source. All three are
 * optional — when unset/empty at build time, the corresponding tag/link
 * does not render at all (fail-closed). Local dev builds fine without them.
 */
interface ImportMetaEnv {
  /** GA4 Measurement ID (e.g. G-XXXXXXXXXX). Unset → analytics tags omitted. */
  readonly VITE_GA4_MEASUREMENT_ID?: string;
  /** Microsoft Clarity Project ID. Unset → Clarity tag omitted. */
  readonly VITE_CLARITY_PROJECT_ID?: string;
  /** Ko-fi tip-jar URL. Unset → support footer does not render. */
  readonly VITE_KOFI_URL?: string;
}
