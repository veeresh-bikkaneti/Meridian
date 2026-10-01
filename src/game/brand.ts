/** Public identity. UI, share text, and storage all read this — nothing else hard-codes the name. */
export const BRAND = {
  name: "Meridian",
  shareHost: "meridian",
  siteUrl: "https://veeresh-bikkaneti.github.io/Meridian/",
  tagline: "Five places. Once a day. Drop the pin.",
  storageKey: "meridian.session.v1",
  cookie: "meridian_session",
  legacyStorageKeys: ["waymark.session.v1", "waymark.session.v2"],
  legacyCookies: ["waymark_session"],
} as const;
