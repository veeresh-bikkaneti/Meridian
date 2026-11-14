import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import snapshotJson from "@/board/snapshot.json";
import {
  applyLiveData,
  caseNumber,
  dependencyRows,
  expeditionProgress,
  fetchLivePrs,
  filterStories,
  GAME_STATUS_LABEL,
  groupByLane,
  groupByStatus,
  headerMetrics,
  nextToCrack,
  newlyClosedIds,
  readSeenClosed,
  STATUS_LABEL,
  writeSeenClosed,
  type LiveSource,
  type LiveStory,
  type SnapshotData,
  type StoryStatus,
} from "@/board/board-data";
import { StoryCard } from "@/board/story-card";
import { StoryInspector } from "@/board/story-inspector";
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<LiveStory | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const handleSelect = useCallback((story: LiveStory, opener?: HTMLElement) => {
    if (opener) openerRef.current = opener;
    setSelectedKey(`${story.lane}:${story.title}`);
  }, []);
  const handleCloseInspector = useCallback(() => {
    setSelectedKey(null);
    openerRef.current?.focus();
  }, []);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    const hasGl = webglAvailable();
    setMapView(reduced || !hasGl ? "list" : "3d");
  }, []);

  useEffect(() => {
    let active = true;
    // Wanted = every PR the snapshot stories link to. The overlay pages
    // through the pulls list until all of them are covered — a single
    // page no longer contains any of them (see board-data.ts).
    fetchLivePrs({ wanted: snapshot.stories.flatMap((s) => s.prs) })
      .then((result) => {
        if (!active) return;
        setLiveSource(result.source);
        setFetchedAt(result.fetchedAt);
        if (result.prs.length > 0) {
          const nextStories = applyLiveData(snapshot.stories, result.prs);
          // Celebration (step 12): only on a real live load. Read the
          // baseline, celebrate at most the first newly closed case,
          // and always refresh the baseline to the current closed ids
          // (a null baseline is a first visit — set it silently).
          const baseline = readSeenClosed();
          const newly = newlyClosedIds(baseline, nextStories);
          writeSeenClosed(
            nextStories.filter((s) => s.status === "done").map((s) => s.id),
          );
          if (baseline !== null && newly && newly.length > 0) {
            const first = nextStories.find((s) => s.id === newly[0]);
            if (first) setCelebration(first);
          }
          setStories(nextStories);
        }
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
  const progress = useMemo(() => expeditionProgress(stories, snapshot.lanes), [stories]);
  const nextCrack = useMemo(() => nextToCrack(stories), [stories]);
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
  const selectedStory = stories.find((s) => `${s.lane}:${s.title}` === selectedKey) ?? null;
  const columns = useMemo(() => groupByStatus(visibleStories), [visibleStories]);
  const lanes = useMemo(() => groupByLane(visibleStories, snapshot.lanes), [visibleStories]);
  const depRows = useMemo(() => dependencyRows(stories), [stories]);

  // Coverage: how many of the PRs the stories link to actually carry a
  // live state. The live line must never read as complete when it is
  // not (e.g. the pagination cap was hit before every linked PR was
  // reached).
  const linkedPrCount = useMemo(
    () => new Set(snapshot.stories.flatMap((s) => s.prs)).size,
    [],
  );
  const coveredPrCount = useMemo(() => {
    const seen = new Set<number>();
    for (const s of stories) {
      for (const n of s.prs) if (n in s.prStates) seen.add(n);
    }
    return seen.size;
  }, [stories]);
  const coverageLine =
    liveSource !== "snapshot"
      ? ` · ${coveredPrCount} of ${linkedPrCount} linked PRs have live state`
      : "";
  const liveLine =
    liveSource === "live" && fetchedAt
      ? `Live from GitHub · updated ${formatTime(fetchedAt)}${coverageLine}`
      : fetchedAt
        ? `Showing saved data from ${formatTime(fetchedAt)}${coverageLine}`
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
                <span>{GAME_STATUS_LABEL[status]}</span>
                <span className="board-plain">({STATUS_LABEL[status].toLowerCase()})</span>
              </div>
            ))}
            <div className="board-tile">
              <b>{metrics.openPrs}</b>
              <span>Leads</span>
              <span className="board-plain">(open PRs)</span>
            </div>
            <div className="board-tile">
              <b>{metrics.blocked}</b>
              <span>Blocked</span>
            </div>
          </div>
          <section className="board-xp" data-testid="xp-progress" aria-label="Expedition progress">
            <p className="board-xp-line">
              Cases closed {progress.closed} / {progress.total}
            </p>
            <div className="board-bar" aria-hidden="true">
              <i
                className="b-done"
                style={{ width: `${progress.total ? (progress.closed / progress.total) * 100 : 0}%` }}
              />
            </div>
            <ul className="board-xp-lanes">
              {progress.perLane.map(({ lane, closed, total }) => (
                <li className="board-xp-lane" key={lane.name}>
                  <span className="board-xp-lane-name">{lane.name}</span>
                  <span className="board-xp-lane-count">
                    {closed}/{total}
                  </span>
                  <div className="board-bar" aria-hidden="true">
                    <i className="b-done" style={{ width: `${total ? (closed / total) * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            {nextCrack ? (
              <button
                type="button"
                className="board-xp-next"
                data-testid="next-to-crack"
                onClick={(e) => handleSelect(nextCrack.story, e.currentTarget)}
              >
                Next to crack: {nextCrack.story.title} — closing it unblocks {nextCrack.unblocks} other
                case{nextCrack.unblocks === 1 ? "" : "s"}
              </button>
            ) : null}
          </section>
        </header>

        {celebration ? (
          <div className="board-toast" role="status" data-testid="board-celebration">
            <p className="board-toast-text">
              Case closed: {celebration.title}{" "}
              <span className="board-plain">(a case was finished since your last visit)</span>
            </p>
            <button type="button" className="board-toast-close" onClick={() => setCelebration(null)}>
              Close
            </button>
          </div>
        ) : null}

        <section className="board-section" aria-labelledby="board-next-heading">
          <h2 id="board-next-heading">Coming next</h2>
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

        <div className="board-scrum-layout">
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
                  {GAME_STATUS_LABEL[status]}{" "}
                  <span className="board-plain">({STATUS_LABEL[status].toLowerCase()})</span> (
                  {columns[status].length})
                </h3>
                {columns[status].length === 0 ? (
                  <p className="board-empty">Nothing here yet.</p>
                ) : (
                  <ul className="board-cards">
                    {columns[status].map((story) => (
                      <li key={`${story.lane}:${story.title}`}>
                        <StoryCard
                          story={story}
                          caseNo={caseNumber(story, stories)}
                          celebrated={celebration?.id === story.id}
                          onSelect={handleSelect}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </section>
        {selectedStory ? (
          <StoryInspector
            story={selectedStory}
            stories={stories}
            donePath={snapshot.donePath}
            onClose={handleCloseInspector}
            onSelect={(s) => handleSelect(s)}
          />
        ) : null}
        </div>

        <section className="board-section" aria-labelledby="board-map-heading">
          <h2 id="board-map-heading">Feature map</h2>
          <p className="board-muted">
            The lines on the 3D map are the dependency waits the snapshot itself records: a case
            whose “waits on” names a PR is linked to the case that PR belongs to. Drag to look
            around, drag a block to move it, click a case block to highlight its chain.{" "}
            <Link to="/board/issues">See issues and pull requests grouped by case →</Link>
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
                onSelect={(story) => handleSelect(story)}
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
                          <StoryCard
                            story={story}
                            caseNo={caseNumber(story, stories)}
                            celebrated={celebration?.id === story.id}
                            onSelect={handleSelect}
                          />
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

        <section className="board-section" aria-labelledby="board-deps-heading">
          <h2 id="board-deps-heading">Dependency trails</h2>
          <p className="board-muted">(which case waits on which)</p>
          {depRows.length === 0 ? (
            <p className="board-muted">No story dependencies are recorded in the snapshot.</p>
          ) : (
            <ul className="board-deps">
              {depRows.map((row) => (
                <li className="board-dep-row" key={`${row.from.id}->${row.to.id}`}>
                  <button
                    type="button"
                    className="board-dep-button"
                    onClick={(e) => handleSelect(row.from, e.currentTarget)}
                  >
                    {row.from.title}
                  </button>
                  <span> must land before </span>
                  <button
                    type="button"
                    className="board-dep-button"
                    onClick={(e) => handleSelect(row.to, e.currentTarget)}
                  >
                    {row.to.title}
                  </button>
                  <span className="board-muted">
                    {" "}
                    · {row.viaPrs.length > 0 ? row.viaPrs.map((n) => `via PR ${n}`).join(", ") : "no PR link"} ·
                    blocks {row.blocks} {row.blocks === 1 ? "story" : "stories"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="board-section" aria-labelledby="board-done-heading">
          <h2 id="board-done-heading">
            Trail to release <span className="board-plain">(definition of all done)</span>
          </h2>
          <p className="board-muted" style={{ maxWidth: "65ch" }}>
            All done means every subject is released for kids, no feature work is still open, and
            no clip is missing. The steps below come in this order.
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
