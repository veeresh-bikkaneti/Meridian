import { useEffect, useRef } from "react";
import {
  buildDependencyEdges,
  dependencyDepths,
  donePathMatch,
  PR_URL_BASE,
  STATUS_LABEL,
  statusWhy,
  type DonePathItem,
  type LiveStory,
} from "./board-data";

/**
 * Read-only inspector for one selected story. Every dynamic string —
 * snapshot fields and live PR titles in particular — is rendered as a
 * React text child only (React escapes text children); no raw-HTML
 * injection anywhere. There are no status-changing controls.
 */
export function StoryInspector({
  story,
  stories,
  donePath,
  onClose,
  onSelect,
}: {
  story: LiveStory;
  stories: readonly LiveStory[];
  donePath: readonly DonePathItem[];
  onClose: () => void;
  onSelect: (story: LiveStory) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [story]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const index = stories.findIndex((s) => s.lane === story.lane && s.title === story.title);
  const edges = buildDependencyEdges(stories);
  const prerequisites = edges.filter((e) => e.to === index).map((e) => stories[e.from]);
  const waiting = edges.filter((e) => e.from === index).map((e) => stories[e.to]);
  const depth = index >= 0 ? (dependencyDepths(stories, edges)[index] ?? 0) : 0;
  const donePathLabel = donePathMatch(story, donePath);

  return (
    <aside className="board-inspector" aria-label="Story inspector">
      <div className="board-inspector-top">
        <h3 ref={headingRef} tabIndex={-1}>
          {story.title}
        </h3>
        <button type="button" aria-label="Close story inspector" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="board-inspector-row">
        <span className={`board-pill board-pill-${story.status}`}>{STATUS_LABEL[story.status]}</span>
        <span>{story.lane}</span>
      </p>
      <p>
        <strong>Why this status:</strong> {statusWhy(story)}
      </p>
      <p>
        <strong>Owner:</strong> {story.owner ?? "Unassigned"}
      </p>
      <p>
        <strong>Waits on:</strong> {story.waitsOn}
      </p>
      <div>
        <h4>Prerequisite stories</h4>
        {prerequisites.length === 0 ? (
          <p className="board-muted">No prerequisite stories in the snapshot.</p>
        ) : (
          <ul className="board-inspector-links">
            {prerequisites.map((s) => (
              <li key={`${s.lane}:${s.title}`}>
                <button type="button" onClick={() => onSelect(s)}>
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4>What waits on this story</h4>
        {waiting.length === 0 ? (
          <p className="board-muted">No story waits on this one.</p>
        ) : (
          <ul className="board-inspector-links">
            {waiting.map((s) => (
              <li key={`${s.lane}:${s.title}`}>
                <button type="button" onClick={() => onSelect(s)}>
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4>Linked PRs</h4>
        {story.prs.length === 0 ? (
          <p className="board-muted">No linked PRs.</p>
        ) : (
          <ul className="board-prs">
            {story.prs.map((n) => (
              <li key={n}>
                <a href={`${PR_URL_BASE}${n}`} target="_blank" rel="noopener noreferrer">
                  PR {n}
                </a>
                {story.prStates[n] ? (
                  <span className="board-pr-title">
                    {story.prStates[n]}
                    {story.prTitles[n] ? <> — {story.prTitles[n]}</> : null}
                  </span>
                ) : (
                  <span className="board-pr-title">state not loaded</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p>
        <strong>Dependency chain depth:</strong> {depth}
      </p>
      {donePathLabel ? (
        <p>
          <strong>Done path:</strong> {donePathLabel}
        </p>
      ) : null}
    </aside>
  );
}
