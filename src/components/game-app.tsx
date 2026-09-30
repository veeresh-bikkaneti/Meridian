import { BRAND } from "@/game/brand";
import { distanceKm, formatDistance } from "@/game/geo";
import { isHit, radiusKm } from "@/game/radius";
import { ADMIN1_BY_COUNTRY, COUNTRIES, greaterSideKm, type Region, type RegionBounds } from "@/game/regions";
import { rewriteStory } from "@/game/rewrite";
import { continueRun, dropPin, endRun, isResumable, resumeRun, type Edition, type Run, type RunPhase, type RunSummary, type PlaceResult } from "@/game/run";
import { scoreRingForEdition } from "@/game/score";
import { scorePlace, type ScoredPlace } from "@/game/scoring";
import { STARTERS } from "@/game/starters";
import { buildRegionPool } from "@/game/pool";
import { createDealer, seenStoreFor, mintSeed } from "@/game/trail";
import { SatelliteMap, type MapMark, type MapVariation } from "@/map/satellite-map";
import { Compass } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { QuestionBubble, type BubbleViewState } from "./question-bubble";
import { ResultCard } from "./result-card";
import { RunSummaryCard } from "./run-summary";

const RUN_KEY = "meridian.run";

export type Drop = {
  lon: number;
  lat: number;
  distanceKm: number;
  placeId: string;
  /** The v3 breakdown for the reveal; null on a miss. */
  breakdown: ScoredPlace | null;
  /** Consecutive hits before this place (for the miss "streak reset" note). */
  streakBefore: number;
};

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

function boundsFor(run: Run): RegionBounds {
  if (run.edition === "state") {
    // States can drill from any country that maps subdivisions; look across all of them.
    const regions = Object.values(ADMIN1_BY_COUNTRY).flat();
    return regions.find((region) => region.id === run.regionId)?.bounds ?? [0, 0, 0, 0];
  }
  return COUNTRIES.find((region) => region.id === run.regionId)?.bounds ?? [0, 0, 0, 0];
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
    // Range-check the restored numbers: a tampered sessionStorage index
    // (e.g. 1e15) would otherwise send the dealer spinning through billions
    // of cycles; a non-finite seed is meaningless. The cap is 20k (not 1M):
    // the dealer's resume re-derive is O(N^2/pool), measured ~52ms at 20k
    // but ~130s at 1M. Fail closed to null.
    if (
      !Number.isInteger(record.index) ||
      record.index < 0 ||
      record.index > 20_000 ||
      !Number.isInteger(record.hits) ||
      record.hits < 0 ||
      record.hits > 20_000
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
      // Runs saved before the streak engine backfill to 0; the version
      // gate in isResumable retires their unscored results anyway.
      streak:
        Number.isInteger(record.streak) && (record.streak as number) >= 0
          ? (record.streak as number)
          : 0,
      bestStreak:
        Number.isInteger(record.bestStreak) && (record.bestStreak as number) >= 0
          ? (record.bestStreak as number)
          : 0,
      results: Array.isArray(record.results)
        ? record.results.filter(isPlaceResult)
        : [],
      // Runs saved before per-session shuffle get a fresh seed; resumeRun
      // keeps a valid one.
      seed: typeof record.seed === "number" ? record.seed : mintSeed(),
      // Runs saved before pool persistence get [] here; resumeRun backfills
      // from the freshly computed pool.
      poolIds: Array.isArray(record.poolIds)
        ? record.poolIds.filter((id): id is string => typeof id === "string")
        : [],
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

/**
 * The session's dealing pool: catalog places minus today's seen history
 * (the cross-session no-repeat rule). Computed once when a session starts
 * and persisted on the run, so a reload rebuilds the identical pool.
 * Falls back to the full catalog when everything was seen today.
 */
function computePoolIds(
  allPlaces: { id: string }[],
  dateKey: string,
  edition: Edition,
  regionId: string,
): string[] {
  const seen = new Set(seenStoreFor(dateKey, edition, regionId).read());
  const fresh = allPlaces.filter((p) => !seen.has(p.id)).map((p) => p.id);
  return fresh.length > 0 ? fresh : allPlaces.map((p) => p.id);
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

/**
 * Where the player is in the edition picker. The picker drills down
 * Globe -> Country -> State: `countries` lists the playable countries, and
 * `admin1` lists one country's states/provinces (each level is playable).
 * The run's `Edition` type is unchanged — only the menu needs the extra
 * level.
 */
type Menu =
  | { kind: "countries" }
  | { kind: "states" }
  | { kind: "admin1"; countryId: string; countryName: string; from: "countries" | "states" };

/** Lenient pool-size check for the picker lists (the strict fail-closed gate runs at deal time). */
function poolSize(edition: Edition, regionId: string): number {
  let count = 0;
  for (const place of STARTERS) {
    if (place.edition === edition && place.regionId === regionId) count++;
  }
  return count;
}

export function GameApp() {
  const [ready, setReady] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);

  const commit = useCallback((next: Run) => {
    writeRun(next);
    setRun(next);
  }, []);

  useEffect(() => {
    const saved = readRun();
    if (saved) {
      const today = {
        edition: saved.edition,
        regionId: saved.regionId,
        regionName: saved.regionName,
        dateKey: trailDate(),
      };
      // resumeRun mints a fresh run when the saved one is not resumable — a
      // page load must not auto-start a run, so only resumable sessions are
      // restored. (The old `restored === saved` check could never pass:
      // resumeRun always returns a new object, so reloads silently dropped
      // to the menu instead of resuming.)
      if (isResumable(saved, today)) commit(resumeRun(saved, today));
    }
    setReady(true);
  }, [commit]);

  const openRun = useCallback(
    (edition: Edition, regionId: string, regionName: string) => {
      const dateKey = trailDate();
      const next = resumeRun(
        readRun(),
        { edition, regionId, regionName, dateKey },
        computePoolIds(buildRegionPool(STARTERS, edition, regionId), dateKey, edition, regionId),
      );
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

  if (menu?.kind === "countries") {
    // Only countries with a playable pool — never a dead end.
    const regions = COUNTRIES.filter((country) => poolSize("country", country.id) > 0);
    return (
      <RegionList
        title="Country"
        subtitle="Play a country whole — or drill into its states where available."
        regions={regions}
        onBack={() => setMenu(null)}
        onChoose={(region) => {
          const subdivisions = ADMIN1_BY_COUNTRY[region.id] ?? [];
          if (subdivisions.length > 0) {
            setMenu({ kind: "admin1", countryId: region.id, countryName: region.name, from: "countries" });
          } else {
            openRun("country", region.id, region.name);
          }
        }}
      />
    );
  }

  if (menu?.kind === "states") {
    // Only countries with a playable pool AND states/provinces — never a dead end.
    // The poolSize half matches the Country list's invariant (line above): a country
    // whose admin-1 map lands before its question pool must not be listed, or every
    // state click would hit the fail-closed deal-time gate. Today that is just the
    // United States; more countries appear here as admin-1 pools land, with no USA
    // hardcoding in the picker itself.
    const regions = COUNTRIES.filter(
      (country) =>
        poolSize("country", country.id) > 0 && (ADMIN1_BY_COUNTRY[country.id] ?? []).length > 0,
    );
    return (
      <RegionList
        title="State"
        subtitle="Choose a country, then one of its states."
        regions={regions}
        onBack={() => setMenu(null)}
        onChoose={(region) =>
          setMenu({ kind: "admin1", countryId: region.id, countryName: region.name, from: "states" })
        }
      />
    );
  }

  if (menu?.kind === "admin1") {
    const regions = ADMIN1_BY_COUNTRY[menu.countryId] ?? [];
    return (
      <RegionList
        title={menu.countryName}
        subtitle={`Play the whole ${menu.countryName}, or pick a state.`}
        regions={regions}
        headerAction={{
          label: `Play entire ${menu.countryName}`,
          onClick: () => openRun("country", menu.countryId, menu.countryName),
        }}
        onBack={() => setMenu({ kind: menu.from })}
        onChoose={(region) => openRun("state", region.id, region.name)}
      />
    );
  }

  return (
    <Choose
      onState={() => setMenu({ kind: "states" })}
      onCountry={() => setMenu({ kind: "countries" })}
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
          Pick the globe, a country, or a state. A place name, then one pin. The run goes until
          you choose to end it.
        </p>
      </header>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <EditionCard
          title="State"
          detail="Pick a country, then one of its states. Each state is its own run."
          action="Choose a state"
          onClick={onState}
        />
        <EditionCard
          title="Country"
          detail="Play a country whole, or drill into its states where available."
          action="Choose a country"
          onClick={onCountry}
        />
        <EditionCard
          title="Globe"
          detail="The whole earth. Continent outlines at a distance, countries as you close in."
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
  subtitle,
  regions,
  headerAction,
  onBack,
  onChoose,
}: {
  title: string;
  subtitle?: string;
  regions: Region[];
  headerAction?: { label: string; onClick: () => void };
  onBack: () => void;
  onChoose: (region: Region) => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-8">
      <Button variant="ghost" className="self-start" onClick={onBack}>
        Editions
      </Button>
      <h1 className="mt-4 font-display text-4xl text-fg">{title}</h1>
      {subtitle ? <p className="mt-2 text-muted">{subtitle}</p> : null}
      {headerAction ? (
        <Button variant="secondary" className="mt-6 w-full" onClick={headerAction.onClick}>
          {headerAction.label}
        </Button>
      ) : null}
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
  const places = useMemo(
    () => buildRegionPool(STARTERS, run.edition, run.regionId),
    [run.edition, run.regionId],
  );
  // Session pool: the catalog filtered to this run's persisted poolIds.
  // Computed once at session start and saved on the run, so a reload
  // rebuilds the identical pool (not a reshuffled smaller one).
  const pool = useMemo(() => {
    const ids = new Set(run.poolIds);
    const filtered = places.filter((p) => ids.has(p.id));
    // Legacy runs (or a tampered pool): fall back to the full catalog rather
    // than an empty pool.
    return filtered.length > 0 ? filtered : places;
  }, [places, run.poolIds]);
  // Endless dealer: per-session shuffle (fresh seed per run, so restarts no
  // longer deterministically repeat the same first question), per-cycle
  // reseed, and a persistent no-repeat history in localStorage. The dealer
  // is created once per run
  // identity (seed); run.index advances within it. A reload restores the same
  // seed and pool, so the resumed run keeps dealing the same session's order.
  const dealer = useMemo(
    () =>
      createDealer(
        pool,
        run.seed,
        seenStoreFor(run.dateKey, run.edition, run.regionId),
        run.index,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool, run.seed, run.dateKey, run.edition, run.regionId],
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
    const hit = isHit(distance, radius);
    // v3: the place is scored with the streak engine + difficulty multiplier;
    // a miss scores 0 and resets the streak (handled in dropPin).
    const scored = hit
      ? scorePlace({
          distanceKm: distance,
          ring: scoreRingForEdition(run.edition),
          difficulty: place.difficulty,
          streakBefore: run.streak,
          edition: run.edition,
          regionId: run.regionId,
          pin: [lon, lat],
          target: [place.lon, place.lat],
        })
      : null;
    setAim(null);
    setAimAnnouncement(null);
    setDrop({
      lon,
      lat,
      distanceKm: distance,
      placeId: place.id,
      breakdown: scored,
      streakBefore: run.streak,
    });
    onRun(dropPin(run, distance, radius, scored));
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
    const replayDateKey = trailDate();
    onRun(
      resumeRun(
        run,
        {
          edition: run.edition,
          regionId: run.regionId,
          regionName: run.regionName,
          dateKey: replayDateKey,
        },
        computePoolIds(places, replayDateKey, run.edition, run.regionId),
      ),
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
            <p
              data-testid="score-total"
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold tabular-nums text-fg"
            >
              SCORE {run.results.reduce((sum, r) => sum + r.score, 0).toLocaleString("en-US")}
            </p>
            {run.streak >= 2 ? (
              <p
                data-testid="streak-flame"
                className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm tabular-nums text-fg"
                aria-label={`${run.streak} place streak`}
              >
                🔥 {run.streak}
              </p>
            ) : null}
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
              ? `Game over. ${summary.placesPlayed} places, ${summary.hits} hits, total score ${summary.totalScore}, average ${summary.averagePerPlace} per place, best streak ${summary.bestStreak}.`
              : place
                ? `Pin dropped. ${drop ? formatDistance(drop.distanceKm) : ""}. ${place.name} missed.`
                : `${run.regionName} finished.`}
      </p>
      {run.phase === "aim" && place ? (
        <QuestionBubble
          regionName={run.regionName}
          placeName={place.name}
          difficulty={place.difficulty}
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
