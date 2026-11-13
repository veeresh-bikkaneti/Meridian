import {
  GAME_STATUS_LABEL,
  leadCounts,
  PR_URL_BASE,
  STATUS_LABEL,
  type LiveStory,
} from "./board-data";

/**
 * One story card, styled as a case file. Every dynamic string — the
 * snapshot title and, in particular, live PR titles fetched from
 * GitHub — is rendered as a React text child only. React escapes text
 * children, so a PR title containing markup renders as plain text,
 * never as HTML. No raw-HTML injection API is used anywhere on this
 * page.
 */
export function StoryCard({
  story,
  caseNo,
  celebrated,
  onSelect,
}: {
  story: LiveStory;
  /** 1-based position within the story's lane (see caseNumber in board-data). */
  caseNo?: number;
  /** True only for the one case celebrated on this visit (step 12). */
  celebrated?: boolean;
  onSelect?: (story: LiveStory, opener: HTMLElement) => void;
}) {
  const leads = leadCounts(story);
  return (
    <article
      className={celebrated ? "board-card board-card-celebrated" : "board-card"}
      data-testid="story-card"
      data-status={story.status}
      {...(celebrated ? { "data-celebrated": "true" } : {})}
    >
      <div className="board-card-top">
        {caseNo != null ? <span className="board-case-no">Case {caseNo}</span> : null}
        <span className="board-region-badge">{story.lane}</span>
        {story.status === "done" ? (
          <>
            <span className="board-case-stamp" aria-hidden="true">
              Case closed
            </span>
            <span className="sr-only">Case closed (done)</span>
          </>
        ) : (
          <span className={`board-pill board-pill-${story.status} board-card-status`}>
            {GAME_STATUS_LABEL[story.status]}{" "}
            <span className="board-plain">({STATUS_LABEL[story.status].toLowerCase()})</span>
          </span>
        )}
      </div>
      <h4 className="board-card-title">
        <button
          type="button"
          className="board-card-title-button"
          onClick={(e) => onSelect?.(story, e.currentTarget)}
        >
          {story.title}
        </button>
      </h4>
      <p className="board-card-wait">
        {story.status === "done" ? (
          story.waitsOn
        ) : (
          <>
            <strong>Needs a clue from:</strong> {story.waitsOn}
          </>
        )}
      </p>
      {leads.total > 0 ? (
        <p className="board-card-leads" title="Leads are pull requests; solved means merged">
          {leads.total} lead{leads.total === 1 ? "" : "s"}, {leads.solved} solved
        </p>
      ) : null}
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
