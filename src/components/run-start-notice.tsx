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
  "fixed inset-x-4 top-44 z-50 mx-auto max-w-md rounded-xl border border-fg/30 bg-surface p-4 text-center text-base text-fg shadow-xl";

const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
        <div
          ref={alertRef}
          role="alert"
          tabIndex={-1}
          className={`${BOX} focus:outline-none`}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              error.onKeepPlaying();
            }
          }}
        >
          <p>
            {error.staleBuild
              ? "A new version of Meridian is available."
              : error.scope === "band"
                ? `${error.label} needs the internet to bring its new places. Ask a grown-up to help you get online, then tap Try again!`
                : `${sentenceCase(error.label)} needs the internet to bring its places. Ask a grown-up to help you get online, then tap Try again!`}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {error.staleBuild ? (
              <Button type="button" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg" onClick={error.onRefresh}>
                Refresh
              </Button>
            ) : (
              <Button type="button" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg" onClick={error.onTryAgain}>
                Try again
              </Button>
            )}
            <Button type="button" variant="secondary" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg" onClick={error.onKeepPlaying}>
              Keep playing
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
