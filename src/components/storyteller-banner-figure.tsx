import { useEffect, useState } from "react";
import { storytellerFigureUrl } from "./storyteller-lines";

/**
 * Storyteller banner figure — owner correction 2026-10-09 (overrides #114).
 *
 * The storyteller sits IN THE BANNER beside the Meridian branding
 * (`.atlas-banner-row`), always visible on mobile and desktop. He is
 * banner chrome: decorative (`aria-hidden="true"`), NOT a tap target —
 * there is no poke interaction, no focus, no click handler. (Documented
 * choice per the owner's "always visible, no hidden states" direction.)
 *
 * Directly imported by game-app.tsx (above the fold — no React.lazy).
 * The pose resolves from storyteller-assets.json so the F1/F2 cutout
 * swaps in with zero code change; until then the 17KB placeholder JPEG.
 */

export interface AssetManifest {
  version: number;
  poses: { idle: string | null; pointing: string | null };
  audio: Record<string, string | null>;
}

/** Same-origin base read (undefined under node --test — mirrors storyteller-lines). */
function assetBase(): string {
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
  const base = env?.BASE_URL ?? "/";
  return base.endsWith("/") ? base : `${base}/`;
}

let manifestPromise: Promise<AssetManifest | null> | null = null;

/**
 * storyteller-assets.json — module-cached, shared with the banner host
 * (which also needs the greet-audio URLs and the pointing pose).
 * Null when unreachable: fail-closed to the placeholder pose.
 */
export function loadAssetManifest(): Promise<AssetManifest | null> {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      try {
        const res = await fetch(
          `${assetBase()}assets/storyteller/storyteller-assets.json`,
        );
        if (!res.ok) return null;
        return (await res.json()) as AssetManifest;
      } catch {
        return null;
      }
    })();
  }
  return manifestPromise;
}

/** Test-only: drop the cached manifest. */
export function resetBannerFigureForTests(): void {
  manifestPromise = null;
}

export function StorytellerBannerFigure() {
  const [pose, setPose] = useState<string>(storytellerFigureUrl());

  useEffect(() => {
    let cancelled = false;
    void loadAssetManifest().then((manifest) => {
      if (cancelled || !manifest?.poses.idle) return;
      setPose(`${assetBase()}${manifest.poses.idle}`);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <img
      className="storyteller-banner-figure"
      data-testid="storyteller-banner-figure"
      src={pose}
      alt=""
      aria-hidden="true"
      decoding="async"
      draggable={false}
    />
  );
}
