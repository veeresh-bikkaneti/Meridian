import { useEffect, useMemo, useState } from "react";
import { formatDistance } from "@/game/geo";
import { BRAND } from "@/game/brand";
import { shareLoopText } from "@/game/share";
import { isNewBuildDeployed } from "@/game/build-staleness";
import { displayDate } from "@/game/daily";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/share-button";
import { GuessInput } from "./guess-input";
import { displayLoopName, fetchLoopIndex, isDuplicateGuess } from "./evaluate";
import { loopDateKey, loopDayIndex, loopNowFromSearch } from "./day";
import { getDayState, saveDayState } from "./store";
import { buildLoopGuess, submitGuess, OCTANT_ARROWS } from "./engine";
import {
  LOOP_MAX_GUESSES,
  type LoopClueFile,
  type LoopDayState,
  type LoopGuess,
  type LoopManifest,
  type LoopNameEntry,
  type LoopStatus,
} from "./types";

/**
 * The GeoDetective edition screen. Mounts OUTSIDE the endless-run state
 * machine: it fetches the day's clue file lazily, restores the day's
 * progress from the loop store, and persists every guess there. It never
 * reads or writes `meridian.run` / `meridian.drop`.
 */

const STALE_REFRESH_KEY = "meridian.staleRefresh";

const CLUE_TIERS = ["Geography", "Climate", "History", "The Hook", "Giveaway"] as const;

function assetBase(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return base.endsWith("/") ? base : `${base}/`;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Single rise on mount; opacity-only fade under reduced motion. */
function Rise({ children, reduced }: { children: React.ReactNode; reduced: boolean }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const stateClass = entered
    ? reduced
      ? "opacity-100"
      : "translate-y-0 opacity-100"
    : reduced
      ? "opacity-0"
      : "translate-y-4 opacity-0";
  return (
    <div
      className={`transition-all ease-[cubic-bezier(0.16,1,0.3,1)] ${stateClass}`}
      style={{ transitionDuration: reduced ? "150ms" : "500ms" }}
    >
      {children}
    </div>
  );
}

function isLoopManifest(value: unknown): value is LoopManifest {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return m.v === 1 && Number.isInteger(m.size) && (m.size as number) > 0;
}

function isLoopClueFile(value: unknown): value is LoopClueFile {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  const target = c.target as Record<string, unknown> | undefined;
  const source = c.source as Record<string, unknown> | undefined;
  return (
    c.v === 1 &&
    typeof c.placeId === "string" &&
    c.placeId.length > 0 &&
    !!target &&
    typeof target.lon === "number" &&
    Number.isFinite(target.lon) &&
    typeof target.lat === "number" &&
    Number.isFinite(target.lat) &&
    Array.isArray(c.clues) &&
    c.clues.length === 5 &&
    (c.clues as unknown[]).every((clue) => typeof clue === "string" && clue.length > 0) &&
    !!source &&
    typeof source.label === "string" &&
    typeof source.href === "string" &&
    // F1: scheme allowlist — the href renders into an <a>, so only
    // https: survives validation (latent stored-XSS sink otherwise).
    /^https:\/\//.test(source.href)
  );
}

async function fetchJson<T>(url: string, isValid: (value: unknown) => value is T): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const parsed: unknown = await res.json();
  if (!isValid(parsed)) throw new Error(`invalid shape for ${url}`);
  return parsed;
}

/** E2E seam: `?loop-date=YYYY-MM-DD` pins the day; inert otherwise. */
function loopNow(): Date {
  if (typeof location === "undefined") return new Date();
  return loopNowFromSearch(location.search) ?? new Date();
}

type LoadState =
  | { phase: "loading" }
  | { phase: "ready"; clue: LoopClueFile; index: number }
  | { phase: "error"; message: string; staleBuild: boolean };

export function LoopScreen({ onLeave }: { onLeave: () => void }) {
  const reduced = usePrefersReducedMotion();
  // Read once: the seam (or the clock) fixes the day for this mount.
  const now = useMemo(loopNow, []);
  const dateKey = loopDateKey(now);

  const [load, setLoad] = useState<LoadState>({ phase: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  // Reload-restore (PR #31 pattern): restore the in-progress day state
  // from the store on mount — never reset it.
  const [dayState, setDayState] = useState<LoopDayState>(() => getDayState(dateKey));
  // Friendly, screen-reader-announced feedback for rejected picks
  // (duplicates). Never consumes a guess.
  const [pickNotice, setPickNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad({ phase: "loading" });
    (async () => {
      const base = assetBase();
      const manifest = await fetchJson(`${base}loop/manifest.json`, isLoopManifest);
      const index = loopDayIndex(now, manifest.size);
      const clue = await fetchJson(`${base}loop/clues/${index}.json`, isLoopClueFile);
      if (!cancelled) setLoad({ phase: "ready", clue, index });
    })().catch(async (err: unknown) => {
      if (cancelled) return;
      // Stale-deploy pattern (mirrors game-app): when the tab predates the
      // current deploy, hashed/rotated assets 404 — offer a one-tap refresh
      // instead of a dead-end error.
      let staleBuild = false;
      try {
        staleBuild =
          sessionStorage.getItem(STALE_REFRESH_KEY) !== "1" && (await isNewBuildDeployed());
      } catch {
        staleBuild = false;
      }
      if (!cancelled) {
        setLoad({
          phase: "error",
          message: err instanceof Error ? err.message : String(err),
          staleBuild,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [now, reloadKey]);

  const refreshForNewBuild = () => {
    try {
      sessionStorage.setItem(STALE_REFRESH_KEY, "1");
    } catch {
      // Storage unavailable — reload anyway; the prompt simply reappears.
    }
    location.reload();
  };

  const onPick = (entry: LoopNameEntry) => {
    if (load.phase !== "ready" || dayState.status !== "playing") return;
    if (isDuplicateGuess(entry.id, dayState.guesses)) {
      // A repeated pick is never a wasted guess: say so, announce it,
      // and leave the day state (and the persisted store) untouched.
      setPickNotice(`You already guessed ${displayLoopName(entry)} — try another place.`);
      return;
    }
    setPickNotice(null);
    const prev = dayState.guesses[dayState.guesses.length - 1] ?? null;
    const next = submitGuess(
      dayState,
      buildLoopGuess(
        {
          name: displayLoopName(entry),
          placeId: entry.id,
          lon: entry.lon,
          lat: entry.lat,
        },
        load.clue.target,
        prev,
      ),
      load.clue.placeId,
    );
    setDayState(next);
    saveDayState(dateKey, next);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" className="self-start" onClick={onLeave}>
          Editions
        </Button>
        <p className="text-sm text-muted">{displayDate("UTC", now)} · UTC</p>
      </div>
      <header className="mt-4">
        <h1 className="font-display text-5xl text-fg">GeoDetective</h1>
        <p className="mt-3 max-w-md text-lg text-muted">
          Five guesses, one mystery place. Each guess unlocks another clue — and tells you how
          far off you were, and in which direction.
        </p>
      </header>

      {load.phase === "loading" ? (
        <p className="mt-10 text-lg text-muted" role="status">
          Loading today&rsquo;s mystery&hellip;
        </p>
      ) : null}

      {load.phase === "error" ? (
        load.staleBuild ? (
          <div
            role="alert"
            className="mt-10 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-fg"
          >
            <p>A new version of Meridian is available.</p>
            <Button type="button" onClick={refreshForNewBuild}>
              Refresh
            </Button>
          </div>
        ) : (
          <div role="alert" className="mt-10 rounded-xl border border-line bg-surface p-5">
            <p className="text-fg">Couldn&rsquo;t load today&rsquo;s mystery: {load.message}</p>
            <Button className="mt-4" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </Button>
          </div>
        )
      ) : null}

      {load.phase === "ready" ? (
        <LoopGame
          clue={load.clue}
          dayState={dayState}
          dateKey={dateKey}
          reduced={reduced}
          notice={pickNotice}
          onPick={onPick}
          onLeave={onLeave}
        />
      ) : null}
    </main>
  );
}

function LoopGame({
  clue,
  dayState,
  dateKey,
  reduced,
  notice,
  onPick,
  onLeave,
}: {
  clue: LoopClueFile;
  dayState: LoopDayState;
  dateKey: string;
  reduced: boolean;
  notice: string | null;
  onPick: (entry: LoopNameEntry) => void;
  onLeave: () => void;
}) {
  const finished = dayState.status !== "playing";
  const guessesLeft = LOOP_MAX_GUESSES - dayState.guesses.length;

  return (
    <div className="mt-8 flex flex-col gap-6">
      <section aria-label="Clues" className="flex flex-col gap-3">
        {clue.clues.map((text, i) => (
          <ClueCard
            key={i}
            tier={CLUE_TIERS[i]!}
            index={i}
            text={text}
            // When the day is over there is no "next guess" — reveal every
            // clue so the locked cards never promise one.
            revealed={finished || i < dayState.cluesRevealed}
            reduced={reduced}
          />
        ))}
      </section>

      {!finished ? (
        <section aria-label="Make a guess" className="flex flex-col gap-3">
          <p className="text-sm text-muted" role="status">
            Guess {dayState.guesses.length + 1} of {LOOP_MAX_GUESSES}
            {guessesLeft <= 2 ? ` — ${guessesLeft} left` : ""}
          </p>
          <p className="text-sm text-muted">
            Pick a name from the list, then press Guess — each press uses one of your five
            guesses.
          </p>
          <GuessInput onPick={onPick} />
          {notice ? (
            <p role="status" className="text-sm text-fg">
              {notice}
            </p>
          ) : null}
        </section>
      ) : null}

      {dayState.guesses.length > 0 ? (
        <section aria-label="Your guesses" className="flex flex-col gap-2">
          <h2 className="text-sm tracking-wide text-muted uppercase">Your guesses</h2>
          <ol className="flex flex-col gap-2">
            {[...dayState.guesses].reverse().map((g, ri) => (
              <li
                key={`${g.placeId}-${ri}`}
                className="flex items-baseline justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3"
              >
                <span className="min-w-0 truncate font-medium text-fg">{g.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-sm text-muted">
                  <span className="tabular-nums">{formatDistance(g.distKm)}</span>
                  <span
                    role="img"
                    title="Direction from your guess toward the target"
                    aria-label={`target is ${g.octant} of your guess`}
                  >
                    {OCTANT_ARROWS[g.octant]} {g.octant}
                  </span>
                  <GuessDelta guess={g} />
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {finished ? (
        <LoopReveal
          clue={clue}
          dayState={dayState}
          dateKey={dateKey}
          reduced={reduced}
          onLeave={onLeave}
        />
      ) : null}
    </div>
  );
}

function GuessDelta({ guess }: { guess: LoopGuess }) {
  if (guess.warmer === null) {
    return <span className="text-muted">· first guess</span>;
  }
  return guess.warmer ? (
    <span className="text-fg" aria-label="warmer than your previous guess">
      · warmer ↑
    </span>
  ) : (
    <span className="text-muted" aria-label="colder than your previous guess">
      · colder ↓
    </span>
  );
}

function ClueCard({
  tier,
  index,
  text,
  revealed,
  reduced,
}: {
  tier: string;
  index: number;
  text: string;
  revealed: boolean;
  reduced: boolean;
}) {
  const body = revealed ? (
    <Rise key={`revealed-${index}`} reduced={reduced}>
      <p className="mt-1 text-fg">{text}</p>
    </Rise>
  ) : (
    <p className="mt-1 text-sm text-muted">
      <span aria-hidden="true">🔒 </span>Unlocks after your next guess.
    </p>
  );
  return (
    <article
      aria-label={`Clue ${index + 1}: ${tier}${revealed ? "" : " (locked)"}`}
      className="rounded-xl border border-line bg-surface p-4"
    >
      <p className="text-[11px] tracking-wider text-muted uppercase">
        Clue {index + 1} · {tier}
      </p>
      {body}
    </article>
  );
}

/**
 * Win/loss reveal. The endless-run ResultCard is hard-coupled to the run
 * model (Run/Drop/ScoredPlace) — fabricating one for the Loop would invent
 * scores — so the Loop renders its own reveal card in the same visual
 * language: answer, stats, share, source.
 */
function LoopReveal({
  clue,
  dayState,
  dateKey,
  reduced,
  onLeave,
}: {
  clue: LoopClueFile;
  dayState: LoopDayState;
  dateKey: string;
  reduced: boolean;
  onLeave: () => void;
}) {
  const won = dayState.status === "won";
  const winningGuess = won
    ? (dayState.guesses.find((g) => g.placeId === clue.placeId) ?? null)
    : null;
  const answer = useAnswerName(clue, dayState.status, winningGuess?.name ?? null);
  const closestGuess = !won
    ? dayState.guesses.reduce<LoopGuess | null>(
        (best, g) => (!best || g.distKm < best.distKm ? g : best),
        null,
      )
    : null;

  return (
    <Rise reduced={reduced}>
      <section
        aria-label={won ? "You won" : "Out of guesses"}
        className="rounded-2xl border border-line bg-surface p-5"
      >
        <p className="text-[11px] tracking-wider text-muted uppercase">
          {won ? "🎯 You found it!" : "Out of guesses"}
        </p>
        <h2 className="mt-1 font-display text-3xl text-fg">
          {answer.name ??
            (answer.settled
              ? "We couldn't find the answer's name — but your clues are all above."
              : "Finding today's answer…")}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {won
            ? `Solved in ${dayState.guesses.length} ${dayState.guesses.length === 1 ? "guess" : "guesses"}. A new mystery lands at midnight UTC — see you tomorrow, detective.`
            : "Better luck with tomorrow's mystery — a new puzzle lands at midnight UTC."}
        </p>
        {!won && closestGuess ? (
          <p className="mt-2 text-sm text-muted">
            Your closest guess was {closestGuess.name} — {formatDistance(closestGuess.distKm)}{" "}
            away.
          </p>
        ) : null}
        <section aria-label="Today's story" className="mt-4">
          <h3 className="text-sm tracking-wide text-muted uppercase">Today&rsquo;s story</h3>
          <p className="mt-1 text-sm text-muted">This is what the clues were telling you.</p>
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-sm text-fg">
              <span className="text-muted">{CLUE_TIERS[2]}: </span>
              {clue.clues[2]}
            </p>
            <p className="text-sm text-fg">
              <span className="text-muted">{CLUE_TIERS[3]}: </span>
              {clue.clues[3]}
            </p>
          </div>
        </section>
        <div className="mt-4">
          <ShareLoop dateKey={dateKey} dayState={dayState} />
        </div>
        <p className="mt-4 text-xs text-muted">
          Clues:{" "}
          <a
            href={clue.source.href}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {clue.source.label}
          </a>
        </p>
        <div className="mt-4">
          <Button variant="ghost" onClick={onLeave}>
            Back to editions
          </Button>
        </div>
      </section>
    </Rise>
  );
}

/**
 * The answer's display name. On a win it is the winning guess's name. On a
 * loss the clue file deliberately carries no name, so the name is looked up
 * lazily from the shared guess index (usually a browser-cache hit, since
 * the guess input already loaded it).
 *
 * M7: the lookup starts unsettled on EVERY loss — the heading shows a
 * neutral "Finding today's answer…" skeleton until the lookup settles, so
 * it never flashes a false failure. Only an actual lookup failure shows
 * the failure copy.
 */
function useAnswerName(
  clue: LoopClueFile,
  status: LoopStatus,
  winName: string | null,
): { name: string | null; settled: boolean } {
  const [answer, setAnswer] = useState<{ name: string | null; settled: boolean }>(() => ({
    name: winName,
    settled: status !== "lost",
  }));
  useEffect(() => {
    if (status !== "lost") {
      setAnswer({ name: winName, settled: true });
      return;
    }
    setAnswer({ name: null, settled: false });
    let cancelled = false;
    // Reuse the guess input's cached index (a second network fetch is
    // pointless — the player already loaded it to make their guesses).
    fetchLoopIndex()
      .then((entries) => {
        if (cancelled) return;
        const entry = entries.find((e) => e.id === clue.placeId);
        setAnswer({ name: entry ? displayLoopName(entry) : null, settled: true });
      })
      .catch(() => {
        if (!cancelled) setAnswer({ name: null, settled: true });
      });
    return () => {
      cancelled = true;
    };
  }, [clue.placeId, status, winName]);
  return answer;
}

function ShareLoop({ dateKey, dayState }: { dateKey: string; dayState: LoopDayState }) {
  const text = shareLoopText({
    dateKey,
    status: dayState.status,
    guesses: dayState.guesses,
  });

  return (
    <div className="flex flex-col gap-3">
      <ShareButton
        title="GeoDetective result"
        text={text}
        url={BRAND.siteUrl}
        label="Share result"
        failureFallback={
          <pre className="whitespace-pre-wrap rounded-lg border border-line bg-bg px-4 py-3 font-sans text-sm leading-relaxed text-fg">
            {text}
          </pre>
        }
      />
    </div>
  );
}
