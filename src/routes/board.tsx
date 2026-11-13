import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import snapshotJson from "@/board/snapshot.json";
import {
  applyLiveData,
  fetchLivePrs,
  filterStories,
  groupByLane,
  groupByStatus,
  headerMetrics,
  STATUS_LABEL,
  type LiveSource,
  type LiveStory,
  type SnapshotData,
  type StoryStatus,
} from "@/board/board-data";
import { StoryCard } from "@/board/story-card";
import { FeatureRequestForm } from "@/board/feature-request-form";
import { prefersReducedMotion, webglAvailable } from "@/board/view-helpers";
import "@/board/board.css";

/**
 * /board — live scrum board + feature map for Meridian.
 *
 * Deliberately NOT part of the kids' game flow: nothing on Home, in any
 * menu, on the Why card, or on any game screen links here, and the route
 * is noindex. It renders from the snapshot first, then overlays live
 * GitHub PR state (public API, no auth; see src/board/board-data.ts).
 *
 * ssr: false, like / and /contact: the page reads localStorage (the PR
 * cache) and window.matchMedia / WebGL, so it is client-only.
 */
export const Route = createFileRoute("/board")({
  head: () => ({
    meta: [
      { title: "Meridian Story Map — live board" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Live scrum board and feature map for Meridian, for the project owner and grown-ups.",
      },
    ],
  }),
  ssr: false,
  component: BoardPage,
});

const snapshot = snapshotJson as unknown as SnapshotData;

// three.js is lazy: this dynamic import is the only path to the feature
// map component, and that component dynamically imports "three" itself.
const FeatureMap = lazy(() => import("@/board/feature-map"));

type MapView = "3d" | "list";

function formatTime(epochMs: number): string {
  try {
    return new Date(epochMs).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return new Date(epochMs).toISOString();
  }
}

function BoardPage() {
  const [stories, setStories] = useState<LiveStory[]>(() => applyLiveData(snapshot.stories, []));
  const [liveSource, setLiveSource] = useState<LiveSource>("snapshot");
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  // List view is the default when reduced motion is on or WebGL is
  // missing; the toggle can force either view afterwards.
  const [mapView, setMapView] = useState<MapView>("list");
  const [mapChosen, setMapChosen] = useState(false);
  const [query, setQuery] = useState("");
  const [blockedOnly, setBlockedOnly] = useState(false);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    const hasGl = webglAvailable();
    setMapView(reduced || !hasGl ? "list" : "3d");
  }, []);

  useEffect(() => {
    let active = true;
    fetchLivePrs()
      .then((result) => {
        if (!active) return;
        setLiveSource(result.source);
        setFetchedAt(result.fetchedAt);
        if (result.prs.length > 0) setStories(applyLiveData(snapshot.stories, result.prs));
      })
      .catch(() => {
        // fetchLivePrs never throws by design; this is a last-resort
        // guard so the snapshot render can never be taken down.
      });
    return () => {
      active = false;
    };
  }, []);

  const onMapUnavailable = useCallback(() => {
    setMapView("list");
  }, []);

  const metrics = useMemo(() => headerMetrics(stories), [stories]);
  const counts: Record<StoryStatus, number> = {
    "not-started": metrics.notStarted,
    "in-progress": metrics.inProgress,
    done: metrics.done,
  };

  const visibleStories = useMemo(
    () => filterStories(stories, { query, blockedOnly }),
    [stories, query, blockedOnly],
  );
  const filterActive = query.trim() !== "" || blockedOnly;
  const columns = useMemo(() => groupByStatus(visibleStories), [visibleStories]);
  const lanes = useMemo(() => groupByLane(visibleStories, snapshot.lanes), [visibleStories]);

  const liveLine =
    liveSource === "live" && fetchedAt
      ? `Live from GitHub · updated ${formatTime(fetchedAt)}`
      : fetchedAt
        ? `Showing saved data from ${formatTime(fetchedAt)}`
        : "Showing the snapshot from the story map";

  return (
    <main className="board-page" data-testid="board-page">
      <div className="board-wrap">
        <header style={{ display: "grid", gap: 14 }}>
          <div>
            <h1>Meridian Story Map</h1>
            <p className="board-asof">
              {snapshot.asOf} · main <span className="board-mono">{snapshot.main}</span>
              <br />
              <span data-testid="board-live-line">{liveLine}</span>
            </p>
          </div>
          <div
            className="board-tiles"
            role="group"
            aria-label="Header metrics: story counts by status, open pull requests, and blocked stories"
          >
            {(Object.keys(STATUS_LABEL) as StoryStatus[]).map((status) => (
              <div className="board-tile" key={status}>
                <b>{counts[status]}</b>
                <span>{STATUS_LABEL[status]}</span>
              </div>
            ))}
            <div className="board-tile">
              <b>{metrics.openPrs}</b>
              <span>Open PRs</span>
            </div>
            <div className="board-tile">
              <b>{metrics.blocked}</b>
              <span>Blocked</span>
            </div>
          </div>
        </header>

        <section className="board-section" aria-labelledby="board-next-heading">
          <h2 id="board-next-heading">Next 3 moves</h2>
          <ol className="board-next">
            {snapshot.next.map((n) => (
              <li key={n}>
                <span>{n}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="board-controls">
          <label className="board-search">
            Search stories
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title, lane, owner, or PR number"
            />
          </label>
          <button
            type="button"
            aria-pressed={blockedOnly}
            onClick={() => setBlockedOnly((v) => !v)}
          >
            Blocked only
          </button>
          {filterActive ? (
            <p className="board-muted" role="status">
              Showing {visibleStories.length} of {stories.length} stories
            </p>
          ) : null}
        </div>

        <section className="board-section" aria-labelledby="board-scrum-heading">
          <h2 id="board-scrum-heading">Scrum board</h2>
          <div className="board-columns">
            {(Object.keys(STATUS_LABEL) as StoryStatus[]).map((status) => (
              <section
                key={status}
                className="board-column"
                data-testid={`scrum-column-${status}`}
                aria-label={STATUS_LABEL[status]}
              >
                <h3>
                  {STATUS_LABEL[status]} ({columns[status].length})
                </h3>
                {columns[status].length === 0 ? (
                  <p className="board-empty">Nothing here yet.</p>
                ) : (
                  <ul className="board-cards">
                    {columns[status].map((story) => (
                      <li key={`${story.lane}:${story.title}`}>
                        <StoryCard story={story} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </section>

        <section className="board-section" aria-labelledby="board-map-heading">
          <h2 id="board-map-heading">Feature map</h2>
          <p className="board-muted">
            The lines on the 3D map are the dependency waits the snapshot itself records: a story
            whose “waits on” names a PR is linked to the story that PR belongs to. Drag to look
            around, drag a block to move it, click a block to highlight its chain.{" "}
            <Link to="/board/issues">See issues and pull requests grouped by story →</Link>
          </p>
          <div className="board-toggle" role="group" aria-label="Feature map view">
            <button
              type="button"
              aria-pressed={mapView === "3d"}
              onClick={() => {
                setMapChosen(true);
                setMapView("3d");
              }}
            >
              3D view
            </button>
            <button
              type="button"
              aria-pressed={mapView === "list"}
              data-testid="list-view-toggle"
              onClick={() => {
                setMapChosen(true);
                setMapView("list");
              }}
            >
              List view
            </button>
          </div>
          {mapView === "3d" ? (
            <Suspense fallback={<p className="board-muted">Loading the 3D map…</p>}>
              <FeatureMap
                lanes={snapshot.lanes}
                stories={visibleStories}
                donePath={snapshot.donePath}
                onUnavailable={onMapUnavailable}
              />
            </Suspense>
          ) : (
            <div className="board-lanes" data-testid="board-list-view">
              {lanes.map(({ lane, stories: inLane }) => {
                const done = inLane.filter((s) => s.status === "done").length;
                const prog = inLane.filter((s) => s.status === "in-progress").length;
                return (
                  <article className="board-lane" key={lane.name} data-testid="board-lane">
                    <div>
                      <h3>{lane.name}</h3>
                      <p>
                        {lane.note} · {done} of {inLane.length} done
                      </p>
                    </div>
                    <div className="board-bar" aria-hidden="true">
                      <i className="b-done" style={{ width: `${inLane.length ? (done / inLane.length) * 100 : 0}%` }} />
                      <i className="b-prog" style={{ width: `${inLane.length ? (prog / inLane.length) * 100 : 0}%` }} />
                    </div>
                    <ul className="board-cards">
                      {inLane.map((story) => (
                        <li key={`${story.lane}:${story.title}`}>
                          <StoryCard story={story} />
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          )}
          {mapChosen ? null : (
            <p className="board-muted">
              The list view is shown automatically when 3D is unavailable or reduced motion is on.
            </p>
          )}
        </section>

        <section className="board-section" aria-labelledby="board-done-heading">
          <h2 id="board-done-heading">Definition of all done</h2>
          <p className="board-muted" style={{ maxWidth: "65ch" }}>
            All done means every subject is released, the ?scale=1 gate is gone so kids see it on
            prod, no feature PR is open, and no clip is missing. The gates below come in this order.
          </p>
          <ol className="board-path">
            {snapshot.donePath.map((item, i) =>
              item.type === "stage" ? (
                <li className="stage" key={`stage-${i}`}>
                  {item.label}
                </li>
              ) : (
                <li className={item.live ? "g-live" : ""} key={`gate-${i}`}>
                  <div className="gt">
                    {item.title}
                    {item.live ? (
                      <>
                        {" "}
                        <span className="board-pill board-pill-done">Live for kids</span>
                      </>
                    ) : null}
                  </div>
                  <div className="gd">{item.description}</div>
                </li>
              ),
            )}
          </ol>
        </section>

        <FeatureRequestForm />
      </div>
    </main>
  );
}
