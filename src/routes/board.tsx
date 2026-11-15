import { createFileRoute, Link } from "@tanstack/react-router";
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
  loadBoardStatus,
  newlyClosedFeatures,
  readSeenClosed,
  writeSeenClosed,
  type LoadedBoard,
} from "@/board/board-data";
import { computeLayout } from "@/board/status-core";
import { TrailView } from "@/board/trail-view";
import { FeatureRequestForm } from "@/board/feature-request-form";
import { isEnabled, loadFlags } from "@/lib/flags";
import "@/board/board.css";

const MoleculeMap = lazy(() => import("@/board/molecule-map"));

/**
 * /board — "See what we're making next" (board v3).
 *
 * The board reads ONE thing: the published status file
 * (public/board-status.json), generated from the team's own curated
 * records by scripts/board/publish-status.mjs. There is no live
 * fetch, no GitHub overlay, no PR anything — v2's live header
 * claimed a freshness the one-page fetch could not back, and
 * v3 removes the claim by removing the mechanism. The header shows
 * the file's own Updated stamp; past 24h the page says so plainly.
 * If the published file cannot be fetched, the bundled copy renders
 * and the header discloses that ("showing the copy that came with
 * the site").
 *
 * Three views over the same published data: the trail (the journey),
 * the molecular map (the structure; behind the board3d kill switch),
 * and the tip form. One selection, mirrored to the URL
 * (?view=&story=), shared by trail and map.
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

  const board = loaded?.board ?? FALLBACK_BOARD;
  const layout = useMemo(() => computeLayout(board), [board]);
  const frontier = useMemo(() => frontierSlug(board), [board]);
  const stale = loaded ? isStale(board.updatedAt, Date.now()) : false;

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
    <main className={`board-v3${calm ? " v3-calm" : ""}`}>
      <div className="v3-wrap">
        <p className="v3-back">
          <Link to="/">← Back to the game</Link>
        </p>
        <p className="v3-eyebrow">For grown-ups</p>
        <h1 className="v3-title">See what we&rsquo;re making next</h1>
        <p className="v3-counts" data-testid="board-counts-line">
          {board.counts.done} of {board.counts.total} stories finished · {board.counts.inProgress}{" "}
          being built · {board.counts.notStarted} not started yet
        </p>
        <p className="v3-updated" data-testid="board-updated-line">
          Updated {formatUpdated(board.updatedAt)}
          {loaded?.source === "manual" ? " — showing the copy that came with the site" : ""}
        </p>
        {stale ? (
          <p className="v3-stale" role="note">
            This list is more than a day old — a fresher one is on its way.
          </p>
        ) : null}

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
