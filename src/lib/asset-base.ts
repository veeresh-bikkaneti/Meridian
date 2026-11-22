/** Safe import.meta.env read (undefined under node --test — same seam as pwa.ts's viteEnv). */
export function assetBase(): string {
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
  const base = env?.BASE_URL ?? "/";
  return base.endsWith("/") ? base : `${base}/`;
}
