import { BRAND } from "@/game/brand";
import { distanceKm, formatDistance } from "@/game/geo";
import { radiusKm } from "@/game/radius";
import { COUNTRIES, STATES, greaterSideKm, type Region, type RegionBounds } from "@/game/regions";
import { rewriteStory } from "@/game/rewrite";
import { continueRun, dropPin, resumeRun, type Edition, type Run, type RunPhase } from "@/game/run";
import { shareText } from "@/game/share";
import { orderPlaces, placeAt } from "@/game/trail";
import { IMAGERY_NOTICE } from "@/map/imagery";
import { SatelliteMap, type MapMark } from "@/map/satellite-map";
import { Compass } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

const RUN_KEY = "meridian.run";

type TrailPlace = {
  id: string;
  edition: Edition;
  regionId: string;
  name: string;
  lon: number;
  lat: number;
  story: string;
  sourceLabel: string;
  sourceHref: string;
};

type Drop = { lon: number; lat: number; distanceKm: number; placeId: string };

type ModelAvailability = "available" | "downloadable" | "downloading" | "unavailable";

type NanoSession = {
  prompt: (input: string) => Promise<string>;
  destroy?: () => void;
};

type LanguageModelGlobal = {
  availability: () => Promise<string>;
  create: () => Promise<NanoSession>;
};

// Task 8 replaces this with STARTERS
const FIXTURE: TrailPlace[] = [
  {
    id: "chimney-rock",
    edition: "state",
    regionId: "nebraska",
    name: "Chimney Rock",
    lon: -103.348,
    lat: 41.704,
    story:
      "A clay spire stands over the North Platte. Wagon trains used it to count the days still ahead.",
    sourceLabel: "National Park Service",
    sourceHref: "https://www.nps.gov/places/chimney-rock.htm",
  },
  {
    id: "scotts-bluff",
    edition: "state",
    regionId: "nebraska",
    name: "Scotts Bluff",
    lon: -103.707,
    lat: 41.831,
    story:
      "The bluff rises beside the river road. Travelers took the pass at its foot rather than the open prairie.",
    sourceLabel: "National Park Service",
    sourceHref: "https://www.nps.gov/scbl/",
  },
  {
    id: "giza",
    edition: "globe",
    regionId: "globe",
    name: "Giza Plateau",
    lon: 31.134,
    lat: 29.979,
    story:
      "Three stone pyramids sit on the desert edge of Cairo. They were already old when the city around them was young.",
    sourceLabel: "UNESCO",
    sourceHref: "https://whc.unesco.org/en/list/86/",
  },
  {
    id: "uluru",
    edition: "globe",
    regionId: "globe",
    name: "Uluru",
    lon: 131.037,
    lat: -25.345,
    story:
      "A sandstone monolith stands in the middle of Australia. The rock is older than the dunes around its base.",
    sourceLabel: "UNESCO",
    sourceHref: "https://whc.unesco.org/en/list/447/",
  },
];

function trailDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function placesFor(edition: Edition, regionId: string): TrailPlace[] {
  return FIXTURE.filter((place) => place.edition === edition && place.regionId === regionId);
}

function boundsFor(run: Run): RegionBounds {
  const regions = run.edition === "state" ? STATES : COUNTRIES;
  return regions.find((region) => region.id === run.regionId)?.bounds ?? [0, 0, 0, 0];
}

function isEdition(value: unknown): value is Edition {
  return value === "state" || value === "country" || value === "globe";
}

function isPhase(value: unknown): value is RunPhase {
  return value === "aim" || value === "story" || value === "done";
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

function formatSpot(lon: number, lat: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${ew}`;
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
  const ordered = useMemo(
    () => orderPlaces(places, run.dateKey, run.edition, run.regionId),
    [places, run.dateKey, run.edition, run.regionId],
  );
  const place = placeAt(ordered, run.index);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [story, setStory] = useState<string | null>(null);

  useEffect(() => {
    if (place || run.phase === "done") return;
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
    if (!drop || !place || drop.placeId !== place.id || run.phase === "aim") return undefined;
    return [
      { lon: drop.lon, lat: drop.lat, tone: "pin" },
      { lon: place.lon, lat: place.lat, tone: "spot" },
    ];
  }, [drop, place, run.phase]);

  function onPick(lon: number, lat: number) {
    if (run.phase !== "aim" || !place) return;
    const distance = distanceKm([lon, lat], [place.lon, place.lat]);
    const radius =
      run.edition === "globe"
        ? radiusKm("globe", 0)
        : radiusKm(run.edition, greaterSideKm(boundsFor(run)));
    setDrop({ lon, lat, distanceKm: distance, placeId: place.id });
    onRun(dropPin(run, distance, radius));
  }

  function onContinue() {
    setDrop(null);
    onRun(continueRun(run, ordered.length));
  }

  const mode = run.edition === "globe" ? "globe" : "flat";
  const bounds = run.edition === "globe" ? undefined : boundsFor(run);

  return (
    <main className="flex h-dvh flex-col bg-bg">
      <div className="relative min-h-0 flex-1">
        <SatelliteMap mode={mode} bounds={bounds} onPick={onPick} marks={marks} />
        <div className="pointer-events-none absolute top-3 right-3 left-3 flex items-start justify-between gap-3">
          <Button variant="secondary" className="pointer-events-auto" onClick={onLeave}>
            Editions
          </Button>
          <p className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg">
            {run.hits} placed
          </p>
        </div>
      </div>
      <p className="border-t border-line bg-surface px-4 py-2 text-xs text-muted">
        {IMAGERY_NOTICE}
      </p>
      <section className="max-h-[46dvh] overflow-y-auto bg-surface px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="text-xs tracking-wide text-subtle uppercase">{run.regionName}</p>
        {place ? (
          <Round run={run} place={place} drop={drop} story={story} onContinue={onContinue} />
        ) : (
          <Finished run={run} empty={ordered.length === 0} />
        )}
      </section>
    </main>
  );
}

function Round({
  run,
  place,
  drop,
  story,
  onContinue,
}: {
  run: Run;
  place: TrailPlace;
  drop: Drop | null;
  story: string | null;
  onContinue: () => void;
}) {
  const revealed = run.phase !== "aim" && drop?.placeId === place.id;
  return (
    <>
      <h1 className="mt-1 font-display text-3xl text-fg">{place.name}</h1>
      <p className="sr-only" aria-live="polite">
        {run.phase === "aim"
          ? `Find ${place.name}.`
          : run.phase === "story"
            ? `${place.name}. ${drop ? formatDistance(drop.distanceKm) : "Hit"}.`
            : `${place.name} missed. The run is over.`}
      </p>
      {run.phase === "aim" ? (
        <p className="mt-3 text-sm text-muted">
          Tap the map to drop a pin. The map has no place names.
        </p>
      ) : null}
      {run.phase === "story" ? (
        <div className="mt-3 flex flex-col gap-3">
          <p className="font-display text-4xl tabular-nums text-fg">
            {drop ? formatDistance(drop.distanceKm) : "Hit"}
          </p>
          <p className="max-w-prose text-sm text-fg">{story ?? place.story}</p>
          <a
            className="text-sm text-muted underline"
            href={place.sourceHref}
            target="_blank"
            rel="noreferrer"
          >
            {place.sourceLabel}
          </a>
          <Button onClick={onContinue}>Next place</Button>
        </div>
      ) : null}
      {run.phase === "done" ? (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-muted">That pin is outside the radius. The run ends.</p>
          {revealed ? (
            <p className="text-sm text-fg">
              Your pin was {formatSpot(drop.lon, drop.lat)}, {formatDistance(drop.distanceKm)} away.
              The spot is {formatSpot(place.lon, place.lat)}.
            </p>
          ) : (
            <p className="text-sm text-fg">The spot is {formatSpot(place.lon, place.lat)}.</p>
          )}
          <ShareResult run={run} />
        </div>
      ) : null}
    </>
  );
}

function Finished({ run, empty }: { run: Run; empty: boolean }) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      <h1 className="font-display text-3xl text-fg">{run.regionName}</h1>
      <p className="text-sm text-muted">
        {empty
          ? "This trail has no places yet."
          : "You placed every place on the trail. It does not repeat."}
      </p>
      <ShareResult run={run} />
    </div>
  );
}

function ShareResult({ run }: { run: Run }) {
  const [copied, setCopied] = useState(false);
  const line = shareText({ regionName: run.regionName, dateKey: run.dateKey, hits: run.hits });
  return (
    <div className="flex flex-col gap-3">
      <pre className="whitespace-pre-wrap rounded-lg border border-line bg-bg px-4 py-3 font-sans text-sm leading-relaxed text-fg">
        {line}
      </pre>
      <Button
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
