import { createFileRoute } from "@tanstack/react-router";
import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  FALLBACK_BOARD,
  allClosedFeatureIds,
  findStory,
  formatUpdated,
  frontierSlug,
  isStale,
  loadBoardLinks,
  loadBoardStatus,
  newlyClosedFeatures,
  readSeenClosed,
  writeSeenClosed,
  type LoadedBoard,
  type PublishedBoard,
} from "@/board/board-data";
import { loadLiveBoard } from "@/board/live-feed";
import { computeLayout } from "@/board/status-core";
import { TrailView } from "@/board/trail-view";
import { FeatureRequestForm } from "@/board/feature-request-form";
import { isEnabled, loadFlags } from "@/lib/flags";
import { HomeButton } from "@/components/ui/home-button";
import "@/board/board.css";

const MoleculeMap = lazy(() => import("@/board/molecule-map"));

/**
 * /board — "See what we're making next" (board v3).
 *
 * The board's base layer is the published status file
 * (public/board-status.json), generated from the team's own curated
 * records by scripts/board/publish-status.mjs. It renders first,
 * exactly as published, with its own Updated stamp.
 *
 * Over it sits the live feed (owner ruling, 2026-11-16: "getting
 * the live feed was the biggest requirement we had") — the overlay
 * board v2 shipped and v3 removed, restored on the published
 * contract. On load the page checks the repo's public PR/issue
 * state on GitHub (live-feed.ts), paginating until every record
 * linked from the publisher's links file is covered. Full coverage:
 * statuses are recomputed from the live answer and the header says
 * "Live from GitHub — every linked record checked (N of N)" beside
 * the snapshot's stamp. Anything less — a failed, rate-limited or
 * partial check — keeps the snapshot on screen and says so plainly.
 * The claim is never made without the coverage to back it: that
 * was v2's centrepiece defect (a one-page fetch under a "Live"
 * label), and it stays dead. Behind the boardLiveFeed kill switch.
 * If the published file itself cannot be fetched, the bundled copy
 * renders and the header discloses that ("showing the copy that
 * came with the site").
 *
 * Three views over the same published data: the trail (the journey),
 * the molecular map (the structure; behind the board3d kill switch),
 * and the tip form. One selection, mirrored to the URL
 * (?view=&story=), shared by trail and map.
 *
 * Theme (owner ruling, 2026-11-15): the board loads on the
 * visitor's system theme and the visitor can switch it — System /
 * Light / Dark in the view nav. An explicit choice sets
 * data-board-theme on the board root, where board.css re-declares
 * the scheme tokens (copies pinned by theme-parity.test.ts), and
 * persists in localStorage; System sets no attribute and the
 * media query rules, exactly as before the switch existed.
 *
 * Indexing: the board IS indexed and listed in the sitemap
 * (owner ruling, 2026-11-15, superseding board v2 step 15's
 * noindex): the "What's coming" surface is for parents to
 * discover, so search engines are welcome alongside the link
 * exposure (nav, footer, grown-ups pages).
 * scripts/static-wellknown.test.mjs asserts both halves.
 *
 * ssr: false, like / and /contact: the page reads localStorage (the
 * seen-closed set, Calm mode) and fetches the status file.
 */
export const Route = createFileRoute("/board")({
  validateSearch: (search: Record<string, unknown>): { view?: string; story?: string } => ({
    view: typeof search.view === "string" ? search.view : undefined,
    story: typeof search.story === "string" ? search.story : undefined,
  }),
  head: () => ({
    meta: [
      { title: "See what we're making next — Meridian" },
      {
        name: "description",
        content:
          "What the Meridian team is making next: the stories being built, in plain words, for grown-ups.",
      },
    ],
  }),
  ssr: false,
  component: BoardPage,
});

type BoardView = "trail" | "map" | "tip";
const CALM_KEY = "meridian-board-v3-calm";
const THEME_KEY = "meridian-board-v3-theme";
type BoardThemeChoice = "system" | "light" | "dark";

function BoardPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const view: BoardView = search.view === "map" ? "map" : search.view === "tip" ? "tip" : "trail";
  const selectedSlug = search.story ?? null;

  const [loaded, setLoaded] = useState<LoadedBoard | null>(null);
  const [mapOn, setMapOn] = useState(true);
  const [calm, setCalm] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(CALM_KEY) === "1",
  );
  /* Board theme: the stored choice wins; "system" (the default,
   * and the fallback for anything unreadable) sets no attribute —
   * the media query rules, exactly as before the switch existed. */
  const [themeChoice, setThemeChoice] = useState<BoardThemeChoice>(() => {
    if (typeof window === "undefined") return "system";
    try {
      const v = window.localStorage.getItem(THEME_KEY);
      return v === "light" || v === "dark" ? v : "system";
    } catch {
      return "system";
    }
  });
  const [systemScheme, setSystemScheme] = useState<"light" | "dark">(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark",
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) =>
      setSystemScheme(e.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const scheme: "light" | "dark" =
    themeChoice === "system" ? systemScheme : themeChoice;
  const pickTheme = (choice: BoardThemeChoice) => {
    setThemeChoice(choice);
    try {
      window.localStorage.setItem(THEME_KEY, choice);
    } catch {
      /* ignore */
    }
  };
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadBoardStatus().then((result) => {
      if (active) setLoaded(result);
    });
    void loadFlags().then(() => {
      if (active) setMapOn(isEnabled("board3d"));
    });
    return () => {
      active = false;
    };
  }, []);

  /* The live feed: once the snapshot is on screen and the flags
   * have spoken, run the one GitHub check for this page load. The
   * snapshot never waits for it. A completed check swaps the board
   * underneath every view at once (counts, pills, groups, map —
   * they all read the one `board` below); a failed or partial one
   * only adds the honest note under the header. Kill switch off =
   * no fetch and no note: the board is the snapshot, as v3 shipped. */
  const [liveBoard, setLiveBoard] = useState<PublishedBoard | null>(null);
  const [liveLine, setLiveLine] = useState<
    { kind: "live"; covered: number; wanted: number } | { kind: "unavailable" } | null
  >(null);

  useEffect(() => {
    if (!loaded) return;
    let active = true;
    void loadFlags().then(async () => {
      if (!active || !isEnabled("boardLiveFeed")) return;
      const links = await loadBoardLinks();
      const result = await loadLiveBoard(loaded.board, links);
      if (!active) return;
      if (result.kind === "live") {
        setLiveBoard(result.board);
        setLiveLine({ kind: "live", covered: result.covered, wanted: result.wanted });
      } else {
        setLiveLine({ kind: "unavailable" });
      }
    });
    return () => {
      active = false;
    };
  }, [loaded]);

  const board = liveBoard ?? loaded?.board ?? FALLBACK_BOARD;
  const layout = useMemo(() => computeLayout(board), [board]);
  const frontier = useMemo(() => frontierSlug(board), [board]);
  const stale = loaded && !liveBoard ? isStale(board.updatedAt, Date.now()) : false;

  /* Honest celebration: toast only for a feature that closed since
   * the visitor's last visit — never on first sight (spec §2). */
  useEffect(() => {
    if (!loaded) return;
    const seen = readSeenClosed(window.localStorage);
    const names = newlyClosedFeatures(board, seen);
    if (names.length > 0) setToast(names[0]);
    writeSeenClosed(window.localStorage, allClosedFeatureIds(board));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  /* Deep link: scroll the open stop into view on the trail. */
  useEffect(() => {
    if (view !== "trail" || !selectedSlug) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`v3-stop-${selectedSlug}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [view, selectedSlug, loaded]);

  const go = (next: Partial<{ view: BoardView; story: string | null }>) => {
    void navigate({
      search: {
        view: next.view ?? (view === "trail" ? undefined : view),
        story: (next.story === undefined ? selectedSlug : next.story) ?? undefined,
      },
    });
  };
  const select = (slug: string | null) => go({ story: slug });
  const frontierStory = frontier ? findStory(board, frontier) : null;

  return (
    <main
      className={`board-v3${calm ? " v3-calm" : ""}`}
      data-board-theme={themeChoice === "system" ? undefined : themeChoice}
    >
      <div className="v3-wrap">
        <header className="v3-head">
          <p className="v3-back">
            <HomeButton to="/" />
          </p>
          <p className="v3-eyebrow">For grown-ups</p>
          <h1 className="v3-title">See what we&rsquo;re making next</h1>
          <p className="v3-counts" data-testid="board-counts-line">
            {board.counts.done} of {board.counts.total} stories finished · {board.counts.inProgress}{" "}
            being built · {board.counts.notStarted} not started yet
          </p>
          <p className="v3-updated" data-testid="board-updated-line">
            {liveLine?.kind === "live"
              ? `Live from GitHub — every linked record checked (${liveLine.covered} of ${liveLine.wanted}) · `
              : ""}
            Updated {formatUpdated(board.updatedAt)}
            {loaded?.source === "manual" ? " — showing the copy that came with the site" : ""}
          </p>
          {liveLine?.kind === "unavailable" ? (
            <p className="v3-stale" role="note" data-testid="board-live-note">
              The live check couldn&rsquo;t be completed just now — showing the list as last
              updated.
            </p>
          ) : null}
          {stale ? (
            <p className="v3-stale" role="note">
              This list is more than a day old — a fresher one is on its way.
            </p>
          ) : null}
        </header>

        {frontierStory ? (
          <div className="v3-frontier-banner">
            <p>
              <strong>We&rsquo;re working on this now:</strong> {frontierStory.story.title}
            </p>
            <button
              type="button"
              className="v3-btn"
              onClick={() => go({ view: "trail", story: frontier })}
            >
              Take me there
            </button>
          </div>
        ) : null}

        <nav className="v3-viewnav" aria-label="Board views">
          <div className="v3-nav-cluster" role="group" aria-label="Views">
            <button
              type="button"
              data-testid="board-nav-trail"
              aria-pressed={view === "trail"}
              onClick={() => go({ view: "trail" })}
            >
              The trail
            </button>
            {mapOn ? (
              <button
                type="button"
                data-testid="board-nav-map"
                aria-pressed={view === "map"}
                onClick={() => go({ view: "map" })}
              >
                The structure
              </button>
            ) : null}
            <button
              type="button"
              data-testid="board-nav-tip"
              aria-pressed={view === "tip"}
              onClick={() => go({ view: "tip" })}
            >
              Send a tip
            </button>
          </div>
          <div className="v3-nav-cluster v3-nav-settings">
          <div className="v3-theme-switch" role="group" aria-label="Board theme">
            <span className="v3-theme-label" aria-hidden="true">
              Theme
            </span>
            {(
              [
                ["system", "System"],
                ["light", "Light"],
                ["dark", "Dark"],
              ] as [BoardThemeChoice, string][]
            ).map(([choice, label]) => (
              <button
                key={choice}
                type="button"
                data-testid={`board-theme-${choice}`}
                aria-pressed={themeChoice === choice}
                onClick={() => pickTheme(choice)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="v3-calm-toggle"
            data-testid="board-calm-toggle"
            aria-pressed={calm}
            onClick={() => {
              const next = !calm;
              setCalm(next);
              try {
                window.localStorage.setItem(CALM_KEY, next ? "1" : "0");
              } catch {
                /* ignore */
              }
            }}
          >
            Calm mode {calm ? "on" : "off"}
          </button>
          </div>
        </nav>

        {toast ? (
          <p className="v3-toast" role="status" data-testid="board-toast">
            🎉 {toast} is finished — every story in it is done.{" "}
            <button type="button" onClick={() => setToast(null)} aria-label="Dismiss">
              ✕
            </button>
          </p>
        ) : null}

        {!loaded ? (
          <p className="v3-loading">Loading the trail…</p>
        ) : view === "trail" ? (
          <TrailView
            board={board}
            selectedSlug={selectedSlug}
            frontier={frontier}
            onSelect={select}
            onShowInMap={(slug) => go({ view: "map", story: slug })}
          />
        ) : view === "map" ? (
          mapOn ? (
            <Suspense fallback={<p className="v3-loading">Loading the structure…</p>}>
              <MoleculeMap
                board={board}
                layout={layout}
                selectedSlug={selectedSlug}
                onSelect={select}
                onOpenInTrail={(slug) => go({ view: "trail", story: slug })}
                scheme={scheme}
              />
            </Suspense>
          ) : (
            <TrailView
              board={board}
              selectedSlug={selectedSlug}
              frontier={frontier}
              onSelect={select}
              onShowInMap={(slug) => go({ view: "map", story: slug })}
            />
          )
        ) : (
          <section className="v3-tip" aria-label="Ask for something new">
            <FeatureRequestForm />
          </section>
        )}

        <footer className="v3-footer">
          <p>Didn&rsquo;t find your idea on the trail?</p>
          <button type="button" className="v3-btn" onClick={() => go({ view: "tip" })}>
            Ask for something new
          </button>
        </footer>
      </div>
    </main>
  );
}
