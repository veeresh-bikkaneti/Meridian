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

/**
 * The life pill (board cleanup, owner ruling 2026-11-16): how much of
 * a feature is delivered, as a pill that fills to the percentage —
 * finished stories ÷ all stories in the feature, the board's own
 * rollup, with the % printed beside it. It replaces the "X of Y
 * stories done" text on the feature card; the full sentence stays
 * available as the accessible name. Calm mode and reduced motion
 * rest the pill filled, never mid-grow.
 */
export function LifePill({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <p
      className="v3-life"
      role="img"
      aria-label={`${pct}% delivered — ${done} of ${total} stories done`}
    >
      <span className="v3-life-track" aria-hidden="true">
        <span
          className="v3-life-fill"
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </span>
      <span className="v3-life-pct" aria-hidden="true">
        {pct}%
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* The opened feature's four groups (board cleanup, owner ruling      */
/* 2026-11-16): Completed / In progress / Blocked / Not started.      */
/* A story is Blocked when it waits on an unfinished story — the      */
/* same recorded waits the map draws as bonds; a done story is        */
/* Completed even if a bond leaves it. A blocked story appears ONLY   */
/* in Blocked, and its line there names what it waits for.            */
/* ------------------------------------------------------------------ */

type StoryGroupId = "completed" | "in-progress" | "blocked" | "not-started";

const GROUP_ORDER: StoryGroupId[] = ["completed", "in-progress", "blocked", "not-started"];

const GROUP_HEADING: Record<StoryGroupId, string> = {
  completed: "Completed",
  "in-progress": "In progress",
  blocked: "Blocked",
  "not-started": "Not started",
};

const GROUP_EMPTY: Record<StoryGroupId, string> = {
  completed: "Nothing finished yet",
  "in-progress": "Nothing being built right now",
  blocked: "Nothing waiting right now",
  "not-started": "Everything here has begun",
};

function storyGroup(board: PublishedBoard, story: PublishedStory): StoryGroupId {
  if (story.status === "done") return "completed";
  const waiting = board.bonds.some(
    (b) =>
      b.fromSlug === story.slug &&
      findStory(board, b.toSlug)?.story.status !== "done",
  );
  if (waiting) return "blocked";
  return story.status === "in-progress" ? "in-progress" : "not-started";
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
                      <LifePill done={feature.done} total={feature.total} />
                      <p className="v3-next">
                        {finished ? (
                          <a href={import.meta.env.BASE_URL}>✓ Ready to play — tap to try it</a>
                        ) : next ? (
                          <>Next: {next.title}</>
                        ) : null}
                      </p>
                    </div>
                  </article>
                  <div className="v3-groups">
                    {GROUP_ORDER.map((groupId) => {
                      const stories = feature.stories.filter(
                        (s) => storyGroup(board, s) === groupId,
                      );
                      return (
                        <section
                          key={groupId}
                          className="v3-group"
                          data-testid="v3-story-group"
                          data-group={groupId}
                          aria-label={`${feature.name} — ${GROUP_HEADING[groupId]}`}
                        >
                          <h4 className="v3-group-head">
                            {GROUP_HEADING[groupId]}
                            <span className="v3-group-count">{stories.length}</span>
                          </h4>
                          {stories.length === 0 ? (
                            <p className="v3-group-empty">{GROUP_EMPTY[groupId]}</p>
                          ) : (
                            <ol className="v3-stops">
                              {stories.map((story) => {
                                const open = selectedSlug === story.slug;
                                const blocked = groupId === "blocked";
                                return (
                                  <li
                                    key={story.slug}
                                    className={`v3-stop v3-stop-${story.status}${open ? " v3-open" : ""}${
                                      frontier === story.slug ? " v3-frontier" : ""
                                    }${blocked ? " v3-blocked" : ""}`}
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
                                      <StatusPill status={story.status} />
                                      <span className="v3-s-line">
                                        {blocked && story.comingAfter
                                          ? `Waiting for: ${story.comingAfter}`
                                          : story.line}
                                      </span>
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
                          )}
                        </section>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
