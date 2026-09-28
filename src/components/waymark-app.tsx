import { Compass, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { AtlasMap } from "@/components/atlas-map";
import { Button } from "@/components/ui/button";
import { PLACES_BY_ID } from "@/game/catalog";
import { dateKeyFor, displayDate, homeDateKey, worldDateKey } from "@/game/daily";
import { formatDistance } from "@/game/geo";
import { RINGS } from "@/game/score";
import { activeRun, useSession, writeSession } from "@/game/session";
import { drawShareCard, shareText } from "@/game/share";
import type { Edition, Guess, Run, ThemeChoice } from "@/game/types";

function applyTheme(theme: ThemeChoice) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  return reduced;
}

export function WaymarkApp() {
  const booted = useSession((state) => state.booted);
  const screen = useSession((state) => state.screen);
  const theme = useSession((state) => state.theme);
  const reduced = useReducedMotion();
  if (booted) applyTheme(theme);

  useEffect(() => {
    const unsub = useSession.subscribe((state) => {
      if (state.booted) writeSession(state);
    });
    useSession.getState().boot();
    return unsub;
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme, booted]);

  if (screen === "welcome") return <Welcome />;
  if (!booted) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-end px-5 py-10">
        <p className="text-sm tracking-wide text-muted uppercase">Daily geography</p>
        <h1 className="mt-2 font-display text-5xl text-fg">Waymark</h1>
      </main>
    );
  }
  if (screen === "play") return <Play reduced={reduced} />;
  if (screen === "results") return <Results />;
  return <Today />;
}

function Mark() {
  return <Compass className="size-5" aria-hidden="true" />;
}

function Welcome() {
  const setName = useSession((state) => state.setName);
  const home = useSession((state) => state.home);
  const setHome = useSession((state) => state.setHome);
  const [draft, setDraft] = useState("");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-between px-5 py-8">
      <header>
        <p className="flex items-center gap-2 text-sm text-muted">
          <Mark />
          Daily geography
        </p>
        <h1 className="mt-4 font-display text-5xl leading-tight text-fg">Waymark</h1>
        <p className="mt-4 max-w-md text-lg text-muted">
          Five places, once a day. Lincoln first, then the state, the country, and the world.
        </p>
      </header>
      <form
        className="mt-10 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setName((draft.trim() || "Guest").slice(0, 24));
        }}
      >
        <label className="flex flex-col gap-2 text-sm text-muted" htmlFor="player-name">
          What should we call you?
          <input
            id="player-name"
            value={draft}
            maxLength={24}
            autoComplete="nickname"
            placeholder="A first name is enough"
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-12 rounded-md border border-line bg-surface px-3 text-base text-fg"
          />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm text-muted">Home edition</legend>
          <HomeOption
            checked={home === "lincoln"}
            onChange={() => setHome("lincoln")}
            title="Lincoln, Nebraska"
            detail="City, nearby lakes, the state, then the country."
          />
          <HomeOption
            checked={home === "visitor"}
            onChange={() => setHome("visitor")}
            title="Somewhere else"
            detail="Nebraska and the United States until your city is added."
          />
        </fieldset>
        <Button type="submit" size="lg">
          {draft.trim() ? `Play as ${draft.trim().slice(0, 24)}` : "Continue as guest"}
        </Button>
        <p className="text-sm text-subtle">
          Your name and guesses stay in this tab. A reload, or a closed browser, starts a new player. Nothing is sent to a server.
        </p>
      </form>
    </main>
  );
}

function HomeOption({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  detail: string;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-lg border border-line bg-surface p-4">
      <input type="radio" name="home" checked={checked} onChange={onChange} className="mt-1" />
      <span>
        <span className="block font-medium text-fg">{title}</span>
        <span className="mt-1 block text-sm text-muted">{detail}</span>
      </span>
    </label>
  );
}

function Today() {
  const name = useSession((state) => state.playerName);
  const home = useSession((state) => state.home);
  const setHome = useSession((state) => state.setHome);
  const mapStyle = useSession((state) => state.mapStyle);
  const setMapStyle = useSession((state) => state.setMapStyle);
  const theme = useSession((state) => state.theme);
  const setTheme = useSession((state) => state.setTheme);
  const games = useSession((state) => state.games);
  const startGame = useSession((state) => state.startGame);
  const showResults = useSession((state) => state.showResults);
  const forget = useSession((state) => state.forget);
  const [rules, setRules] = useState(false);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Mark />
            {displayDate(zone)}
          </p>
          <h1 className="mt-2 font-display text-4xl text-fg">Hello, {name}</h1>
        </div>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-md border border-line bg-surface text-fg"
          aria-label={theme === "paper" ? "Switch to night map" : "Switch to paper map"}
          onClick={() => setTheme(theme === "paper" ? "night" : "paper")}
        >
          {theme === "paper" ? <Moon className="size-4" aria-hidden="true" /> : <Sun className="size-4" aria-hidden="true" />}
        </button>
      </header>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <EditionCard
          edition="world"
          title="World"
          detail="Five places on a globe. The same set for every player on your local date."
          run={games.world}
          onPlay={() => startGame("world")}
          onResults={() => showResults("world")}
        />
        <EditionCard
          edition="home"
          title="Home Turf"
          detail={
            home === "lincoln"
              ? "Two places in Lincoln, one nearby, one in Nebraska, one in the United States."
              : "Nebraska and the United States. Lincoln is the first city edition."
          }
          run={games.home?.home === home ? games.home : undefined}
          onPlay={() => startGame("home")}
          onResults={() => showResults("home")}
        />
      </div>
      <section className="mt-6 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-medium text-fg">This session</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant={home === "lincoln" ? "primary" : "secondary"} onClick={() => setHome("lincoln")}>
            Lincoln
          </Button>
          <Button variant={home === "visitor" ? "primary" : "secondary"} onClick={() => setHome("visitor")}>
            Somewhere else
          </Button>
          <Button variant={mapStyle === "roads" ? "primary" : "secondary"} onClick={() => setMapStyle("roads")}>
            Roads
          </Button>
          <Button variant={mapStyle === "bare" ? "primary" : "secondary"} onClick={() => setMapStyle("bare")}>
            Bare map
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted">
          {zone === "America/Chicago"
            ? "Home Turf rolls over at midnight Central."
            : `Home Turf uses Central Time (${homeDateKey()}). World uses your date (${worldDateKey()}).`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setRules((open) => !open)}>
            {rules ? "Hide scoring" : "How scoring works"}
          </Button>
          <Button variant="ghost" onClick={forget}>
            Forget this session
          </Button>
        </div>
        {rules ? <Rules /> : null}
      </section>
    </main>
  );
}

function EditionCard({
  edition,
  title,
  detail,
  run,
  onPlay,
  onResults,
}: {
  edition: Edition;
  title: string;
  detail: string;
  run?: Run;
  onPlay: () => void;
  onResults: () => void;
}) {
  const today = dateKeyFor(edition);
  const live = run && run.dateKey === today ? run : undefined;
  const total = live?.guesses.reduce((sum, guess) => sum + (guess?.score ?? 0), 0) ?? 0;
  const action = !live ? "Play" : live.done ? "Results" : "Resume";
  return (
    <article className="flex flex-col rounded-xl border border-line bg-surface p-5">
      <p className="text-xs tracking-wide text-subtle uppercase">{title}</p>
      <h2 className="mt-2 font-display text-3xl text-fg">{title === "World" ? "The globe" : "Home turf"}</h2>
      <p className="mt-2 flex-1 text-sm text-muted">{detail}</p>
      <p className="mt-4 text-sm tabular-nums text-fg">
        {!live ? "Not started" : live.done ? `${total} / 500` : `Round ${live.index + 1} of 5`}
      </p>
      <Button className="mt-4" onClick={action === "Results" ? onResults : onPlay}>
        {action}
      </Button>
    </article>
  );
}

function Rules() {
  return (
    <div className="mt-4 grid gap-3 text-sm text-muted">
      <p>The map has no names until you lock a guess. Tap to drop a pin, then tap the pin or press Confirm.</p>
      <p>Arrow keys slide the map. Enter drops a pin at the center, and Enter again confirms it.</p>
      <ul className="grid gap-1">
        {(["lincoln", "region", "nebraska", "usa", "world"] as const).map((ring) => (
          <li key={ring}>
            {RINGS[ring].label}: full marks within {RINGS[ring].r0} km, about half at {RINGS[ring].halfKm} km.
          </li>
        ))}
      </ul>
      <p>A lake or neighborhood counts in full if your pin lands inside it. Roads are the easier map. Bare is water and parks only.</p>
    </div>
  );
}

function Play({ reduced }: { reduced: boolean }) {
  const run = useSession(activeRun);
  const mapStyle = useSession((state) => state.mapStyle);
  const setMapStyle = useSession((state) => state.setMapStyle);
  const theme = useSession((state) => state.theme);
  const placePin = useSession((state) => state.placePin);
  const confirmGuess = useSession((state) => state.confirmGuess);
  const setKnew = useSession((state) => state.setKnew);
  const next = useSession((state) => state.next);
  const showToday = useSession((state) => state.showToday);

  if (!run || run.done) {
    return (
      <main className="p-6">
        <Button onClick={showToday}>Back to today</Button>
      </main>
    );
  }

  const place = PLACES_BY_ID[run.placeIds[run.index]];
  const guess = run.guesses[run.index];
  const revealed = run.phase === "reveal" && Boolean(guess);
  if (!place) return null;

  return (
    <main className="flex h-dvh flex-col bg-bg">
      <div className="relative min-h-0 flex-1">
        <AtlasMap
          roundId={`${run.edition}-${run.dateKey}-${run.index}`}
          scope={place.ring}
          mapStyle={mapStyle}
          pending={run.pending}
          lockedGuess={guess ? [guess.lon, guess.lat] : null}
          answer={revealed ? place.reveal : null}
          revealed={revealed}
          reducedMotion={reduced}
          interactive={!revealed}
          theme={theme}
          onPick={placePin}
          onConfirm={confirmGuess}
        />
        <div className="pointer-events-none absolute top-3 right-3 left-3 flex items-start justify-between gap-3">
          <Button variant="secondary" className="pointer-events-auto" onClick={showToday}>
            Today
          </Button>
          <p className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg">
            {run.index + 1} / 5
          </p>
        </div>
      </div>
      <section className="max-h-[46dvh] overflow-y-auto border-t border-line bg-surface px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="text-xs tracking-wide text-subtle uppercase">
          {RINGS[place.ring].label} · Round {run.index + 1}
        </p>
        <h1 className="mt-1 font-display text-3xl text-fg">{place.name}</h1>
        <p className="sr-only" aria-live="polite">
          {revealed && guess
            ? `${place.name}. ${formatDistance(guess.distanceKm)}. Score ${guess.score} of 100.`
            : `Find ${place.name}. ${run.pending ? "Pin placed, not confirmed." : "No pin yet."}`}
        </p>
        {revealed && guess ? (
          <Reveal
            guess={guess}
            story={place.story}
            source={place.source}
            last={run.index === 4}
            onKnew={setKnew}
            onNext={next}
          />
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm text-muted">
              {run.pending
                ? "Tap the pin again, or confirm. The guess is not locked yet."
                : "Tap the map to drop a pin. Names stay hidden until you confirm."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={confirmGuess} disabled={!run.pending}>
                Confirm guess
              </Button>
              <Button
                variant="secondary"
                onClick={() => setMapStyle(mapStyle === "roads" ? "bare" : "roads")}
              >
                {mapStyle === "roads" ? "Hide roads" : "Show roads"}
              </Button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Reveal({
  guess,
  story,
  source,
  last,
  onKnew,
  onNext,
}: {
  guess: Guess;
  story: string;
  source: { label: string; href: string };
  last: boolean;
  onKnew: (knew: boolean) => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="font-display text-4xl tabular-nums text-fg">
        {guess.score}
        <span className="ml-2 text-lg text-muted">/ 100 · {formatDistance(guess.distanceKm)}</span>
      </p>
      <p className="max-w-prose text-sm text-fg">{story}</p>
      <a className="text-sm text-muted underline" href={source.href} target="_blank" rel="noreferrer">
        {source.label}
      </a>
      <div className="flex flex-wrap gap-2">
        <Button variant={guess.knew === true ? "primary" : "secondary"} onClick={() => onKnew(true)}>
          Knew it
        </Button>
        <Button variant={guess.knew === false ? "primary" : "secondary"} onClick={() => onKnew(false)}>
          New to me
        </Button>
      </div>
      <Button onClick={onNext}>{last ? "See results" : "Next place"}</Button>
    </div>
  );
}

function Results() {
  const run = useSession(activeRun);
  const showToday = useSession((state) => state.showToday);
  const startGame = useSession((state) => state.startGame);
  const [copied, setCopied] = useState(false);
  if (!run) {
    return (
      <main className="p-6">
        <Button onClick={showToday}>Back to today</Button>
      </main>
    );
  }
  const places = run.placeIds.map((id) => PLACES_BY_ID[id]);
  const total = run.guesses.reduce((sum, guess) => sum + (guess?.score ?? 0), 0);
  const other: Edition = run.edition === "world" ? "home" : "world";
  const payload = { edition: run.edition, dateKey: run.dateKey, guesses: run.guesses };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-8">
      <p className="text-sm text-muted">{run.edition === "world" ? "World" : "Home Turf"} · {run.dateKey}</p>
      <h1 className="mt-2 font-display text-5xl tabular-nums text-fg">{total}</h1>
      <p className="text-muted">out of 500</p>
      <ol className="mt-6 flex flex-col gap-3">
        {places.map((place, index) => {
          const guess = run.guesses[index];
          if (!place) return null;
          return (
            <li key={place.id} className="rounded-lg border border-line bg-surface px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-fg">{place.name}</span>
                <span className="tabular-nums text-fg">{guess?.score ?? 0}</span>
              </div>
              <p className="text-sm text-muted">
                {RINGS[place.ring].label}
                {guess ? ` · ${formatDistance(guess.distanceKm)}` : ""}
              </p>
            </li>
          );
        })}
      </ol>
      <div className="mt-6 flex flex-col gap-2">
        <Button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shareText(payload));
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy result"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            const canvas = document.createElement("canvas");
            drawShareCard(canvas, payload);
            canvas.toBlob((blob) => {
              if (!blob) return;
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `waymark-${run.edition}-${run.dateKey}.png`;
              link.click();
              URL.revokeObjectURL(url);
            });
          }}
        >
          Save share image
        </Button>
        <Button variant="secondary" onClick={() => startGame(other)}>
          {other === "world" ? "Play World" : "Play Home Turf"}
        </Button>
        <Button variant="ghost" onClick={showToday}>
          Back to today
        </Button>
      </div>
      <p className="mt-4 text-sm text-subtle">The share text has scores only. No place names.</p>
    </main>
  );
}
