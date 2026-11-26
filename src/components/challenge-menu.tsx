import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  CHALLENGE_FAIRNESS_COPY,
  CHALLENGE_MIN_PLACES,
  CHALLENGE_SHARE_LABEL,
  buildFreshChallengeShareText,
  type ChallengeCreation,
} from "@/game/challenge";
import { poolSizeFor } from "@/game/generated-places";
import { COUNTRIES, STATES, type Region } from "@/game/regions";
import type { Edition } from "@/game/run";
import { Button } from "@/components/ui/button";
import { ShareButton } from "./share-button";

/**
 * Step 19 (TD-06.9) — the challenge region picker and its "challenge
 * ready" preview sheet.
 *
 * The composer keeps the main shell and the HomeButton (the
 * frozen shell-ban baseline forbids a page-local main element in a new
 * file); this view renders the inner content only. The boot notice
 * arrives as a slot — the same element is shared across Home and
 * the menus — and the tap sound for a region pick stays with the
 * composer, which wraps onPickRegion.
 */
export function ChallengeMenu({
  notice,
  pickError,
  preview,
  onDismissPreview,
  onPickRegion,
}: {
  /** Boot notice element, built by the composer (shared across Home + menus). */
  notice: ReactNode;
  pickError: string | null;
  preview: {
    creation: ChallengeCreation;
    edition: Edition;
    regionId: string;
  } | null;
  onDismissPreview: () => void;
  onPickRegion: (edition: Edition, regionId: string) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  // The challenge region picker: every playable region with at least
  // CHALLENGE_MIN_PLACES catalog places, grouped by edition. A state
  // row deals THAT state; a country row deals THAT country — region
  // fidelity is the whole point of mc2.
  const globeCount = poolSizeFor("globe", "globe");
  const countries = COUNTRIES.filter((c) => poolSizeFor("country", c.id) >= CHALLENGE_MIN_PLACES);
  const states = STATES.filter((s) => poolSizeFor("state", s.id) >= CHALLENGE_MIN_PLACES);
  const rowClass =
    "flex min-h-11 items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left text-base text-fg";
  const regionRow = (edition: Edition, region: Region) => (
    <button
      key={`${edition}:${region.id}`}
      type="button"
      className={rowClass}
      onClick={() => onPickRegion(edition, region.id)}
    >
      <span>{region.name}</span>
      <span className="text-sm text-muted">{poolSizeFor(edition, region.id)} places</span>
    </button>
  );

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="mt-4 font-display text-3xl text-fg">
        Challenge a friend
      </h1>
      <p className="mt-2 text-base text-muted">
        Pick a region. We deal {CHALLENGE_MIN_PLACES} places from it, and your friend plays the
        same route.
      </p>
      {notice}
      {pickError ? (
        <p role="status" className="mt-3 text-base text-fg">
          {pickError}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-2">
        {globeCount >= CHALLENGE_MIN_PLACES
          ? regionRow("globe", { id: "globe", name: "Globe", bounds: [0, 0, 0, 0] })
          : null}
        <h2 className="mt-4 text-sm tracking-wide text-muted uppercase">Countries</h2>
        {countries.map((region) => regionRow("country", region))}
        <h2 className="mt-4 text-sm tracking-wide text-muted uppercase">US states</h2>
        {states.map((region) => regionRow("state", region))}
      </div>
      {preview
        ? (() => {
            const { creation } = preview;
            const url = `${window.location.origin}${window.location.pathname}${creation.fragment}`;
            const text = buildFreshChallengeShareText({
              placeCount: creation.placeCount,
              regionName: creation.regionName,
              radiusKm: creation.radiusKm,
              url,
            });
            return (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                role="dialog"
                aria-modal="true"
                aria-label="Challenge a friend"
                data-testid="challenge-preview"
              >
                <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-2xl">
                  <h2 className="font-display text-2xl text-fg">Challenge a friend</h2>
                  <p className="mt-3 text-base text-fg">
                    {creation.placeCount} places in {creation.regionName}
                  </p>
                  <p className="mt-1 text-base text-muted">
                    Get inside the {creation.radiusKm} km circle — closer is better!
                  </p>
                  <p className="mt-2 text-base text-muted">{CHALLENGE_FAIRNESS_COPY}</p>
                  <p className="mt-2 text-base text-muted">
                    Your friend gets this exact route — the same {creation.placeCount} places, in
                    this order.
                  </p>
                  <div className="mt-5 flex flex-col gap-2">
                    <div data-testid="challenge-share-container" data-challenge-url={url}>
                      <ShareButton
                        title="Meridian friend challenge"
                        text={text}
                        url={url}
                        label={CHALLENGE_SHARE_LABEL}
                        className="w-full"
                        failureFallback={
                          <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap wrap-anywhere rounded-lg border border-line bg-bg px-4 py-3 font-sans text-sm leading-relaxed text-fg">
                            {text}
                          </pre>
                        }
                      />
                    </div>
                    <Button variant="secondary" onClick={onDismissPreview}>
                      Back
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()
        : null}
    </>
  );
}
