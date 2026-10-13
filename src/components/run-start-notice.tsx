import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export interface RunStartNoticeProps {
  /** What is loading ("Medium", "Nebraska"); null when nothing is loading. */
  loadingLabel: string | null;
  /** Set when the requested start failed. */
  error: null | {
    /** "Medium" for a band change in the same place, else the place name. */
    label: string;
    scope: "band" | "region";
    /** The tab predates the current deploy: offer the existing refresh instead. */
    staleBuild: boolean;
    onTryAgain: () => void;
    onKeepPlaying: () => void;
    onRefresh: () => void;
  };
}

const BOX =
  "fixed inset-x-4 top-44 z-50 mx-auto max-w-md rounded-xl border border-line bg-surface p-4 text-center text-sm text-fg shadow-xl";

/**
 * In-run feedback for a run start (the celebration's "Try Medium"/"Try Hard",
 * neighbor/country/Globe promotions). GameApp renders the Play screen whenever
 * a run exists, so the menu-only loading screen and loadNotice never show
 * here; this does. Rendered only while a run is on screen.
 */
export function RunStartNotice({ loadingLabel, error }: RunStartNoticeProps) {
  const alertRef = useRef<HTMLDivElement | null>(null);
  const hasError = error !== null;
  useEffect(() => {
    if (hasError) alertRef.current?.focus({ preventScroll: true });
  }, [hasError]);

  return (
    <>
      <p role="status" className={loadingLabel !== null ? BOX : "sr-only"}>
        {loadingLabel !== null ? `Getting ${loadingLabel} ready…` : ""}
      </p>
      {error ? (
        <div ref={alertRef} role="alert" tabIndex={-1} className={`${BOX} focus:outline-none`}>
          <p>
            {error.staleBuild
              ? "A new version of Meridian is available."
              : error.scope === "band"
                ? `${error.label} needs the internet to bring its new places. Get online, then try again!`
                : `${error.label} needs the internet to bring its places. Get online, then try again!`}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {error.staleBuild ? (
              <Button type="button" onClick={error.onRefresh}>
                Refresh
              </Button>
            ) : (
              <Button type="button" onClick={error.onTryAgain}>
                Try again
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={error.onKeepPlaying}>
              Keep playing
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
