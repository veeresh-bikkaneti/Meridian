import { useEffect, useRef, type JSX } from "react";
import { Button } from "@/components/ui/button";
import { ADMIN1_BY_COUNTRY, COUNTRIES } from "@/game/regions";
import { STATE_NAMES, STATE_NEIGHBORS } from "@/game/state-neighbors";
import type { Edition } from "@/game/run";
import type { PickerDifficulty } from "@/game/tier-filter";

/**
 * The cleared-mode celebration: one dialog per completed difficulty band,
 * shown at the onContinue boundary (or the run-start backstop) — never
 * mid-question. Tone is invitation, not exile: every clear promotes the
 * player to the next challenge and always offers a quiet replay of the
 * band they just finished.
 *
 * All player-visible strings live in CLEARED_COPY below so the tone/docs
 * review crew has a single place to audit. Copy is kid-friendly: short,
 * proud, plain words, history-first spirit.
 */

export const CLEARED_COPY = {
  dismissLabel: "Close celebration",
  easy: {
    /** `where` is "in Nebraska" or "around the Globe". */
    heading: (where: string) => `You cleared Easy mode ${where}! 🎉`,
    body: "You found every famous place on the Easy path — all of them! Ready for trickier places?",
    tryMedium: "Try Medium",
    tryHard: "Try Hard",
    replay: "Replay Easy",
  },
  medium: {
    heading: (where: string) => `You cleared Medium ${where}! 🎉`,
    body: "Famous places and hidden gems — you found every place on the Medium path. Only the toughest spots are left.",
    tryHard: "Try Hard",
    replay: "Replay Medium",
  },
  hard: {
    /** `region` is the state/country name, or "world" for the Globe. */
    heading: (region: string) => `True ${region} explorer! 🏆`,
    body: "You found every place here, even the really tricky ones. Where will you explore next?",
    bodyGlobe:
      "You found every place on the planet, even the really tricky ones. Where will you explore next?",
    replay: "Replay Hard",
    playGlobe: "Play the Globe",
    moreEditions: "More editions",
    tryNeighbor: (name: string) => `Try ${name}`,
    tryCountry: (name: string) => `Try ${name}`,
  },
} as const;

/** What the celebration was shown for: edition + region + cleared band. */
export type ClearedInfo = {
  edition: Edition;
  regionId: string;
  regionName: string;
  choice: PickerDifficulty;
};

type NextStep = { label: string; go: () => void };

/**
 * The state (if any) whose admin-1 list contains this region — today that
 * is the United States for US states. Used for the Hard-cleared fallback
 * when a state has no neighbor data.
 */
function parentCountryOf(stateId: string): { id: string; name: string } | null {
  for (const [countryId, regions] of Object.entries(ADMIN1_BY_COUNTRY)) {
    if (regions.some((region) => region.id === stateId)) {
      const country = COUNTRIES.find((c) => c.id === countryId);
      return { id: countryId, name: country?.name ?? countryId };
    }
  }
  return null;
}

/**
 * Next-edition suggestions after a Hard clear. For a US state: up to 2
 * neighboring states by name. For a state with no neighbor data, a country,
 * or the Globe: the parent country (when known) and/or the Globe — never an
 * empty or broken button. The Globe itself offers "More editions" instead
 * (rendered separately), so this returns no steps for it.
 */
function hardNextSteps(
  info: ClearedInfo,
  onPlayBand: (
    edition: Edition,
    regionId: string,
    regionName: string,
    choice: PickerDifficulty,
  ) => void,
): NextStep[] {
  const playGlobe = (): void =>
    onPlayBand("globe", "globe", "Globe", info.choice);
  if (info.edition === "state") {
    const neighbors = (STATE_NEIGHBORS[info.regionId] ?? []).slice(0, 2);
    if (neighbors.length > 0) {
      return neighbors.map((neighborId) => {
        const name = STATE_NAMES[neighborId] ?? neighborId;
        return {
          label: CLEARED_COPY.hard.tryNeighbor(name),
          go: () => onPlayBand("state", neighborId, name, info.choice),
        };
      });
    }
    const steps: NextStep[] = [];
    const parent = parentCountryOf(info.regionId);
    if (parent) {
      steps.push({
        label: CLEARED_COPY.hard.tryCountry(parent.name),
        go: () => onPlayBand("country", parent.id, parent.name, info.choice),
      });
    }
    steps.push({ label: CLEARED_COPY.hard.playGlobe, go: playGlobe });
    return steps;
  }
  if (info.edition === "country") {
    return [{ label: CLEARED_COPY.hard.playGlobe, go: playGlobe }];
  }
  return [];
}

const BAND_LABEL: Record<PickerDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function ClearedCelebrationDialog(props: {
  info: ClearedInfo;
  onDismiss: () => void;
  onPlayBand: (
    edition: Edition,
    regionId: string,
    regionName: string,
    choice: PickerDifficulty,
  ) => void;
  /** Back to the edition picker (used for the Globe's "More editions"). */
  onBrowseEditions: () => void;
}): JSX.Element {
  const { info, onDismiss, onPlayBand, onBrowseEditions } = props;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus the heading on open so screen-reader users land on the news.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Escape dismisses; the player stays on the answered reveal.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const where = info.edition === "globe" ? "around the Globe" : `in ${info.regionName}`;
  const heading =
    info.choice === "hard"
      ? CLEARED_COPY.hard.heading(info.edition === "globe" ? "world" : info.regionName)
      : info.choice === "easy"
        ? CLEARED_COPY.easy.heading(where)
        : CLEARED_COPY.medium.heading(where);
  const body =
    info.choice === "easy"
      ? CLEARED_COPY.easy.body
      : info.choice === "medium"
        ? CLEARED_COPY.medium.body
        : info.edition === "globe"
          ? CLEARED_COPY.hard.bodyGlobe
          : CLEARED_COPY.hard.body;

  const switchBand = (choice: PickerDifficulty): void =>
    onPlayBand(info.edition, info.regionId, info.regionName, choice);
  const replay = (): void => switchBand(info.choice);

  const primary: NextStep[] =
    info.choice === "easy"
      ? [
          { label: CLEARED_COPY.easy.tryMedium, go: () => switchBand("medium") },
          { label: CLEARED_COPY.easy.tryHard, go: () => switchBand("hard") },
        ]
      : info.choice === "medium"
        ? [{ label: CLEARED_COPY.medium.tryHard, go: () => switchBand("hard") }]
        : hardNextSteps(info, onPlayBand);
  const replayLabel =
    info.choice === "easy"
      ? CLEARED_COPY.easy.replay
      : info.choice === "medium"
        ? CLEARED_COPY.medium.replay
        : CLEARED_COPY.hard.replay;
  // The Globe has no next edition to suggest — offer the picker instead.
  const showBrowse = info.choice === "hard" && info.edition === "globe";

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cleared-celebration-heading"
      data-testid="cleared-celebration"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[rgba(10,12,16,0.95)] p-6 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] tracking-wider text-white/60 uppercase">
            {info.regionName} · {BAND_LABEL[info.choice]}
          </p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={CLEARED_COPY.dismissLabel}
            className="rounded-md px-2 py-1 text-lg leading-none text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </div>
        <h2
          id="cleared-celebration-heading"
          ref={headingRef}
          tabIndex={-1}
          className="mt-1 font-display text-2xl outline-none"
        >
          {heading}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{body}</p>

        <div className="mt-5 flex flex-col gap-2">
          {primary.map((step) => (
            <Button key={step.label} className="w-full" size="lg" onClick={step.go}>
              {step.label}
            </Button>
          ))}
          {showBrowse ? (
            <Button variant="secondary" className="w-full" onClick={onBrowseEditions}>
              {CLEARED_COPY.hard.moreEditions}
            </Button>
          ) : null}
        </div>
        <div className="mt-2 text-center">
          <Button
            variant="ghost"
            className="text-sm text-white/60 hover:text-white"
            onClick={replay}
          >
            {replayLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
