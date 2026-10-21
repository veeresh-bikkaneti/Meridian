/**
 * Public identity. UI, share text, and storage all read this — nothing else hard-codes the name.
 *
 * No cookie names here (review S10, 2026-10-21): Meridian sets no cookies.
 * The old `cookie: "meridian_session"` / `legacyCookies: ["waymark_session"]`
 * entries were dead config that nothing read or wrote, and the review flagged
 * them as confusing for a no-tracking kids' game. brand.test.ts keeps them
 * from coming back.
 */
export const BRAND = {
  name: "Meridian",
  shareHost: "meridian",
  siteUrl: "https://meridian.knowledgetest.workers.dev/",
  tagline: "Explore the world, one pin at a time — where every guess unlocks a new story.",
  storageKey: "meridian.session.v1",
  legacyStorageKeys: ["waymark.session.v1", "waymark.session.v2"],
} as const;
