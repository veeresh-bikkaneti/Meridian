import { formatDistance } from "@/game/geo";
import type { Run } from "@/game/run";
import { shareText } from "@/game/share";
import type { Starter } from "@/game/starters";
import { Button } from "@/components/ui/button";
import type { Drop } from "./game-app";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

// Frosted chrome tokens shared by the floating aim/reveal chrome.
const CHROME =
  "backdrop-blur-[14px] bg-[rgba(10,12,16,0.72)] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Single 500ms rise on mount; opacity-only fade under reduced motion. */
function Rise({
  children,
  reduced,
}: {
  children: React.ReactNode;
  reduced: boolean;
}) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      className={`transition-all ease-[cubic-bezier(0.16,1,0.3,1)] ${
        entered ? "translate-y-0 opacity-100" : reduced ? "opacity-0" : "translate-y-4 opacity-0"
      }`}
      style={{ transitionDuration: reduced ? "150ms" : "500ms" }}
    >
      {children}
    </div>
  );
}

/** Quick fade for the dismiss/restore transitions (267ms). */
function Fade({
  children,
  reduced,
}: {
  children: React.ReactNode;
  reduced: boolean;
}) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      className={`transition-opacity ease-out ${entered ? "opacity-100" : "opacity-0"}`}
      style={{ transitionDuration: reduced ? "0ms" : "267ms" }}
    >
      {children}
    </div>
  );
}

function formatSpot(lon: number, lat: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${ew}`;
}

function ShareResult({ run, copyVariant = "primary" }: { run: Run; copyVariant?: "primary" | "secondary" }) {
  const [copied, setCopied] = useState(false);
  const line = shareText({ regionName: run.regionName, dateKey: run.dateKey, hits: run.hits });
  return (
    <div className="flex flex-col gap-3">
      <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 px-4 py-3 font-sans text-sm leading-relaxed text-white">
        {line}
      </pre>
      <Button
        variant={copyVariant}
        onClick={() => {
          void navigator.clipboard.writeText(line).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        {copied ? "Copied" : "Copy result"}
      </Button>
    </div>
  );
}

export function ResultCard({
  run,
  place,
  drop,
  story,
  empty,
  dismissed,
  onDismissedChange,
  onContinue,
}: {
  run: Run;
  place: Starter | null;
  drop: Drop | null;
  story: string | null;
  empty: boolean;
  dismissed: boolean;
  onDismissedChange: (dismissed: boolean) => void;
  onContinue: () => void;
}) {
  const reduced = usePrefersReducedMotion();

  if (dismissed) {
    return (
      <div className="pointer-events-none absolute bottom-[max(16px,env(safe-area-inset-bottom))] left-2.5 z-20">
        <Fade reduced={reduced}>
          <button
            type="button"
            aria-label="Show result"
            onClick={() => onDismissedChange(false)}
            className={`pointer-events-auto flex h-11 items-center rounded-full px-4 text-sm font-medium text-white ${CHROME}`}
          >
            Result
          </button>
        </Fade>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-2.5 pb-[max(16px,env(safe-area-inset-bottom))]">
      <Rise reduced={reduced}>
        <section
          aria-label="Result"
          className={`pointer-events-auto max-h-[45dvh] w-full max-w-[420px] overflow-y-auto rounded-2xl p-4 text-white ${CHROME}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {place ? (
                <>
                  <p className="text-[11px] tracking-wider text-white/60 uppercase">
                    {run.regionName}
                  </p>
                  <h2 className="mt-0.5 font-display text-2xl leading-tight">{place.name}</h2>
                </>
              ) : (
                <h2 className="font-display text-2xl leading-tight">{run.regionName}</h2>
              )}
            </div>
            <button
              type="button"
              aria-label="Hide result"
              onClick={() => onDismissedChange(true)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          {run.phase === "story" && place ? (
            <div className="mt-3 flex flex-col gap-3">
              <p className="font-display text-4xl tabular-nums">
                {drop ? formatDistance(drop.distanceKm) : "Hit"}
              </p>
              <p className="text-sm text-white/70">
                The line is your pin to the spot. The circle is close enough.
              </p>
              <div className="max-h-44 overflow-y-auto">
                <p className="text-sm leading-relaxed">{story ?? place.story}</p>
              </div>
              <a
                className="text-sm text-white/70 underline"
                href={place.sourceHref}
                target="_blank"
                rel="noreferrer"
              >
                {place.sourceLabel}
              </a>
              <Button onClick={onContinue}>Next place</Button>
            </div>
          ) : null}

          {run.phase === "done" && place ? (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-sm text-white/70">That pin is outside the radius.</p>
              {drop && drop.placeId === place.id ? (
                <p className="text-sm">
                  Your pin was {formatSpot(drop.lon, drop.lat)},{" "}
                  {formatDistance(drop.distanceKm)} away. The spot is{" "}
                  {formatSpot(place.lon, place.lat)}.
                </p>
              ) : (
                <p className="text-sm">The spot is {formatSpot(place.lon, place.lat)}.</p>
              )}
              <Button onClick={onContinue}>Next place</Button>
              <ShareResult run={run} copyVariant="secondary" />
            </div>
          ) : null}

          {run.phase === "done" && empty ? (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-sm text-white/70">
                This trail has no places yet.
              </p>
              <ShareResult run={run} />
            </div>
          ) : null}
        </section>
      </Rise>
    </div>
  );
}
