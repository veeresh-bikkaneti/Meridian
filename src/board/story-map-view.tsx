import {
  caseNumber,
  GAME_STATUS_LABEL,
  storyMapLayouts,
  type LiveStory,
  type SnapshotLane,
} from "./board-data";

/**
 * Story map view — the Sprintbound feature-row map in Meridian terms:
 * one row per region, the region card carries the rollup, and the
 * slices are the region's cases ordered by dependency depth
 * (storyMapLayouts) so a chain reads in order. Clicking a slice opens
 * the case in the Live board's inspector (the parent switches view).
 * Every number is computed from the stories as shown (live overlay
 * applied); nothing is stored or hardcoded.
 */
export function StoryMapView({
  stories,
  lanes,
  onSelect,
}: {
  stories: readonly LiveStory[];
  lanes: readonly SnapshotLane[];
  onSelect: (story: LiveStory, opener: HTMLElement) => void;
}) {
  const layouts = storyMapLayouts(stories, lanes);
  const indexById = new Map(stories.map((s, i) => [s.id, i]));
  const slotOf = (s: LiveStory) => layouts[indexById.get(s.id) ?? -1]?.slot ?? 0;
  return (
    <div className="board-maprows" data-testid="story-map-view">
      {lanes.map((lane) => {
        const inLane = stories
          .filter((s) => s.lane === lane.name)
          .sort((a, b) => slotOf(a) - slotOf(b));
        const closed = inLane.filter((s) => s.status === "done").length;
        return (
          <div className="board-maprow" key={lane.name} data-testid="map-region-row">
            <div className="board-region-card">
              <span className="board-region-kicker">Region</span>
              <strong>{lane.name}</strong>
              <small>{lane.note}</small>
              <span className="board-region-rollup">
                {inLane.length} cases · {closed} closed
              </span>
            </div>
            <div className="board-slices">
              {inLane.map((story) => (
                <button
                  type="button"
                  className="board-slice"
                  key={story.id}
                  onClick={(e) => onSelect(story, e.currentTarget)}
                >
                  <span className="board-slice-top">
                    <span className="board-mono">{story.id}</span>
                    <span className={`board-pill board-pill-${story.status}`}>
                      {GAME_STATUS_LABEL[story.status]}
                    </span>
                  </span>
                  <strong className="board-slice-title">{story.title}</strong>
                  <span className="board-slice-foot">
                    <span>Case {caseNumber(story, stories)}</span>
                    {story.owner ? <span>{story.owner}</span> : null}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <p className="board-muted board-map-note">
        Product goal: every subject released for kids, no feature work still open, and no clip
        missing. The steps that get there are on the Releases view.
      </p>
    </div>
  );
}
