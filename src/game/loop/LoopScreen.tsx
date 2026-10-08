import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { formatLength, loopGradeBand, unitForLoopTarget } from "@/game/units";
import { nameTier } from "@/game/place-name";
import { PlaceNameText } from "@/components/place-name";
import { GradeChip } from "@/components/grade-chip";
import { ScrollCue, useMoreBelow } from "@/components/scroll-cue";
import { BRAND } from "@/game/brand";
import { shareLoopText } from "@/game/share";
import { isNewBuildDeployed } from "@/game/build-staleness";
import { calendarDate } from "@/game/daily";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/share-button";
import { GuessInput } from "./guess-input";
import { displayLoopName, fetchLoopIndex, isDuplicateGuess } from "./evaluate";
import { LoopMap, ringAnnouncement, type LoopMapHandle } from "./LoopMap";
import { loopPuzzleFromSearch } from "./day";
import {
  playConfirmGuess,
  playDeal,
  playLose,
  playRingReveal,
  playWin,
} from "@/game/audio/sfx";
import {
  celebrationSpec,
  hasCelebratedFirstWin,
  markFirstWinCelebrated,
  type CelebrationSpec,
} from "@/components/celebration-overlay";
import {
  clampDeckToPoolSize,
  completePuzzle,
  dealPuzzleIndex,
  freshLoopPuzzleState,
  loadLoopStore,
  returnIndexToDeckHead,
  writeLoopStoreV2,
} from "./store";
import { buildLoopGuess, submitGuess, OCTANT_ARROWS } from "./engine";
import {
  LOOP_MAX_GUESSES,
  type LoopClueFile,
  type LoopGuess,
  type LoopManifest,
  type LoopNameEntry,
  type LoopPuzzleState,
  type LoopStatus,
  type LoopUnlimitedStore,
} from "./types";

/**
 * The GeoDetective edition screen, unlimited era. Mounts OUTSIDE the
 * endless-run state machine: it deals mysteries from a shuffled deck
 * persisted under `meridian.loop.v2`, restores the open mystery from the
 * store, and persists every guess there. It never reads or writes
 * `meridian.run` / `meridian.drop`, and it never touches the daily-era
 * `meridian.loop.v1` archive.
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
    source.label.length > 0 &&
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

/**
 * E2E seam: `?loop-puzzle=<index>` pins the dealt puzzle for the mount,
 * skipping the deck (no pop, no deck side effects). Inert when absent or
 * invalid — production play always deals from the deck.
 */
function seamPuzzleIndex(poolSize: number): number | null {
  if (typeof location === "undefined") return null;
  const index = loopPuzzleFromSearch(location.search);
  return index !== null && index < poolSize ? index : null;
}

type LoadState =
  | { phase: "loading"; message: string }
  | { phase: "ready"; clue: LoopClueFile; index: number }
  // `offline` selects the offline-uncached notice variant (UX-finalized copy)
  // when the fetch failed while the device had no connectivity. The stale
  // build path takes precedence in the render — it is unchanged.
  | { phase: "error"; message: string; staleBuild: boolean; offline: boolean };

/** The case-file number of the mystery currently on the desk. */
export function caseNumber(store: LoopUnlimitedStore): number {
  return store.totals.solved + store.totals.lost + 1;
}

export function LoopScreen({
  onLeave,
  onCelebrate,
}: {
  onLeave: () => void;
  /**
   * Celebration overlay trigger (owned by GameApp): the 387-cycle
   * Legendary overlay and the first-ever-win Parade overlay.
   */
  onCelebrate: (spec: CelebrationSpec) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const [store, setStore] = useState<LoopUnlimitedStore | null>(null);
  // Ref mirror so event handlers always see the latest store without
  // stale closures (the deal/complete paths must be race-free).
  const storeRef = useRef<LoopUnlimitedStore | null>(null);
  const commitStore = (next: LoopUnlimitedStore) => {
    storeRef.current = next;
    setStore(next);
    writeLoopStoreV2(next);
  };

  const [load, setLoad] = useState<LoadState>({
    phase: "loading",
    message: "Loading this mystery…",
  });
  const [reloadKey, setReloadKey] = useState(0);
  // Offline signal (Designer rec 2a): navigator.onLine + online/offline
  // listeners. Mirrored in a ref so the catch-time trigger below always
  // reads the connectivity at the moment the fetch failed, never a stale
  // render-closure value. (Same ref-mirror pattern as storeRef.)
  const online = useOnlineStatus();
  const onlineRef = useRef(online);
  useEffect(() => {
    onlineRef.current = online;
  }, [online]);
  // Friendly, screen-reader-announced feedback for rejected picks
  // (duplicates). Never consumes a guess.
  const [pickNotice, setPickNotice] = useState<string | null>(null);
  // Screen-reader announcement when a reveal lands (the Next-mystery
  // button must not be a sighted-only affordance).
  const [revealAnnouncement, setRevealAnnouncement] = useState<string | null>(null);
  // "Next mystery" idempotence: the button deals once and unmounts with
  // the reveal; a second tap during the deal is a no-op.
  const dealingRef = useRef(false);

  // Mount / retry: fetch the manifest, resolve the store (resume, seam,
  // finished-but-unacknowledged reveal, or fresh deck deal), then fetch
  // the clue file. A 404 on a freshly dealt index rolls the pop back so
  // the deck stays exactly-once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoad({ phase: "loading", message: "Loading this mystery…" });
      const base = assetBase();
      let manifest: LoopManifest;
      try {
        manifest = await fetchJson(`${base}loop/manifest.json`, isLoopManifest);
      } catch (err: unknown) {
        if (!cancelled) setLoad(await toErrorState(err, !onlineRef.current));
        return;
      }
      let next = storeRef.current
        ? clampDeckToPoolSize(storeRef.current, manifest.size)
        : loadLoopStore(manifest.size);
      const seam = seamPuzzleIndex(manifest.size);
      let dealIndex: number;
      let popped = false;
      if (next.current && next.current.status === "playing") {
        // Resume first: neither the seam nor a fresh deal ever clobbers an
        // in-progress mystery (the seam param survives reloads in the URL —
        // re-pinning here would wipe the player's guesses).
        dealIndex = next.current.index;
      } else if (next.current) {
        // Finished but unacknowledged (reload on the reveal): re-render the
        // reveal, do NOT deal a fresh mystery.
        dealIndex = next.current.index;
      } else if (seam !== null) {
        // E2E seam: deal the pinned puzzle directly — the deck is untouched.
        // Only applies when no mystery is open.
        dealIndex = seam;
        next = { ...next, current: freshLoopPuzzleState(seam, next.deck.cycle) };
      } else {
        const dealt = dealPuzzleIndex(next.deck, manifest.size);
        dealIndex = dealt.index;
        popped = true;
        next = {
          ...next,
          deck: dealt.deck,
          current: freshLoopPuzzleState(dealIndex, dealt.deck.cycle),
        };
      }
      if (cancelled) return;
      commitStore(next);
      try {
        const clue = await fetchJson(
          `${base}loop/clues/${dealIndex}.json`,
          isLoopClueFile,
        );
        if (!cancelled) setLoad({ phase: "ready", clue, index: dealIndex });
      } catch (err: unknown) {
        if (cancelled) return;
        if (popped) {
          // §7e: the deal failed — put the index back on the deck head so
          // the deck stays exactly-once. Retry re-attempts the same index.
          const rolled = clampDeckToPoolSize(
            {
              ...next,
              deck: returnIndexToDeckHead(next.deck, dealIndex),
              current: null,
            },
            manifest.size,
          );
          commitStore(rolled);
        }
        setLoad(await toErrorState(err, !onlineRef.current));
      }
    })()
      // Safety net (mirrors onNextMystery): every await inside is guarded,
      // so this is unreachable in practice — but an unexpected throw must
      // never leave the screen stuck on the loading shimmer.
      .catch(async (err: unknown) => {
        if (!cancelled) setLoad(await toErrorState(err, !onlineRef.current));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const refreshForNewBuild = () => {
    try {
      sessionStorage.setItem(STALE_REFRESH_KEY, "1");
    } catch {
      // Storage unavailable — reload anyway; the prompt simply reappears.
    }
    location.reload();
  };

  const onPick = (entry: LoopNameEntry) => {
    const s = storeRef.current;
    const current = s?.current;
    // The loaded clue must belong to the open mystery — a stale pick
    // against a mismatched deal is never submitted.
    if (load.phase !== "ready" || !s || !current || current.status !== "playing") return;
    if (load.index !== current.index) return;
    if (isDuplicateGuess(entry.id, current.guesses)) {
      // A repeated pick is never a wasted guess: say so, announce it,
      // and leave the store untouched.
      setPickNotice(`You already guessed ${displayLoopName(entry)} — try another place.`);
      return;
    }
    setPickNotice(null);
    // SFX audio spec §2.1: the confirm blip fires once the duplicate check
    // passes — duplicates get no sound (they already get a text notice).
    playConfirmGuess();
    const prev = current.guesses[current.guesses.length - 1] ?? null;
    const progressed: LoopPuzzleState = {
      ...current,
      ...submitGuess(
        current,
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
      ),
    };
    if (progressed.status === "playing") {
      commitStore({ ...s, current: progressed });
    } else {
      // Completion: streak, totals, cycle counter, and the share date move
      // in one synchronous handler — exactly once per mystery.
      // SFX audio spec §2.3/§2.4: the win arpeggio / lose sting fire on the
      // reveal (reload-restoring an unacknowledged reveal re-renders from the
      // store and never passes through here — no sound on restore).
      if (progressed.status === "won") playWin();
      else playLose();
      const completedStore = completePuzzle(s, progressed, calendarDate("UTC", new Date()));
      commitStore(completedStore);
      // Celebration (spec §3): the last undealt case of the cycle resolves
      // here — win or lose. A completed cycle fires the grand fanfare +
      // Legendary overlay exactly once (the silent reshuffle into the next
      // cycle never passes through here; reload-restores re-render from
      // the store and never pass through here either). Legendary outranks
      // Parade: a first win landing on the final case gets the Legendary
      // overlay, but the first-win flag is still marked so it never fires
      // later. Otherwise a first-ever win gets the Parade overlay — the
      // mystery-solved variant plays nothing more (playWin already fired
      // above), so it never doubles.
      const cycleDone = completedStore.current?.completedCycle === true;
      if (cycleDone) {
        markFirstWinCelebrated();
        onCelebrate(celebrationSpec("game-complete", "deck-complete"));
      } else if (progressed.status === "won" && !hasCelebratedFirstWin()) {
        markFirstWinCelebrated();
        onCelebrate(celebrationSpec("mystery-solved", "first-win"));
      }
      setRevealAnnouncement("Reveal loaded. Next mystery button available.");
    }
  };

  /** The core retention hook: instant deal from the deck, no waiting room. */
  const onNextMystery = () => {
    if (dealingRef.current) return;
    const s = storeRef.current;
    if (!s?.current || s.current.status === "playing") return;
    dealingRef.current = true;
    setRevealAnnouncement(null);
    setPickNotice(null);
    setLoad({ phase: "loading", message: "A new mystery is on your desk…" });
    (async () => {
      const base = assetBase();
      let manifest: LoopManifest;
      try {
        manifest = await fetchJson(`${base}loop/manifest.json`, isLoopManifest);
      } catch (err: unknown) {
        setLoad(await toErrorState(err, !onlineRef.current));
        return;
      }
      // Prefer the in-memory store when the screen already holds one
      // (blocked-storage sessions live entirely in memory — re-reading
      // from storage would reset the session).
      let next = storeRef.current
        ? clampDeckToPoolSize(storeRef.current, manifest.size)
        : loadLoopStore(manifest.size);
      const dealt = dealPuzzleIndex(next.deck, manifest.size);
      next = {
        ...next,
        deck: dealt.deck,
        current: freshLoopPuzzleState(dealt.index, dealt.deck.cycle),
      };
      commitStore(next);
      try {
        const clue = await fetchJson(
          `${base}loop/clues/${dealt.index}.json`,
          isLoopClueFile,
        );
        setLoad({ phase: "ready", clue, index: dealt.index });
        // SFX audio spec §2.5: the "case file snapped open" fires when the
        // next mystery deals — only on this explicit user tap, and only on
        // a successful deal. A failed deal stays silent; the mount path
        // (fresh deal AND reload-restore of an unacknowledged reveal) never
        // fires it.
        playDeal();
      } catch (err: unknown) {
        const rolled = clampDeckToPoolSize(
          {
            ...next,
            deck: returnIndexToDeckHead(next.deck, dealt.index),
            current: null,
          },
          manifest.size,
        );
        commitStore(rolled);
        setLoad(await toErrorState(err, !onlineRef.current));
      }
    })()
      .catch(() => {
        // Unreachable in practice (every await is guarded), but a rejection
        // must never leave the screen stuck on a shimmer.
        setLoad({
          phase: "error",
          message: "Something went wrong dealing the next mystery.",
          staleBuild: false,
          offline: !onlineRef.current,
        });
      })
      .finally(() => {
        dealingRef.current = false;
      });
  };

  const current = store?.current ?? null;
  const caseNo = store ? caseNumber(store) : 1;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" className="self-start" onClick={onLeave}>
          Editions
        </Button>
        <p className="text-sm text-muted">Case #{caseNo}</p>
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
          {load.message}
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
        ) : load.offline ? (
          // Offline-uncached notice (UX-finalized copy — do not reword).
          // Host: none — the loop screen's voice is the impersonal
          // case-file narrator. Same copy for mount-deal and
          // Next-mystery-deal paths.
          <div role="alert" className="mt-10 rounded-xl border border-line bg-surface p-5">
            <p className="text-fg">This mystery can't open right now 🔍</p>
            <p className="mt-2 text-muted">
              The clues need the internet the first time. Once a mystery opens, you can
              play it offline too.
            </p>
            <Button className="mt-4 min-h-[48px]" onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </Button>
          </div>
        ) : (
          <div role="alert" className="mt-10 rounded-xl border border-line bg-surface p-5">
            <p className="text-fg">Couldn&rsquo;t load this mystery: {load.message}</p>
            <Button className="mt-4" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </Button>
          </div>
        )
      ) : null}

      {load.phase === "ready" && store && current ? (
        <LoopGame
          clue={load.clue}
          puzzle={current}
          streak={store.streak}
          caseNo={caseNo}
          cycleCompleted={store.deck.cycleCompleted}
          reduced={reduced}
          notice={pickNotice}
          revealAnnouncement={revealAnnouncement}
          onPick={onPick}
          onNextMystery={onNextMystery}
          onLeave={onLeave}
        />
      ) : null}
    </main>
  );
}

/** Stale-deploy pattern (mirrors game-app): when the tab predates the
 * current deploy, hashed/rotated assets 404 — offer a one-tap refresh
 * instead of a dead-end error.
 *
 * `offline` is evaluated by the caller at catch time (UX spec): when the
 * fetch failed with no connectivity, the render shows the offline-uncached
 * notice variant instead of the generic error copy. No separate
 * cache-presence probe (Designer rec 2b): the SW cache-first fetch IS the
 * probe — a cached manifest/clue resolves the fetch and never reaches
 * here, so the notice only appears when the mystery is truly unplayable. */
async function toErrorState(
  err: unknown,
  offline: boolean,
): Promise<Extract<LoadState, { phase: "error" }>> {
  let staleBuild = false;
  try {
    staleBuild =
      sessionStorage.getItem(STALE_REFRESH_KEY) !== "1" && (await isNewBuildDeployed());
  } catch {
    staleBuild = false;
  }
  return {
    phase: "error",
    message: err instanceof Error ? err.message : String(err),
    staleBuild,
    offline,
  };
}

function LoopGame({
  clue,
  puzzle,
  streak,
  caseNo,
  cycleCompleted,
  reduced,
  notice,
  revealAnnouncement,
  onPick,
  onNextMystery,
  onLeave,
}: {
  clue: LoopClueFile;
  puzzle: LoopPuzzleState;
  streak: number;
  caseNo: number;
  cycleCompleted: number;
  reduced: boolean;
  notice: string | null;
  revealAnnouncement: string | null;
  onPick: (entry: LoopNameEntry) => void;
  onNextMystery: () => void;
  onLeave: () => void;
}) {
  const finished = puzzle.status !== "playing";
  const guessesLeft = LOOP_MAX_GUESSES - puzzle.guesses.length;

  // Length unit for every distance on this screen: a USA mystery reads
  // miles, the rest of the world reads kilometers — derived from the
  // target's territory, never device locale (Veeresh's ratified decision 4).
  const loopUnit = unitForLoopTarget([clue.target.lon, clue.target.lat]);

  // Detective's Atlas (Option A): the map is the primary guess surface.
  const mapHandleRef = useRef<LoopMapHandle | null>(null);
  // Place tapped on the map, awaiting confirm in the bottom sheet.
  const [selected, setSelected] = useState<LoopNameEntry | null>(null);
  // Gentle hint for ocean/empty taps (fail closed: never a wasted guess).
  // "loading" while the place index isn't ready yet — the tapped spot may
  // simply not have loaded, so don't claim it's not a place.
  const [emptyTapHint, setEmptyTapHint] = useState<"empty" | "loading" | null>(null);
  // Screen-reader announcement for each freshly drawn ring.
  const [ringNote, setRingNote] = useState<string | null>(null);
  const announcedCount = useRef(puzzle.guesses.length);
  const announcedKey = useRef(`${puzzle.cycle}:${puzzle.index}`);

  // Tap on the map: open the confirm sheet for the resolved place.
  const onMapSelect = (entry: LoopNameEntry) => {
    if (finished) return;
    setEmptyTapHint(null);
    setSelected(entry);
  };
  const onMapEmptyTap = (indexLoading: boolean) => {
    setSelected(null);
    setEmptyTapHint(indexLoading ? "loading" : "empty");
  };
  // Camera-jump search: fly there AND select the place (the sheet still
  // confirms — a jump never burns a guess by itself).
  const onJump = (entry: LoopNameEntry) => {
    if (finished) return;
    mapHandleRef.current?.flyToEntry(entry);
    setEmptyTapHint(null);
    setSelected(entry);
  };
  // Bottom-sheet confirm: the same onPick flow as the old typeahead —
  // duplicate check, engine submit, persist.
  const onConfirmSelected = () => {
    if (!selected) return;
    onPick(selected);
    setSelected(null);
  };

  // Announce each new ring as text (the visual deduction surface has a
  // spoken equivalent). Resets per mystery so a resume never re-announces
  // old rings and a new deal never inherits a stale count.
  // SFX audio spec §2.2: the distance ring's pitch IS the distance —
  // playRingReveal fires exactly once per new guess, keyed on the same
  // guess-count transition that draws the ring. A correct guess (distKm 0)
  // clamps to 1 km → brightest ping. StrictMode double-effects are safe:
  // announcedCount.current persists across the double-invoke, so the second
  // pass sees no new guess and stays silent.
  useEffect(() => {
    const key = `${puzzle.cycle}:${puzzle.index}`;
    if (announcedKey.current !== key) {
      announcedKey.current = key;
      announcedCount.current = puzzle.guesses.length;
    }
    const n = puzzle.guesses.length;
    if (n > announcedCount.current) {
      const latest = puzzle.guesses[n - 1];
      if (latest) {
        playRingReveal(latest.distKm);
        if (latest.distKm > 0) setRingNote(ringAnnouncement(latest));
      }
    }
    announcedCount.current = n;
  }, [puzzle]);

  // Clear a stale selection when the mystery finishes underneath it.
  useEffect(() => {
    if (finished) setSelected(null);
  }, [finished]);

  return (
    <div className="mt-8 flex flex-col gap-6">
      <section aria-label="Detective's map" className="flex flex-col gap-3">
        <p className="text-sm text-muted" role="status">
          Guess {puzzle.guesses.length + 1} of {LOOP_MAX_GUESSES}
          {guessesLeft <= 2 && !finished ? ` — ${guessesLeft} left` : ""}
        </p>
        <LoopMap
          guesses={puzzle.guesses}
          target={clue.target}
          finished={finished}
          handleRef={mapHandleRef}
          onSelectPlace={onMapSelect}
          onEmptyTap={onMapEmptyTap}
        />
        {!finished ? (
          <>
            <GuessInput onJump={onJump} />
            <p className="text-xs text-muted" aria-hidden="true">
              ✕&thinsp;=&thinsp;searched&ensp;·&ensp;<span className="text-[#f2c14e]">gold ring</span>&thinsp;=&thinsp;exact distance from that guess
            </p>
            {emptyTapHint === "empty" ? (
              <p role="status" className="text-sm text-muted">
                That spot isn&rsquo;t a labeled place — tap a name on the map, or search
                above to fly there.
              </p>
            ) : null}
            {emptyTapHint === "loading" ? (
              <p role="status" className="text-sm text-muted">
                Still loading place names — one moment…
              </p>
            ) : null}
            {notice ? (
              <p role="status" className="text-sm text-fg">
                {notice}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">
            Case closed — the gold star marks the answer.
          </p>
        )}
        <p role="status" aria-live="polite" className="sr-only">
          {ringNote}
        </p>
      </section>

      {selected && !finished ? (
        <PlaceSheet
          entry={selected}
          onConfirm={onConfirmSelected}
          onCancel={() => setSelected(null)}
        />
      ) : null}

      <section aria-label="Clues" className="flex flex-col gap-3">
        {clue.clues.map((text, i) => (
          <ClueCard
            key={i}
            tier={CLUE_TIERS[i]!}
            index={i}
            text={text}
            // When the mystery is over there is no "next guess" — reveal every
            // clue so the locked cards never promise one.
            revealed={finished || i < puzzle.cluesRevealed}
            reduced={reduced}
          />
        ))}
      </section>

      {puzzle.guesses.length > 0 ? (
        <section aria-label="Your guesses" className="flex flex-col gap-2">
          <h2 className="text-sm tracking-wide text-muted uppercase">Your guesses</h2>
          {/* Cartographer's Plate PR3 (spec §5): the LIST scrolls
              (max-h 40dvh) — rows never do. Named region + tabindex="0"
              so keyboard users can reach it (spec §8.1). */}
          <GuessListScroll>
          <ol className="flex flex-col gap-2">
            {[...puzzle.guesses].reverse().map((g, ri) => {
              // Rows render newest-first; the dossier number is the guess's
              // actual 1-based position in play order.
              const n = puzzle.guesses.length - ri;
              const first = n === 1;
              return (
                <li
                  key={`${g.placeId}-${ri}`}
                  className="dossier-row border border-line bg-surface"
                  aria-label={`Guess ${n}: ${g.name}. ${first ? "First guess" : g.warmer ? "Warmer than previous" : "Colder than previous"}. ${formatLength(g.distKm, loopUnit)}, ${g.octant.replace("-", "")}.`}
                >
                  <span className="dossier-left">
                    <span className="dossier-num">№ {n}</span>
                    <span
                      className="place-name dossier-name"
                      data-name-tier={nameTier(g.name)}
                      title={g.name}
                    >
                      <PlaceNameText name={g.name} />
                    </span>
                  </span>
                  <span className="dossier-right">
                    <span className="dossier-dist">
                      {formatLength(g.distKm, loopUnit)}
                    </span>
                    {first ? (
                      <span className="first-guess-tag">First guess</span>
                    ) : (
                      <span className="dossier-trend">
                        {g.warmer ? "Warmer" : "Colder"}
                      </span>
                    )}
                    <span className="dossier-bearing">
                      <span
                        className="dossier-bearing-arrow"
                        aria-hidden="true"
                        title="Direction from your guess toward the target"
                      >
                        {OCTANT_ARROWS[g.octant]}
                      </span>
                      <span className="dossier-octant">{g.octant}</span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          </GuessListScroll>
        </section>
      ) : null}

      {finished ? (
        <LoopReveal
          clue={clue}
          puzzle={puzzle}
          streak={streak}
          caseNo={caseNo}
          cycleCompleted={cycleCompleted}
          reduced={reduced}
          revealAnnouncement={revealAnnouncement}
          onNextMystery={onNextMystery}
          onLeave={onLeave}
        />
      ) : null}
    </div>
  );
}

/**
 * Cartographer's Plate PR3 (spec §5): the guess-list scroll region.
 * The LIST scrolls (`max-h 40dvh`) — rows never do. A named
 * `role="region"` with `tabindex="0"` so keyboard users can reach and
 * scroll it (spec §8.1); the fade + ⋯ + "more below" cue is the visual
 * signal, hidden when everything fits.
 */
function GuessListScroll({ children }: { children: React.ReactNode }) {
  const { ref, moreBelow } = useMoreBelow<HTMLDivElement>();
  return (
    <div className="scroll-cue-wrap">
      <div
        ref={ref}
        className="loop-guess-scroll"
        role="region"
        aria-label="Guess list — scroll for more"
        tabIndex={0}
      >
        {children}
      </div>
      <ScrollCue visible={moreBelow} />
    </div>
  );
}

/**
 * Confirm bottom sheet for a map-tapped place (Option A).
 * The tap only SELECTS — this sheet's button burns the guess, so a
 * mis-tap never costs one of the five. All targets ≥ 44px (fat-finger
 * safety on mobile). Escape/backdrop cancel without penalty.
 *
 * Cartographer's Plate PR2 (spec §5): two detents — names over 60 chars
 * open at the full detent (skip half-sheet); the header (48px dismiss +
 * tiered name) and the button bar stay pinned outside the scroll zone;
 * `overscroll-behavior: contain` so sheet scrolling never drags the map.
 */
function PlaceSheet({
  entry,
  onConfirm,
  onCancel,
}: {
  entry: LoopNameEntry;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const tappedName = displayLoopName(entry);
  // Names over 60 chars open at the full detent (skip half-sheet).
  const fullDetent = nameTier(tappedName) === "long";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Guess ${tappedName}?`}
      className="fixed inset-0 z-50 flex items-end justify-center"
    >
      <button
        type="button"
        aria-label="Cancel — keep exploring the map"
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-black/60"
      />
      <div
        className="relative flex w-full max-w-md flex-col rounded-t-3xl border border-line bg-surface"
        style={{
          maxHeight: fullDetent ? "min(85dvh, 36rem)" : "min(45dvh, 20rem)",
          overscrollBehavior: "contain",
        }}
      >
        <div className="shrink-0 px-6 pt-3">
          <div className="sheet-handle" aria-hidden="true" />
        </div>
        {/* Cartographer's Plate PR3: pinned 48px dismiss header
            (flex-shrink: 0 — never scrolled away). */}
        <div className="sheet-header flex shrink-0 items-start justify-between gap-3 px-6 pt-2">
          <div className="min-w-0">
            <p className="text-[11px] tracking-wider text-muted uppercase">You tapped</p>
            <h2
              className="place-name sheetname mt-1"
              data-name-tier={nameTier(tappedName)}
              title={tappedName}
            >
              <PlaceNameText name={tappedName} />
            </h2>
          </div>
          <button
            type="button"
            aria-label="Dismiss — keep exploring the map"
            onClick={onCancel}
            className="flex size-12 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <span aria-hidden="true" className="text-xl leading-none">✕</span>
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end">
          <div
            className="shrink-0 border-t border-line px-6 pt-4"
            style={{
              paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
              background: "var(--game-chrome-solid)",
            }}
          >
            <div className="flex flex-col gap-2">
              <Button type="button" onClick={onConfirm} className="min-h-[48px] w-full text-base">
                Guess this place
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                className="min-h-[48px] w-full"
              >
                Not this one
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
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
 * language: answer, stats, share, source. The primary action is the
 * retention hook: an instant "🔎 Next mystery" deal, on both win and loss.
 */
function LoopReveal({
  clue,
  puzzle,
  streak,
  caseNo,
  cycleCompleted,
  reduced,
  revealAnnouncement,
  onNextMystery,
  onLeave,
}: {
  clue: LoopClueFile;
  puzzle: LoopPuzzleState;
  streak: number;
  caseNo: number;
  /** Mysteries finished in the current cycle — names the celebration count. */
  cycleCompleted: number;
  reduced: boolean;
  revealAnnouncement: string | null;
  onNextMystery: () => void;
  onLeave: () => void;
}) {
  const won = puzzle.status === "won";
  const winningGuess = won
    ? (puzzle.guesses.find((g) => g.placeId === clue.placeId) ?? null)
    : null;
  const answer = useAnswerName(clue, puzzle.status, winningGuess?.name ?? null);
  const closestGuess = !won
    ? puzzle.guesses.reduce<LoopGuess | null>(
        (best, g) => (!best || g.distKm < best.distKm ? g : best),
        null,
      )
    : null;

  // The Next-mystery button is the point of the reveal — pull the card into
  // view on completion (on desktop it mounts below the fold). Instant under
  // reduced motion, smooth otherwise.
  const revealRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    revealRef.current?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  }, [reduced]);

  // Length unit for every distance on this card, from the mystery
  // target's territory (Veeresh's ratified decision 4): a USA mystery
  // reads miles, the rest of the world reads kilometers.
  const loopUnit = unitForLoopTarget([clue.target.lon, clue.target.lat]);
  // The reveal verdict pairs the number with meaning (spec §7): a win is
  // always Bullseye; a loss grades the closest guess by proximity.
  const gradeBand = won
    ? loopGradeBand(0, loopUnit)
    : closestGuess
      ? loopGradeBand(closestGuess.distKm, loopUnit)
      : null;
  // Cartographer's Plate PR3 — the case-file body scrolls behind the
  // pinned verdict and the pinned CTA.
  const { ref: bodyRef, moreBelow: bodyMoreBelow } = useMoreBelow<HTMLDivElement>();
  // Clue-history summary rows (spec §5): compact to summary rows first;
  // the full clue text stays in the DOM and expands on tap.
  const [openClues, setOpenClues] = useState<Record<number, boolean>>({});
  const toggleClue = (index: number) =>
    setOpenClues((prev) => ({ ...prev, [index]: !prev[index] }));

  return (
    <Rise reduced={reduced}>
      <section
        ref={revealRef}
        aria-label={won ? "You won" : "Out of guesses"}
        className="loop-reveal rounded-2xl border border-line bg-surface"
      >
        {/* ---- Zone 1: pinned header — verdict + answer, never buried ---- */}
        <div className="loop-reveal-header">
          {puzzle.completedCycle ? (
            <div
              role="status"
              aria-label="Cycle complete celebration"
              className="mb-4 rounded-xl border border-line bg-bg p-4 text-center"
            >
              <p className="text-lg font-semibold text-fg">
                🏆 You closed all {cycleCompleted} cases, detective!
              </p>
              <p className="mt-1 text-sm text-muted">
                Every mystery in the deck, solved or survived. A fresh deck is on your desk.
              </p>
            </div>
          ) : null}
          <div className="verdict-row">
            <p className="verdict-headline loop-verdict-headline">
              {won ? "🎯 You found it!" : "Out of guesses"}
            </p>
            {gradeBand ? (
              <GradeChip emoji={gradeBand.emoji} bandName={gradeBand.name} />
            ) : null}
          </div>
          <h2
            className="place-name lrname mt-1 text-fg"
            data-name-tier={answer.name ? nameTier(answer.name) : undefined}
            title={answer.name ?? undefined}
          >
            {answer.name ? (
              <PlaceNameText name={answer.name} />
            ) : answer.settled ? (
              "We couldn't find the answer's name — but your clues are all above."
            ) : (
              "Finding the answer…"
            )}
          </h2>
          {won ? (
            <>
              <p className="mt-2 text-sm text-muted">
                Solved in {puzzle.guesses.length} of {LOOP_MAX_GUESSES} guesses.
              </p>
              <p className="mt-1 text-sm font-medium text-fg">🔥 Streak: {streak}</p>
            </>
          ) : (
            <>
              {closestGuess ? (
                <p className="place-name mt-2 text-sm text-muted">
                  Your closest guess was {closestGuess.name} — {formatLength(closestGuess.distKm, loopUnit)}{" "}
                  away.
                </p>
              ) : null}
              {puzzle.streakEndedAt !== null && puzzle.streakEndedAt > 0 ? (
                <p className="mt-2 text-sm font-medium text-fg">
                  Streak reset — it ended at {puzzle.streakEndedAt}.
                </p>
              ) : null}
            </>
          )}
        </div>
        {/* ---- Zone 2: the single scrolling body — case file + share +
            source. Named region + tabindex="0" per spec §8.1. ---- */}
        <div className="scroll-cue-wrap loop-reveal-bodywrap">
          <div
            ref={bodyRef}
            className="loop-reveal-body"
            role="region"
            aria-label="Case file — scroll for more"
            tabIndex={0}
          >
            <section aria-label="Case file">
              <h3 className="text-sm tracking-wide text-muted uppercase">Case file</h3>
              <p className="mt-1 text-sm text-muted">This is what the clues were telling you.</p>
              <div className="clue-history mt-2">
                {[2, 3].map((index) => {
                  const open = !!openClues[index];
                  const tier = CLUE_TIERS[index]!;
                  return (
                    <div key={index} className="clue-history-row">
                      <button
                        type="button"
                        className="clue-history-toggle"
                        aria-expanded={open}
                        data-testid={`clue-history-row-${index + 1}`}
                        onClick={() => toggleClue(index)}
                      >
                        <span className="clue-history-label">
                          Clue {index + 1} · {tier}
                        </span>
                        <ChevronDown
                          className={`size-5 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </button>
                      <div hidden={!open} className="clue-history-body">
                        <p className="text-sm text-fg">{clue.clues[index]}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            <div>
              <ShareLoop puzzle={puzzle} streak={streak} />
            </div>
            <p className="text-xs text-muted">
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
          </div>
          <ScrollCue visible={bodyMoreBelow} />
        </div>
        {/* ---- Zone 3: pinned CTA — the next mystery is the point of the
            reveal; it never scrolls away and never animates in late. ---- */}
        <div className="loop-reveal-cta">
          <Button
            type="button"
            onClick={onNextMystery}
            className="min-h-[48px] w-full text-base"
          >
            🔎 Next mystery
          </Button>
          <p className="text-center text-sm text-muted">Case #{caseNo} is on your desk.</p>
          <Button variant="ghost" onClick={onLeave} className="min-h-[48px]">
            Back to editions
          </Button>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {revealAnnouncement}
        </p>
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
 * neutral "Finding the answer…" skeleton until the lookup settles, so
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

function ShareLoop({ puzzle, streak }: { puzzle: LoopPuzzleState; streak: number }) {
  // The share date is the UTC completion date stamped when the mystery
  // ended — not the deal date, not the clock at share time.
  const dateKey = puzzle.completedAt ?? calendarDate("UTC", new Date());
  const text = shareLoopText({
    dateKey,
    status: puzzle.status,
    guesses: puzzle.guesses,
    streak,
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
