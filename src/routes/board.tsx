import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import snapshotJson from "@/board/snapshot.json";
import {
  applyLiveData,
  blockedIndexes,
  caseNumber,
  dependencyRows,
  expeditionProgress,
  fetchLivePrs,
  filterStories,
  GAME_STATUS_LABEL,
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
import { StoryMapView } from "@/board/story-map-view";
import { DependencyGraph } from "@/board/dependency-graph";
import { FeatureRequestForm } from "@/board/feature-request-form";
import "@/board/board.css";

/**
 * /board — the Meridian story board, laid out as the Sprintbound board
 * system: a sidebar of views (Live board / Story map / Dependencies /
 * Releases / Send a tip) over ONE story list, a topbar carrying the
 * live-data state, and a status bar. Every view derives from the same
 * stories: the snapshot first, then the live GitHub PR overlay (public
 * API, no auth; see src/board/board-data.ts).
 *
 * Deliberately NOT part of the kids' game flow: nothing on Home, in any
 * menu, on the Why card, or on any game screen links here (the grown-ups
 * pages — credits, contact — link it as "What's coming"), and the route
 * is noindex. The board is read-only: statuses are computed from GitHub
 * pull requests, never edited here.
 *
 * ssr: false, like / and /contact: the page reads localStorage (the PR
 * cache) and window.matchMedia, so it is client-only.
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

type BoardView = "board" | "map" | "dependencies" | "releases" | "intake";

const NAV_ITEMS: { id: BoardView; label: string }[] = [
  { id: "board", label: "Live board" },
  { id: "map", label: "Story map" },
  { id: "dependencies", label: "Dependencies" },
  { id: "releases", label: "Releases" },
  { id: "intake", label: "Send a tip" },
];

const VIEW_LABEL: Record<BoardView, string> = {
  board: "Live board",
  map: "Story map",
  dependencies: "Dependencies",
  releases: "Releases",
  intake: "Send a tip",
};

/** Plain kicker under each status column heading. */
const COLUMN_KICKER: Record<StoryStatus, string> = {
  "not-started": "not yet opened",
  "in-progress": "work under way",
  done: "finished and merged",
};

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

function PageIntro({
  eyebrow,
  title,
  copy,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  children?: ReactNode;
}) {
  return (
    <div className="board-intro">
      <div className="board-intro-text">
        <p className="board-eyebrow">
          <span className="board-eyebrow-dot" aria-hidden="true" /> {eyebrow}
        </p>
        <h1>{title}</h1>
        <p className="board-intro-copy">{copy}</p>
      </div>
      {children ? <div className="board-intro-actions">{children}</div> : null}
    </div>
  );
}

function BoardPage() {
  const [stories, setStories] = useState<LiveStory[]>(() => applyLiveData(snapshot.stories, []));
  const [liveSource, setLiveSource] = useState<LiveSource>("snapshot");
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [view, setView] = useState<BoardView>("board");
  const [query, setQuery] = useState("");
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<LiveStory | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const handleSelect = useCallback((story: LiveStory, opener?: HTMLElement) => {
    if (opener) openerRef.current = opener;
    setSelectedKey(`${story.lane}:${story.title}`);
  }, []);
  /** Select a case and bring the Live board (and its inspector) to it. */
  const inspectFromView = useCallback(
    (story: LiveStory, opener?: HTMLElement) => {
      handleSelect(story, opener);
      setView("board");
    },
    [handleSelect],
  );
  const handleCloseInspector = useCallback(() => {
    setSelectedKey(null);
    openerRef.current?.focus();
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

  const metrics = useMemo(() => headerMetrics(stories), [stories]);
  const progress = useMemo(() => expeditionProgress(stories, snapshot.lanes), [stories]);
  const nextCrack = useMemo(() => nextToCrack(stories), [stories]);
  const blocked = useMemo(() => blockedIndexes(stories), [stories]);
  const counts: Record<StoryStatus, number> = {
    "not-started": metrics.notStarted,
    "in-progress": metrics.inProgress,
    done: metrics.done,
  };

  const visibleStories = useMemo(
    () => filterStories(stories, { query, blockedOnly }),
    [stories, query, blockedOnly],
  );
  const visibleBlocked = useMemo(() => {
    const visible = new Set(visibleStories.map((s) => s.id));
    const out = new Set<string>();
    stories.forEach((s, i) => {
      if (blocked.has(i) && visible.has(s.id)) out.add(s.id);
    });
    return out;
  }, [stories, blocked, visibleStories]);
  const filterActive = query.trim() !== "" || blockedOnly;
  const selectedStory = stories.find((s) => `${s.lane}:${s.title}` === selectedKey) ?? null;
  const columns = useMemo(() => groupByStatus(visibleStories), [visibleStories]);
  const depRows = useMemo(() => dependencyRows(stories), [stories]);
  const topBlocker = useMemo(
    () => depRows.reduce<(typeof depRows)[number] | null>(
      (best, row) => (best === null || row.blocks > best.blocks ? row : best),
      null,
    ),
    [depRows],
  );

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

  const renderCard = (story: LiveStory) => (
    <StoryCard
      story={story}
      caseNo={caseNumber(story, stories)}
      celebrated={celebration?.id === story.id}
      blocked={visibleBlocked.has(story.id)}
      onSelect={handleSelect}
    />
  );

  return (
    <main className="board-page board-page-shell" data-testid="board-page">
      <div className="board-shell">
        <aside className="board-sidebar">
          <div className="board-brand">
            <span className="board-brand-mark" aria-hidden="true">
              M
            </span>
            <span>
              <strong>MERIDIAN</strong>
              <small>live story board</small>
            </span>
          </div>
          <p className="board-side-label">Mission control</p>
          <nav className="board-nav" aria-label="Board views">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid={`board-nav-${item.id}`}
                className={view === item.id ? "board-nav-item is-active" : "board-nav-item"}
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => setView(item.id)}
              >
                {item.label}
                {item.id === "dependencies" && depRows.length > 0 ? (
                  <span className="board-nav-count">{depRows.length}</span>
                ) : null}
              </button>
            ))}
            <Link to="/board/issues" className="board-nav-item">
              Issues &amp; PRs
            </Link>
          </nav>
          <div className="board-side-card">
            <strong>Read-only by design</strong>
            <p>
              Statuses are computed from GitHub pull requests. Nothing here can be dragged or
              edited — the code is the source of truth.
            </p>
          </div>
          <p className="board-side-foot">
            {stories.length} cases · {snapshot.lanes.length} regions
          </p>
        </aside>

        <div className="board-main">
          <header className="board-topbar">
            <div className="board-crumbs">
              <span>Meridian</span>
              <span aria-hidden="true">/</span>
              <strong>{VIEW_LABEL[view]}</strong>
              <span className="board-live-pill">
                <span
                  className={liveSource === "snapshot" ? "board-live-dot is-idle" : "board-live-dot"}
                  aria-hidden="true"
                />
                <span data-testid="board-live-line">{liveLine}</span>
              </span>
            </div>
            <div className="board-topbar-actions">
              <Link to="/board/issues" className="board-topbar-link">
                Issues &amp; PRs
              </Link>
              <button type="button" className="board-topbar-button" onClick={() => setView("intake")}>
                Send a tip
              </button>
            </div>
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

          <div className="board-content">
            {view === "board" ? (
              <>
                <PageIntro
                  eyebrow={`Live board · ${liveSource === "snapshot" ? "snapshot data" : "live GitHub data"}`}
                  title="The Meridian story board."
                  copy="Every case, the region it belongs to, and the pull requests moving it — read from GitHub, never edited by hand."
                >
                  <span className="board-chip">
                    {metrics.openPrs} open leads{" "}
                    <span className="board-plain">(pull requests)</span>
                  </span>
                  <span className="board-chip">
                    {progress.closed} of {progress.total} cases closed
                  </span>
                </PageIntro>

                <div
                  className="board-tiles"
                  role="group"
                  aria-label="Header metrics: story counts by status and blocked stories, computed from the stories as shown"
                >
                  {(Object.keys(STATUS_LABEL) as StoryStatus[]).map((status) => (
                    <div className="board-tile" key={status}>
                      <b>{counts[status]}</b>
                      <span>{GAME_STATUS_LABEL[status]}</span>
                      <span className="board-plain">({STATUS_LABEL[status].toLowerCase()})</span>
                    </div>
                  ))}
                  <div className="board-tile">
                    <b>{metrics.blocked}</b>
                    <span>Blocked</span>
                    <span className="board-plain">(waiting on a case)</span>
                  </div>
                </div>

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

                <section className="board-stage" aria-labelledby="board-scrum-heading">
                  <h2 id="board-scrum-heading" className="board-stage-label">
                    Scrum board <span className="board-plain">· the work, left to right</span>
                  </h2>
                  <div className="board-scrum-layout">
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
                            <span className="board-plain">({STATUS_LABEL[status].toLowerCase()})</span>{" "}
                            ({columns[status].length})
                          </h3>
                          <p className="board-column-kicker">{COLUMN_KICKER[status]}</p>
                          {columns[status].length === 0 ? (
                            <p className="board-empty">Nothing here yet.</p>
                          ) : (
                            <ul className="board-cards">
                              {columns[status].map((story) => (
                                <li key={`${story.lane}:${story.title}`}>{renderCard(story)}</li>
                              ))}
                            </ul>
                          )}
                        </section>
                      ))}
                    </div>
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
                </section>
              </>
            ) : null}

            {view === "map" ? (
              <>
                <PageIntro
                  eyebrow="Story map · shape the slices"
                  title="See the work as regions, not a pile."
                  copy="Each region's cases are laid out in the order their dependencies allow. Pick a case to inspect it on the live board."
                />
                <StoryMapView stories={stories} lanes={snapshot.lanes} onSelect={inspectFromView} />
              </>
            ) : null}

            {view === "dependencies" ? (
              <>
                <PageIntro
                  eyebrow="Dependencies · watch the edges"
                  title="The work that can quietly stop the work."
                  copy="A case is blocked when a case it needs is not closed yet. Follow any link to the case on either end."
                >
                  <span className="board-chip">{depRows.length} links recorded</span>
                </PageIntro>
                <div className="board-dep-layout">
                  <DependencyGraph stories={stories} onSelect={inspectFromView} />
                  <section className="board-ledger" aria-labelledby="board-deps-heading">
                    <h2 id="board-deps-heading">
                      Dependency trails{" "}
                      <span className="board-plain">(which case waits on which)</span>
                    </h2>
                    {depRows.length === 0 ? (
                      <p className="board-muted">
                        No story dependencies are recorded in the snapshot.
                      </p>
                    ) : (
                      <ul className="board-deps">
                        {depRows.map((row) => (
                          <li className="board-dep-row" key={`${row.from.id}->${row.to.id}`}>
                            <button
                              type="button"
                              className="board-dep-button"
                              onClick={(e) => inspectFromView(row.from, e.currentTarget)}
                            >
                              {row.from.title}
                            </button>
                            <span> must land before </span>
                            <button
                              type="button"
                              className="board-dep-button"
                              onClick={(e) => inspectFromView(row.to, e.currentTarget)}
                            >
                              {row.to.title}
                            </button>
                            <span className="board-muted">
                              {" "}
                              ·{" "}
                              {row.viaPrs.length > 0
                                ? row.viaPrs.map((n) => `via PR ${n}`).join(", ")
                                : "no PR link"}{" "}
                              · blocks {row.blocks} {row.blocks === 1 ? "story" : "stories"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
                {nextCrack ? (
                  <div className="board-callout" data-testid="next-to-crack">
                    <div>
                      <p className="board-eyebrow">
                        <span className="board-eyebrow-dot" aria-hidden="true" /> Recommended move
                      </p>
                      <h2 className="board-callout-title">{nextCrack.story.title}</h2>
                      <p className="board-muted">
                        Next to crack: closing it unblocks {nextCrack.unblocks} other case
                        {nextCrack.unblocks === 1 ? "" : "s"} — the most of any open case.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="board-callout-button"
                      onClick={(e) => inspectFromView(nextCrack.story, e.currentTarget)}
                    >
                      Inspect this case
                    </button>
                  </div>
                ) : topBlocker ? (
                  <div className="board-callout">
                    <div>
                      <p className="board-eyebrow">
                        <span className="board-eyebrow-dot" aria-hidden="true" /> Recommended move
                      </p>
                      <h2 className="board-callout-title">{topBlocker.from.title}</h2>
                      <p className="board-muted">
                        No open case unblocks another directly; this case holds up the most
                        recorded links ({topBlocker.blocks}).
                      </p>
                    </div>
                    <button
                      type="button"
                      className="board-callout-button"
                      onClick={(e) => inspectFromView(topBlocker.from, e.currentTarget)}
                    >
                      Inspect this case
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}

            {view === "releases" ? (
              <>
                <PageIntro
                  eyebrow="Releases · the trail to release"
                  title="How the board earns “all done”."
                  copy="All done means every subject is released for kids, no feature work is still open, and no clip is missing. The checks below come in this order."
                />
                <div className="board-release-grid">
                  <section
                    className="board-score"
                    data-testid="xp-progress"
                    aria-label="Expedition progress"
                  >
                    <p className="board-xp-line">
                      Cases closed {progress.closed} / {progress.total}
                    </p>
                    <div className="board-bar" aria-hidden="true">
                      <i
                        className="b-done"
                        style={{
                          width: `${progress.total ? (progress.closed / progress.total) * 100 : 0}%`,
                        }}
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
                            <i
                              className="b-done"
                              style={{ width: `${total ? (closed / total) * 100 : 0}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section className="board-checklist" aria-labelledby="board-done-heading">
                    <h2 id="board-done-heading">
                      Trail to release{" "}
                      <span className="board-plain">(definition of all done)</span>
                    </h2>
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
                </div>
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
              </>
            ) : null}

            {view === "intake" ? (
              <>
                <PageIntro
                  eyebrow="Send a tip · public intake"
                  title="Tell the detectives what to build next."
                  copy="Tips travel to the team through the feature-request form. Nothing you send appears on this board, and the form never asks who you are."
                />
                <FeatureRequestForm />
                <div className="board-principles">
                  <div>
                    <strong>Read-only board</strong>
                    <span>A tip never changes a status — only merged code does.</span>
                  </div>
                  <div>
                    <strong>No names, no emails</strong>
                    <span>The form asks only for the idea, an age group, and a subject.</span>
                  </div>
                  <div>
                    <strong>Checked by a human</strong>
                    <span>Tips are read by the team before anything becomes a case.</span>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <footer className="board-statusbar">
            <span>
              Snapshot read {snapshot.asOf} · main{" "}
              <span className="board-mono">{snapshot.main}</span>
            </span>
            <span>Read-only · statuses come from GitHub</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
