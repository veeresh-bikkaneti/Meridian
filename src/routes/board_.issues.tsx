import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import snapshotJson from "@/board/snapshot.json";
import {
  explicitIssueNumbers,
  fetchLiveIssues,
  fetchLivePrs,
  mapWorkToStories,
  type SnapshotData,
  type StoryWorkItem,
} from "@/board/board-data";
import "@/board/board.css";

/**
 * /board/issues — GitHub issues and PRs for Meridian, grouped by the
 * story they belong to.
 *
 * Same protection as /board: noindex, and nothing on Home, in any menu,
 * or on any game screen links here; the only way in is the link on
 * /board itself. The mapping is the board snapshot's own, never a
 * guess: a PR belongs to a story only when the story's `prs` list names
 * it; an issue belongs only when a story explicitly names it
 * ("Open issues 344 and 319…"). Everything else is shown under
 * "Unmapped" rather than forced onto a story.
 *
 * ssr: false, like /board: the page reads the localStorage caches.
 */
export const Route = createFileRoute("/board_/issues")({
  head: () => ({
    meta: [
      { title: "Meridian issues + PRs by story" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "GitHub issues and pull requests for Meridian, grouped by story, for the project owner.",
      },
    ],
  }),
  ssr: false,
  component: BoardIssuesPage,
});

const snapshot = snapshotJson as unknown as SnapshotData;

function WorkItemRow({ item }: { item: StoryWorkItem }) {
  const stateLabel =
    item.kind === "pr" && item.merged ? "Merged" : item.state === "open" ? "Open" : "Closed";
  return (
    <li className="board-card" data-testid="work-item">
      <div className="board-card-top">
        <span className="board-pill">{item.kind === "pr" ? "Pull request" : "Issue"}</span>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="board-mono">
          #{item.number}
        </a>
        <span className="board-card-title">{item.title || "(no title)"}</span>
        <span className={`board-pill${item.kind === "pr" && item.merged ? " board-pill-done" : ""}`}>
          {stateLabel}
        </span>
      </div>
    </li>
  );
}

function BoardIssuesPage() {
  const [prs, setPrs] = useState<Awaited<ReturnType<typeof fetchLivePrs>> | null>(null);
  const [issues, setIssues] = useState<Awaited<ReturnType<typeof fetchLiveIssues>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchLivePrs({ wanted: snapshot.stories.flatMap((s) => s.prs) }),
      fetchLiveIssues({ wanted: snapshot.stories.flatMap((s) => explicitIssueNumbers(s)) }),
    ]).then(([p, i]) => {
      if (cancelled) return;
      setPrs(p);
      setIssues(i);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const mapped = useMemo(() => {
    if (!prs || !issues) return null;
    return mapWorkToStories(snapshot.stories, prs.prs, issues.issues);
  }, [prs, issues]);

  const liveNote =
    prs && issues
      ? prs.source === "snapshot" && issues.source === "snapshot"
        ? "GitHub could not be reached and nothing is cached, so no live items can be listed right now."
        : "Showing live GitHub data (public API, no sign-in; cached for 10 minutes)."
      : "Loading live GitHub data…";

  return (
    <main className="board-page" data-testid="issues-page">
      <div className="board-wrap">
        <header className="board-section">
          <p className="board-asof">
            <Link to="/board">← Back to the story board</Link>
          </p>
          <h1>Issues and pull requests, by story</h1>
          <p className="board-asof">
            {snapshot.asOf}. {liveNote}
          </p>
          <p className="board-muted">
            A pull request sits under a story only when the board snapshot names that PR for the
            story. An issue sits under a story only when a story explicitly names it — today that
            is only “Open issues 344 and 319”. Everything else is listed as Unmapped; nothing is
            matched by guessing at titles.
          </p>
        </header>

        {mapped === null ? (
          <p className="board-muted">Loading…</p>
        ) : (
          <>
            {mapped.groups.map((group) => (
              <section
                className="board-section"
                key={`${group.story.lane}:${group.story.title}`}
                data-testid="work-group"
                data-story={group.story.title}
              >
                <h2>{group.story.title}</h2>
                <p className="board-card-lane">{group.story.lane}</p>
                <ul className="board-cards">
                  {group.items.map((item) => (
                    <WorkItemRow key={`${item.kind}:${item.number}`} item={item} />
                  ))}
                </ul>
              </section>
            ))}

            <section className="board-section" data-testid="unmapped-group">
              <h2>Unmapped</h2>
              <p className="board-card-lane">No story in the snapshot names these</p>
              {mapped.unmapped.length === 0 ? (
                <p className="board-muted">Nothing unmapped right now.</p>
              ) : (
                <ul className="board-cards">
                  {mapped.unmapped.map((item) => (
                    <WorkItemRow key={`${item.kind}:${item.number}`} item={item} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
