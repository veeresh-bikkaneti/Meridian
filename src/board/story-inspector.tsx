import { useEffect, useRef } from "react";
import {
  buildDependencyEdges,
  caseNumber,
  dependencyDepths,
  donePathMatch,
  GAME_STATUS_LABEL,
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
  const caseNo = caseNumber(story, stories);

  return (
    <aside className="board-inspector" aria-label="Case dossier">
      <div className="board-inspector-eyebrow">
        <span>Case file · {story.lane}</span>
        {caseNo > 0 ? <span className="board-case-no">Case {caseNo}</span> : null}
      </div>
      <div className="board-inspector-top">
        <h3 ref={headingRef} tabIndex={-1}>
          {story.title}
        </h3>
        <button type="button" aria-label="Close story inspector" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="board-inspector-row">
        <span className={`board-pill board-pill-${story.status}`}>
          {GAME_STATUS_LABEL[story.status]}{" "}
          <span className="board-plain">({STATUS_LABEL[story.status].toLowerCase()})</span>
        </span>
        {story.status === "done" ? (
          <span className="board-case-stamp" aria-hidden="true">
            Case closed
          </span>
        ) : null}
      </p>
      <p>
        <strong>Why this status:</strong> {statusWhy(story)}
      </p>
      <div>
        <h4>Leads</h4>
        {story.prs.length === 0 ? (
          <p className="board-muted">No linked PRs.</p>
        ) : (
          <ul className="board-prs">
            {story.prs.map((n) => {
              const state = story.prStates[n];
              return (
                <li key={n}>
                  <span>{state === "merged" ? "Lead solved" : "Lead"}</span>{" "}
                  <a href={`${PR_URL_BASE}${n}`} target="_blank" rel="noopener noreferrer">
                    PR {n}
                  </a>
                  {state ? (
                    <span className="board-pr-title">
                      {state === "closed" ? "closed without merging" : state}
                      {story.prTitles[n] ? <> — {story.prTitles[n]}</> : null}
                    </span>
                  ) : (
                    <span className="board-pr-title">state not loaded</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div>
        <h4>Clues needed</h4>
        <p>
          <strong>Waits on:</strong> {story.waitsOn}
        </p>
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
        <h4>Cases this unlocks</h4>
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
      {donePathLabel ? (
        <p>
          <strong>Trail to release:</strong> {donePathLabel}
        </p>
      ) : null}
      <p>
        <strong>Owner:</strong> {story.owner ?? "Unassigned"}
      </p>
      <p>
        <strong>Clue chain depth:</strong> {depth}
      </p>
    </aside>
  );
}
