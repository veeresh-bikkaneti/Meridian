import { GAME_STATUS_LABEL, PR_URL_BASE, STATUS_LABEL, type LiveStory } from "./board-data";

/**
 * One story card. Every dynamic string — the snapshot title and, in
 * particular, live PR titles fetched from GitHub — is rendered as a
 * React text child only. React escapes text children, so a PR title
 * containing markup renders as plain text, never as HTML. No raw-HTML
 * injection API is used anywhere on this page.
 */
export function StoryCard({
  story,
  onSelect,
}: {
  story: LiveStory;
  onSelect?: (story: LiveStory, opener: HTMLElement) => void;
}) {
  return (
    <article className="board-card" data-testid="story-card" data-status={story.status}>
      <div className="board-card-top">
        <h4 className="board-card-title">
          <button
            type="button"
            className="board-card-title-button"
            onClick={(e) => onSelect?.(story, e.currentTarget)}
          >
            {story.title}
          </button>
        </h4>
        <span className={`board-pill board-pill-${story.status}`}>
          {GAME_STATUS_LABEL[story.status]}{" "}
          <span className="board-plain">({STATUS_LABEL[story.status].toLowerCase()})</span>
        </span>
      </div>
      <p className="board-card-lane">{story.lane}</p>
      <p className="board-card-wait">
        {story.status === "done" ? (
          story.waitsOn
        ) : (
          <>
            <strong>Needs a clue from:</strong> {story.waitsOn}
          </>
        )}
      </p>
      <div className="board-card-meta">
        {story.owner && story.status !== "done" ? (
          <span>
            Owner: <strong>{story.owner}</strong>
          </span>
        ) : null}
        {story.inferred ? <span className="board-inferred">inferred</span> : null}
      </div>
      {story.prs.length > 0 ? (
        <ul className="board-prs">
          {story.prs.map((n) => (
            <li key={n}>
              <a href={`${PR_URL_BASE}${n}`} target="_blank" rel="noopener noreferrer">
                PR {n}
              </a>
              {story.prTitles[n] ? <span className="board-pr-title">{story.prTitles[n]}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
