import { BRAND } from "@/game/brand";
import { distanceKm, formatDistance } from "@/game/geo";
import { radiusKm } from "@/game/radius";
import { COUNTRIES, STATES, greaterSideKm, type Region, type RegionBounds } from "@/game/regions";
import { rewriteStory } from "@/game/rewrite";
import { continueRun, dropPin, endRun, resumeRun, type Edition, type Run, type RunPhase, type RunSummary, type PlaceResult } from "@/game/run";
import { distanceScore, scoreRingForEdition } from "@/game/score";
import { STARTERS, type Starter } from "@/game/starters";
import { createDealer, seenStoreFor, mintSeed } from "@/game/trail";
import { SatelliteMap, type MapMark, type MapVariation } from "@/map/satellite-map";
import { Compass } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { QuestionBubble, type BubbleViewState } from "./question-bubble";
import { ResultCard } from "./result-card";
import { RunSummaryCard } from "./run-summary";

const RUN_KEY = "meridian.run";

export type Drop = { lon: number; lat: number; distanceKm: number; placeId: string };

type ModelAvailability = "available" | "downloadable" | "downloading" | "unavailable";

type NanoSession = {
  prompt: (input: string) => Promise<string>;
  destroy?: () => void;
};

type LanguageModelGlobal = {
  availability: () => Promise<string>;
  create: () => Promise<NanoSession>;
};

function trailDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function placesFor(edition: Edition, regionId: string): Starter[] {
  return STARTERS.filter((place) => place.edition === edition && place.regionId === regionId);
}

function boundsFor(run: Run): RegionBounds {
  const regions = run.edition === "state" ? STATES : COUNTRIES;
  return regions.find((region) => region.id === run.regionId)?.bounds ?? [0, 0, 0, 0];
}

function isEdition(value: unknown): value is Edition {
  return value === "state" || value === "country" || value === "globe";
}

function isPhase(value: unknown): value is RunPhase {
  return value === "aim" || value === "story" || value === "done" || value === "summary";
}

function isPlaceResult(value: unknown): value is PlaceResult {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.distanceKm === "number" &&
    typeof r.hit === "boolean" &&
    typeof r.score === "number"
  );
}

function readRun(): Run | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (
      !isEdition(record.edition) ||
      typeof record.regionId !== "string" ||
      typeof record.regionName !== "string" ||
      typeof record.dateKey !== "string" ||
      typeof record.index !== "number" ||
      typeof record.hits !== "number" ||
      !isPhase(record.phase)
    ) {
      return null;
    }
    return {
      edition: record.edition,
      regionId: record.regionId,
      regionName: record.regionName,
      dateKey: record.dateKey,
      index: record.index,
      hits: record.hits,
      phase: record.phase,
      results: Array.isArray(record.results)
        ? record.results.filter(isPlaceResult)
        : [],
      // Runs saved before per-session shuffle get a fresh seed; resumeRun
      // keeps a valid one.
      seed: typeof record.seed === "number" ? record.seed : mintSeed(),
    };
  } catch {
    return null;
  }
}

function writeRun(run: Run) {
  try {
    sessionStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    // The run still lives in memory when storage is blocked.
  }
}

function isLanguageModel(value: unknown): value is LanguageModelGlobal {
  if (!value || typeof value !== "object") return false;
  const model = value as { availability?: unknown; create?: unknown };
  return typeof model.availability === "function" && typeof model.create === "function";
}

function readLanguageModel(): LanguageModelGlobal | null {
  const host = globalThis as { LanguageModel?: unknown };
  return isLanguageModel(host.LanguageModel) ? host.LanguageModel : null;
}

function asAvailability(status: string): ModelAvailability {
  if (
    status === "available" ||
    status === "downloadable" ||
    status === "downloading" ||
    status === "unavailable"
  ) {
    return status;
  }
  return "unavailable";
}

async function modelAvailability(): Promise<ModelAvailability> {
  const model = readLanguageModel();
  if (!model) return "unavailable";
  try {
    return asAvailability(await model.availability());
  } catch {
    return "unavailable";
  }
}

function storyKey(placeId: string): string {
  return `meridian.story.${placeId}`;
}

function readCachedStory(placeId: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const cached = localStorage.getItem(storyKey(placeId));
    if (cached === null || cached.trim() === "") return null;
    return cached;
  } catch {
    return null;
  }
}

function writeCachedStory(placeId: string, text: string) {
  try {
    localStorage.setItem(storyKey(placeId), text);
  } catch {
    // A private window can refuse the cache. The story still shows once.
  }
}

async function askRewrite(authored: string): Promise<string> {
  const model = readLanguageModel();
  if (!model) throw new Error("LanguageModel is missing");
  const status = asAvailability(await model.availability());
  if (status !== "available") throw new Error("LanguageModel is not available");
  const session = await model.create();
  try {
    const reply = await session.prompt(
      `Rewrite the story in two sentences. Do not add facts.\n\n${authored}`,
    );
    if (typeof reply !== "string") throw new Error("unexpected rewrite");
    return reply;
  } finally {
    session.destroy?.();
  }
}

async function revealStory(placeId: string, authored: string): Promise<string> {
  const result = await rewriteStory({
    placeId,
    authored,
    cached: readCachedStory(placeId),
    availability: await modelAvailability(),
    ask: askRewrite,
  });
  if (result.store !== null) writeCachedStory(placeId, result.store);
  return result.text;
}

export function GameApp() {
  const [ready, setReady] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [menu, setMenu] = useState<Edition | null>(null);

  const commit = useCallback((next: Run) => {
    writeRun(next);
    setRun(next);
  }, []);

  useEffect(() => {
    const saved = readRun();
    if (saved) {
      const restored = resumeRun(saved, {
        edition: saved.edition,
        regionId: saved.regionId,
        regionName: saved.regionName,
        dateKey: trailDate(),
      });
      if (restored === saved) setRun(saved);
    }
    setReady(true);
  }, []);

  const openRun = useCallback(
    (edition: Edition, regionId: string, regionName: string) => {
      const next = resumeRun(readRun(), {
        edition,
        regionId,
        regionName,
        dateKey: trailDate(),
      });
      commit(next);
      setMenu(null);
    },
    [commit],
  );

  if (!ready) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-end px-5 py-10">
        <p className="text-sm tracking-wide text-muted uppercase">Daily geography</p>
        <h1 className="mt-2 font-display text-5xl text-fg">{BRAND.name}</h1>
      </main>
    );
  }

  if (run) {
    return (
      <Play
        run={run}
        onRun={commit}
        onLeave={() => {
          setRun(null);
          setMenu(null);
        }}
      />
    );
  }

  if (menu === "state" || menu === "country") {
    const regions = menu === "state" ? STATES : COUNTRIES;
    return (
      <RegionList
        title={menu === "state" ? "State" : "Country"}
        regions={regions}
        onBack={() => setMenu(null)}
        onChoose={(region) => openRun(menu, region.id, region.name)}
      />
    );
  }

  return (
    <Choose
      onState={() => setMenu("state")}
      onCountry={() => setMenu("country")}
      onGlobe={() => openRun("globe", "globe", "Globe")}
    />
  );
}

function Choose({
  onState,
  onCountry,
  onGlobe,
}: {
  onState: () => void;
  onCountry: () => void;
  onGlobe: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8">
      <header>
        <p className="flex items-center gap-2 text-sm text-muted">
          <Compass className="size-5" aria-hidden="true" />
          {trailDate()} UTC
        </p>
        <h1 className="mt-3 font-display text-5xl text-fg">{BRAND.name}</h1>
        <p className="mt-4 max-w-md text-lg text-muted">
          Pick a state, a country, or the globe. A place name, then one pin. The run lasts until the
          pin misses.
        </p>
      </header>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <EditionCard
          title="State"
          detail="All 50 states. The same trail for that state on this UTC date."
          action="Choose a state"
          onClick={onState}
        />
        <EditionCard
          title="Country"
          detail="A short launch list, in the same order for everyone."
          action="Choose a country"
          onClick={onCountry}
        />
        <EditionCard
          title="Globe"
          detail="The whole earth. Nothing else to pick."
          action="Play the globe"
          onClick={onGlobe}
        />
      </div>
    </main>
  );
}

function EditionCard({
  title,
  detail,
  action,
  onClick,
}: {
  title: string;
  detail: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <article className="flex flex-col rounded-xl border border-line bg-surface p-5">
      <h2 className="font-display text-3xl text-fg">{title}</h2>
      <p className="mt-2 flex-1 text-sm text-muted">{detail}</p>
      <Button className="mt-4" onClick={onClick}>
        {action}
      </Button>
    </article>
  );
}

function RegionList({
  title,
  regions,
  onBack,
  onChoose,
}: {
  title: string;
  regions: Region[];
  onBack: () => void;
  onChoose: (region: Region) => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-8">
      <Button variant="ghost" className="self-start" onClick={onBack}>
        Editions
      </Button>
      <h1 className="mt-4 font-display text-4xl text-fg">{title}</h1>
      <ul className="mt-6 flex flex-col gap-2">
        {regions.map((region) => (
          <li key={region.id}>
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => onChoose(region)}
            >
              {region.name}
            </Button>
          </li>
        ))}
      </ul>
    </main>
  );
}

function Play({
  run,
  onRun,
  onLeave,
}: {
  run: Run;
  onRun: (run: Run) => void;
  onLeave: () => void;
}) {
  const places = useMemo(() => placesFor(run.edition, run.regionId), [run.edition, run.regionId]);
  // Endless dealer: per-session shuffle (fresh seed per run, so restarts never
  // repeat the same first question), per-cycle reseed, and a persistent
  // no-repeat history in localStorage. The dealer is created once per run
  // identity (seed); run.index advances within it. A reload restores the same
  // seed, so the resumed run keeps dealing the same session's order.
  const dealer = useMemo(
    () =>
      createDealer(
        places,
        run.seed,
        seenStoreFor(run.dateKey, run.edition, run.regionId),
        run.index,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [places, run.seed, run.dateKey, run.edition, run.regionId],
  );
  const place = dealer.at(run.index);
  // Record dealt places into the no-repeat history as the run advances.
  useEffect(() => {
    dealer.markDealtThrough(run.index);
  }, [dealer, run.index]);
  const [aim, setAim] = useState<{ lon: number; lat: number } | null>(null);
  // A11y (WCAG 4.1.3): the sr-only live region announces aim transitions so
  // screen-reader users get feedback for place/move/clear. Cleared whenever
  // the phase changes, at which point phase messaging takes over.
  const [aimAnnouncement, setAimAnnouncement] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [story, setStory] = useState<string | null>(null);
  const [bubble, setBubble] = useState<BubbleViewState>("open");
  const [cardDismissed, setCardDismissed] = useState(false);
  // Z3/Z4 zoom-space: replay remounts the map (fresh intro + fresh
  // controller). Replaying the same region must not reuse the old map
  // instance — its controller is terminal (revealDone) and its highlight
  // belongs to the previous run.
  const [mapKey, setMapKey] = useState(0);
  const [summary, setSummary] = useState<RunSummary | null>(null);

  useEffect(() => {
    setAim(null);
    setBubble("open");
    setCardDismissed(false);
  }, [place?.id]);

  // M5: Escape dismisses the result card when committed, and toggles the
  // question bubble when aiming with no pin (AIM_EMPTY). Pin clearing (AIM_PIN)
  // is handled by satellite-map via onClearAim; the AIM_PIN guard below keeps
  // this listener from double-handling it.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (run.phase !== "aim") {
        setCardDismissed(true);
        return;
      }
      if (aim !== null) return;
      setBubble((view) =>
        view === "dismissed" ? view : view === "collapsed" ? "open" : "collapsed",
      );
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [run.phase, aim]);

  useEffect(() => {
    if (place || run.phase === "done" || run.phase === "summary") return;
    onRun({ ...run, phase: "done" });
  }, [onRun, place, run]);

  useEffect(() => {
    if (run.phase !== "story" || !place) {
      setStory(null);
      return;
    }
    let cancel = false;
    const placeId = place.id;
    const authored = place.story;
    setStory(authored);
    void revealStory(placeId, authored).then((text) => {
      if (!cancel) setStory(text);
    });
    return () => {
      cancel = true;
    };
  }, [place, run.phase]);

  const marks = useMemo<readonly MapMark[] | undefined>(() => {
    if (run.phase === "aim") {
      return aim ? [{ lon: aim.lon, lat: aim.lat, tone: "aim" }] : undefined;
    }
    if (!drop || !place || drop.placeId !== place.id) return undefined;
    return [
      { lon: drop.lon, lat: drop.lat, tone: "pin" },
      { lon: place.lon, lat: place.lat, tone: "spot" },
    ];
  }, [aim, drop, place, run.phase]);

  const variation = useMemo<MapVariation | null>(() => {
    if (run.phase === "aim" || !drop || !place || drop.placeId !== place.id) return null;
    return {
      pin: { lon: drop.lon, lat: drop.lat },
      spot: { lon: place.lon, lat: place.lat },
      kilometers: drop.distanceKm,
      radiusKm:
        run.edition === "globe"
          ? radiusKm("globe", 0)
          : radiusKm(run.edition, greaterSideKm(boundsFor(run))),
    };
  }, [drop, place, run]);

  function onAim(lon: number, lat: number) {
    if (run.phase !== "aim" || !place) return;
    setAimAnnouncement(
      aim
        ? "Pin moved. Double-tap the map or press Drop pin to lock in your guess."
        : "Pin placed. Double-tap the map or press Drop pin to lock in your guess.",
    );
    setAim({ lon, lat });
  }

  // M5: Escape with a pin clears it.
  function onClearAim() {
    if (run.phase !== "aim") return;
    setAimAnnouncement("Pin cleared.");
    setAim(null);
  }

  function onConfirm(lon: number, lat: number) {
    if (run.phase !== "aim" || !place) return;
    const distance = distanceKm([lon, lat], [place.lon, place.lat]);
    const radius =
      run.edition === "globe"
        ? radiusKm("globe", 0)
        : radiusKm(run.edition, greaterSideKm(boundsFor(run)));
    const score = distanceScore(distance, scoreRingForEdition(run.edition));
    setAim(null);
    setAimAnnouncement(null);
    setDrop({ lon, lat, distanceKm: distance, placeId: place.id });
    onRun(dropPin(run, distance, radius, score));
  }

  function onContinue() {
    setDrop(null);
    setAimAnnouncement(null);
    onRun(continueRun(run));
  }

  function onEndGame() {
    const { run: ended, summary: final } = endRun(run);
    setSummary(final);
    onRun(ended);
  }

  function onSummaryDone() {
    setSummary(null);
    onLeave();
  }

  function onSummaryPlayAgain() {
    setSummary(null);
    onReplay();
  }

  // Play-again replay: the same resumeRun chain as openRun. A finished run
  // (phase "summary") always restarts via startRun with a fresh dealing seed,
  // so the replayed run opens on a different first question. Local state is
  // reset explicitly because the [place?.id] effect below only fires when the
  // dealt place actually changes.
  function onReplay() {
    setAim(null);
    setAimAnnouncement(null);
    setDrop(null);
    setBubble("open");
    setCardDismissed(false);
    // Fresh map instance for the replayed run (see mapKey above).
    setMapKey((k) => k + 1);
    onRun(
      resumeRun(run, {
        edition: run.edition,
        regionId: run.regionId,
        regionName: run.regionName,
        dateKey: trailDate(),
      }),
    );
  }

  const mode = run.edition === "globe" ? "globe" : "flat";
  const bounds = run.edition === "globe" ? undefined : boundsFor(run);

  return (
    <main className="relative h-dvh bg-bg">
      <div className="absolute inset-0">
        <SatelliteMap
          key={mapKey}
          mode={mode}
          edition={run.edition}
          regionName={run.regionName}
          bounds={bounds}
          onAim={onAim}
          onConfirm={onConfirm}
          onClearAim={onClearAim}
          marks={marks}
          variation={variation}
        />
        <div className="pointer-events-none absolute top-3 right-3 left-3 z-30 flex items-start justify-between gap-3">
          <Button variant="secondary" className="pointer-events-auto" onClick={onLeave}>
            Editions
          </Button>
          <div className="flex flex-col items-end gap-2">
            <p className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg">
              {run.hits} placed
            </p>
            {run.phase !== "summary" ? (
              <button
                type="button"
                onClick={onEndGame}
                className="pointer-events-auto rounded-md border border-white/10 bg-[rgba(10,12,16,0.72)] px-3 py-1.5 text-xs text-white/70 backdrop-blur-[14px] transition-colors hover:text-white"
              >
                End game
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {run.phase === "aim"
          ? (aimAnnouncement ?? (place ? `Find ${place.name}.` : null))
          : run.phase === "story" && place
            ? `Pin dropped. ${drop ? formatDistance(drop.distanceKm) : "Hit"}. ${place.name}.`
            : run.phase === "summary" && summary
              ? `Game over. ${summary.placesPlayed} places, ${summary.hits} hits, total score ${summary.totalScore}.`
              : place
                ? `Pin dropped. ${drop ? formatDistance(drop.distanceKm) : ""}. ${place.name} missed.`
                : `${run.regionName} finished.`}
      </p>
      {run.phase === "aim" && place ? (
        <QuestionBubble
          regionName={run.regionName}
          placeName={place.name}
          hasPin={aim !== null}
          view={bubble}
          onViewChange={setBubble}
        />
      ) : null}
      {run.phase !== "aim" && run.phase !== "summary" ? (
        <ResultCard
          run={run}
          place={place}
          drop={drop}
          story={story}
          empty={places.length === 0}
          dismissed={cardDismissed}
          onDismissedChange={setCardDismissed}
          onContinue={onContinue}
        />
      ) : null}
      {run.phase === "summary" && summary ? (
        <RunSummaryCard
          summary={summary}
          regionName={run.regionName}
          onDone={onSummaryDone}
          onPlayAgain={onSummaryPlayAgain}
        />
      ) : null}
    </main>
  );
}
