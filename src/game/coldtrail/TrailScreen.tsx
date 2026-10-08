import { useState, type JSX } from "react";
import { formatDistance } from "@/game/geo";
import { Button } from "@/components/ui/button";
import { playConfirmGuess, playLose, playWin } from "@/game/audio/sfx";
import { LoopMap, type TrailEvidenceMark, type TrailEvidenceRing } from "../loop/LoopMap";
import { coldtrailCaseCount, getColdtrailCase } from "./cases";
import {
  effectiveRadius,
  INFORMANT_COST,
  scoreIntercept,
  SOLVE_REWARD,
  verdictFor,
} from "./engine";
import { freshProgress, loadColdtrail, saveColdtrail } from "./store";
import { InterceptConfirm } from "./InterceptConfirm";
import { SightingCard } from "./SightingCard";
import type { ColdTrailStore } from "./types";

/**
 * Cold Trail vertical slice: one case = 3 timestamped sightings → place 3
 * radius rings → tap the interception guess → score reveal (km from the
 * true hideout).
 *
 * The map is the shared Detective's Atlas (LoopMap) in free-tap mode: taps
 * report raw coordinates instead of resolving to labeled places, and the
 * sighting rings are painted as evidence overlays. No place index is
 * fetched in this mode.
 */
export function TrailScreen({ onLeave }: { onLeave: () => void }): JSX.Element {
  const [store, setStore] = useState<ColdTrailStore>(loadColdtrail);
  const [pending, setPending] = useState<{ lon: number; lat: number } | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const commit = (next: ColdTrailStore) => {
    saveColdtrail(next);
    setStore(next);
  };

  const deckSize = coldtrailCaseCount();
  const caseData = deckSize > 0 ? getColdtrailCase(store.caseIndex) : null;
  const progress = store.current ?? freshProgress();

  if (!caseData) {
    // Fail closed: a corrupt or empty deck never starts a broken case.
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8" data-testid="coldtrail-screen">
        <h1 className="font-display text-3xl text-fg">❄️ Cold Trail</h1>
        <p className="mt-4 text-fg" role="alert">
          The case files didn&rsquo;t load. No case to play right now.
        </p>
        <Button type="button" variant="secondary" onClick={onLeave} className="mt-6 min-h-[44px] self-start">
          ← Back
        </Button>
      </main>
    );
  }

  const ringsPlacedCount = progress.ringsPlaced.filter(Boolean).length;
  const allRingsPlaced = ringsPlacedCount === 3;
  const revealed = progress.revealed;

  const evidenceRings: TrailEvidenceRing[] = caseData.sightings.flatMap((s, i) => {
    if (!progress.ringsPlaced[i]) return [];
    const radius = effectiveRadius(s, progress.informantOn[i]!);
    return [
      {
        lon: s.cityLon,
        lat: s.cityLat,
        radiusKm: radius,
        label: formatDistance(radius),
      },
    ];
  });
  const evidenceMarks: TrailEvidenceMark[] = [
    ...caseData.sightings
      .filter((_, i) => progress.ringsPlaced[i])
      .map((s) => ({ lon: s.cityLon, lat: s.cityLat, kind: "witness" as const })),
    ...(progress.guess ? [{ lon: progress.guess.lon, lat: progress.guess.lat, kind: "x" as const }] : []),
  ];

  const withProgress = (mutate: (p: typeof progress) => void): void => {
    const next = {
      ...progress,
      ringsPlaced: [...progress.ringsPlaced] as typeof progress.ringsPlaced,
      informantOn: [...progress.informantOn] as typeof progress.informantOn,
    };
    mutate(next);
    commit({ ...store, current: next });
  };

  const onPlaceRing = (i: number) => {
    if (revealed || progress.ringsPlaced[i]) return;
    withProgress((p) => {
      p.ringsPlaced[i] = true;
    });
    setHint(null);
  };

  const onInformant = (i: number) => {
    if (revealed || !progress.ringsPlaced[i] || progress.informantOn[i]) return;
    if (store.stars < INFORMANT_COST) {
      setHint("Not enough stars — close a case to earn one.");
      return;
    }
    const next = {
      ...progress,
      ringsPlaced: [...progress.ringsPlaced] as typeof progress.ringsPlaced,
      informantOn: [...progress.informantOn] as typeof progress.informantOn,
    };
    next.informantOn[i] = true;
    commit({ ...store, stars: store.stars - INFORMANT_COST, current: next });
    setHint("🎙️ The informant tightened that ring to half its radius.");
  };

  // Map tap: the interception guess (only once all 3 rings are placed).
  const onMapTap = (lon: number, lat: number) => {
    if (revealed) return;
    if (!allRingsPlaced) {
      setHint("Place all 3 rings first — one per sighting card.");
      return;
    }
    setHint(null);
    setPending({ lon, lat });
  };

  const onConfirmIntercept = () => {
    if (!pending || revealed) return;
    playConfirmGuess();
    const scoreKm = scoreIntercept(pending.lon, pending.lat, caseData.hideout.lon, caseData.hideout.lat);
    const verdict = verdictFor(scoreKm);
    if (verdict.caught) playWin();
    else playLose();
    const next = {
      ...progress,
      guess: pending,
      revealed: true,
      scoreKm,
    };
    commit({
      ...store,
      stars: store.stars + SOLVE_REWARD,
      solved: store.solved + 1,
      current: next,
    });
    setPending(null);
  };

  const onNextCase = () => {
    setPending(null);
    setHint(null);
    commit({ ...store, caseIndex: store.caseIndex + 1, current: freshProgress() });
  };

  const verdict = progress.scoreKm !== null ? verdictFor(progress.scoreKm) : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8" data-testid="coldtrail-screen">
      <header>
        <div className="flex items-start justify-between gap-3">
          <Button type="button" variant="ghost" onClick={onLeave} className="min-h-[44px] px-2">
            ← All games
          </Button>
          <p data-testid="coldtrail-stars" className="text-sm text-muted" aria-label={`${store.stars} stars`}>
            ⭐ {store.stars}
          </p>
        </div>
        <p className="mt-4 text-[11px] tracking-wider text-muted uppercase">❄️ Cold Trail · Case file</p>
        <h1 className="font-display mt-1 text-3xl text-fg">
          Case #{String(caseData.caseNo).padStart(3, "0")}
        </h1>
        <p className="mt-2 text-muted">
          A smuggler is moving between cities. Three sightings, three rings — triangulate
          the hideout and tap your interception.
        </p>
      </header>

      <section aria-label="Sightings" className="mt-6 flex flex-col gap-3">
        {caseData.sightings.map((s, i) => (
          <SightingCard
            key={s.id}
            sighting={s}
            index={i}
            ringPlaced={progress.ringsPlaced[i]!}
            informantOn={progress.informantOn[i]!}
            stars={store.stars}
            revealed={revealed}
            onPlaceRing={() => onPlaceRing(i)}
            onInformant={() => onInformant(i)}
          />
        ))}
      </section>

      <section aria-label="Trail map" className="mt-6 flex flex-col gap-3">
        <p className="text-sm text-muted" role="status">
          {revealed
            ? "Case closed — the gold star marks the hideout."
            : `Rings placed: ${ringsPlacedCount} of 3`}
        </p>
        <LoopMap
          guesses={[]}
          target={{ lon: caseData.hideout.lon, lat: caseData.hideout.lat }}
          finished={revealed}
          freeTap
          onMapTap={onMapTap}
          evidenceRings={evidenceRings}
          evidenceMarks={evidenceMarks}
          mapLabel="Cold Trail map. Place all three sighting rings, then tap where they cross to set your interception."
          onSelectPlace={() => {}}
          onEmptyTap={() => {}}
        />
        {!revealed ? (
          <p className="text-xs text-muted" aria-hidden="true">
            <span className="text-[#f2c14e]">gold ring</span>&thinsp;=&thinsp;witness sighting radius
            &ensp;·&ensp;tap where the rings cross to intercept
          </p>
        ) : null}
        {hint ? (
          <p role="status" data-testid="map-hint" className="text-sm text-fg">
            {hint}
          </p>
        ) : null}
      </section>

      {pending && !revealed ? (
        <InterceptConfirm onConfirm={onConfirmIntercept} onCancel={() => setPending(null)} />
      ) : null}

      {revealed && verdict && progress.scoreKm !== null ? (
        <section
          aria-label="Case result"
          data-testid="coldtrail-reveal"
          className="mt-6 rounded-xl border border-line bg-surface p-5"
        >
          <p className="text-[11px] tracking-wider text-muted uppercase">Case closed</p>
          <h2 className="mt-1 text-2xl font-semibold text-fg">{verdict.title}</h2>
          <p className="mt-2 text-fg">
            The hideout was <strong>{caseData.hideout.name}</strong>.
          </p>
          <p className="mt-1 text-muted">
            Your intercept missed by{" "}
            <strong className="text-fg">
              {progress.scoreKm.toLocaleString("en-US")} km
            </strong>
            . {verdict.line}
          </p>
          <p className="mt-2 text-sm text-muted">+{SOLVE_REWARD}⭐ for closing the case</p>
          <Button
            type="button"
            data-testid="next-case-btn"
            onClick={onNextCase}
            className="mt-4 min-h-[48px] w-full text-base"
          >
            🔎 Next case
          </Button>
        </section>
      ) : null}
    </main>
  );
}
