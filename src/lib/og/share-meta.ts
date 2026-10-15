import { BRAND } from "../../game/brand.ts";
import site from "./site.json" with { type: "json" };

/** GitHub Pages origin (the Pages build serves under the /Meridian/ base). */
export const PAGES_ORIGIN = "https://veeresh-bikkaneti.github.io/Meridian/";

/** Workers origin, used by every non-Pages build. */
export const WORKERS_ORIGIN = BRAND.siteUrl;

export const SHARE_TITLE_MAX = 60;
export const SHARE_DESCRIPTION_MAX = 155;

export const SHARE_TITLE = "Meridian: guess the place, then read its story";
export const SHARE_DESCRIPTION: string = site.description;
export const SHARE_IMAGE_ALT = "The word Meridian over a dark green world map with a location pin.";

/**
 * Vite sets base "/Meridian/" only for the GitHub Pages build, so the share
 * origin follows the build that is actually being served.
 */
export function shareOrigin(baseUrl: string): string {
  return baseUrl === "/Meridian/" ? PAGES_ORIGIN : WORKERS_ORIGIN;
}

export type ShareMetaTag = { property: string; content: string } | { name: string; content: string };

export function shareMetaTags(input: {
  title: string;
  description: string;
  origin: string;
  imageAlt?: string;
}): ShareMetaTag[] {
  const { title, description, origin, imageAlt = SHARE_IMAGE_ALT } = input;
  const image = `${origin}og.jpg`;
  return [
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: origin },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: imageAlt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];
}
