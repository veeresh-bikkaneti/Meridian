/**
 * Board v3 — the trail (Phase 2) and the shared story card.
 *
 * Epics → Features → Stories as one winding journey. Every story
 * shows its plain title, its status (icon + word, never colour
 * alone) and exactly ONE line. Nothing else exists in this UI: no
 * tasks, no counts of tasks, no code, no PR anything (§4 law).
 * The same StoryCardPanel opens from the trail and from the
 * molecular map — one selection, one card (§3).
 */
import { STATUS_WORD, findStory, type PublishedBoard, type PublishedStory } from "./board-data.ts";
import { AnimWindow, StoryBanner } from "./card-animations.tsx";

export function StatusPill({ status }: { status: PublishedStory["status"] }) {
  return (
    <span className={`v3-pill v3-pill-${status}`}>
      <span className="v3-pill-dot" aria-hidden="true" />
      {STATUS_WORD[status]}
    </span>
  );
}

/** The story this story waits on, when that wait is a drawn bond. */
function bondTarget(board: PublishedBoard, slug: string) {
  return board.bonds.find((b) => b.fromSlug === slug) ?? null;
}

export function StoryCardPanel({
  board,
  slug,
  onSelect,
  onShowInMap,
  onClose,
}: {
  board: PublishedBoard;
  slug: string;
  onSelect: (slug: string) => void;
  onShowInMap?: (slug: string) => void;
  onClose?: () => void;
}) {
  const found = findStory(board, slug);
  if (!found) return null;
  const { story, featureName, epicName } = found;
  const bond = bondTarget(board, slug);
  const target = bond ? findStory(board, bond.toSlug) : null;
  const waiting = bond && target && target.story.status !== "done";
  return (
    <article className="v3-story-card" data-testid="story-card-open" aria-label={story.title}>
      <StoryBanner />
      <p className="v3-sc-where">
        {epicName} › {featureName}
      </p>
      <h4>{story.title}</h4>
      <p className="v3-sc-status">
        <StatusPill status={story.status} />
      </p>
      <p className="v3-sc-line">{story.line}</p>
      {waiting ? (
        <div className="v3-sc-waiting">
          <p>
            <strong>Waiting for:</strong> {target.story.title} to finish first.
          </p>
          <button type="button" className="v3-btn" onClick={() => onSelect(bond.toSlug)}>
            Show me that stop
          </button>
        </div>
      ) : null}
      <div className="v3-sc-actions">
        {onShowInMap ? (
          <button type="button" className="v3-btn" onClick={() => onShowInMap(slug)}>
            Show me in the structure
          </button>
        ) : null}
        {onClose ? (
          <button type="button" className="v3-btn" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function TrailView({
  board,
  selectedSlug,
  frontier,
  onSelect,
  onShowInMap,
}: {
  board: PublishedBoard;
  selectedSlug: string | null;
  frontier: string | null;
  onSelect: (slug: string | null) => void;
  onShowInMap: (slug: string) => void;
}) {
  return (
    <div className="v3-trail">
      {board.epics.map((epic) => {
        const epicStories = epic.features.flatMap((f) => f.stories);
        const epicDone = epicStories.filter((s) => s.status === "done").length;
        return (
          <section key={epic.id} className="v3-epic" aria-label={epic.name}>
            <div className="v3-epic-head">
              <h2>{epic.name}</h2>
              <span className="v3-epic-count">
                {epicDone} of {epicStories.length} stories finished
              </span>
              <span className="v3-epic-rule" aria-hidden="true" />
            </div>
            {epic.features.map((feature) => {
              const finished = feature.total > 0 && feature.done === feature.total;
              const next = feature.stories.find((s) => s.status !== "done");
              return (
                <div key={feature.id} className="v3-feature">
                  <article className={`v3-feature-card${finished ? " v3-finished" : ""}`}>
                    <AnimWindow kind={feature.anim} />
                    <div className="v3-feature-meta">
                      <h3>
                        {feature.name}
                        {finished ? (
                          <span className="v3-gold-flag" aria-label="Feature finished">
                            {" "}
                            ⚑
                          </span>
                        ) : null}
                      </h3>
                      <p className="v3-promise">{feature.promise}</p>
                      <p className="v3-progress">
                        <strong>
                          {feature.done} of {feature.total} stories done
                        </strong>
                      </p>
                      <p className="v3-next">
                        {finished ? (
                          <a href={import.meta.env.BASE_URL}>✓ Ready to play — tap to try it</a>
                        ) : next ? (
                          <>Next: {next.title}</>
                        ) : null}
                      </p>
                    </div>
                  </article>
                  <ol className="v3-stops">
                    {feature.stories.map((story) => {
                      const open = selectedSlug === story.slug;
                      const bond = bondTarget(board, story.slug);
                      const targetDone = bond
                        ? findStory(board, bond.toSlug)?.story.status === "done"
                        : true;
                      const blocked = bond !== null && !targetDone;
                      return (
                        <li
                          key={story.slug}
                          className={`v3-stop v3-stop-${story.status}${open ? " v3-open" : ""}${
                            frontier === story.slug ? " v3-frontier" : ""
                          }`}
                          id={`v3-stop-${story.slug}`}
                        >
                          <span className="v3-dot" aria-hidden="true" />
                          <button
                            type="button"
                            className="v3-stop-btn"
                            data-testid="v3-story-stop"
                            data-slug={story.slug}
                            data-status={story.status}
                            aria-expanded={open}
                            onClick={() => onSelect(open ? null : story.slug)}
                          >
                            <span className="v3-s-title">{story.title}</span>
                            {blocked ? (
                              <span className="v3-barrier" aria-label="Waiting for another story">
                                ⛔
                              </span>
                            ) : null}
                            <StatusPill status={story.status} />
                            <span className="v3-s-line">{story.line}</span>
                          </button>
                          {open ? (
                            <StoryCardPanel
                              board={board}
                              slug={story.slug}
                              onSelect={(s) => onSelect(s)}
                              onShowInMap={onShowInMap}
                              onClose={() => onSelect(null)}
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
