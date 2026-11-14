import {
  buildDependencyEdges,
  dependencyDepths,
  GAME_STATUS_LABEL,
  type LiveStory,
} from "./board-data";

/**
 * Relationship graph for the Dependencies view — the Sprintbound
 * graph panel in Meridian terms. Nodes are the cases that take part in
 * a recorded dependency, laid out in dependency-depth columns (a case
 * sits one column right of the deepest case it needs), with connector
 * lines from each case to the case that must land before it. Only the
 * edges buildDependencyEdges records are drawn — the waits the
 * snapshot itself names with a PR number. Clicking a node opens the
 * case in the Live board's inspector (the parent switches view).
 */

const NODE_W = 208;
const NODE_H = 86;
const GAP_X = 64;
const GAP_Y = 26;
const PAD = 14;

export function DependencyGraph({
  stories,
  onSelect,
}: {
  stories: readonly LiveStory[];
  onSelect: (story: LiveStory, opener: HTMLElement) => void;
}) {
  const edges = buildDependencyEdges(stories);
  const depths = dependencyDepths(stories, edges);
  const nodeIndexes = [...new Set(edges.flatMap((e) => [e.from, e.to]))].sort((a, b) => a - b);

  const byDepth = new Map<number, number[]>();
  for (const i of nodeIndexes) {
    const d = depths[i] ?? 0;
    byDepth.set(d, [...(byDepth.get(d) ?? []), i]);
  }
  const pos = new Map<number, { col: number; row: number }>();
  for (const [depth, list] of byDepth) {
    list.forEach((i, row) => pos.set(i, { col: depth, row }));
  }
  const maxDepth = Math.max(0, ...byDepth.keys());
  const maxRows = Math.max(1, ...[...byDepth.values()].map((v) => v.length));
  const width = PAD * 2 + (maxDepth + 1) * NODE_W + maxDepth * GAP_X;
  const height = PAD * 2 + maxRows * NODE_H + (maxRows - 1) * GAP_Y;
  const left = (i: number) => PAD + (pos.get(i)?.col ?? 0) * (NODE_W + GAP_X);
  const top = (i: number) => PAD + (pos.get(i)?.row ?? 0) * (NODE_H + GAP_Y);
  const centre = (i: number) => ({ x: left(i) + NODE_W / 2, y: top(i) + NODE_H / 2 });

  return (
    <section className="board-graph" data-testid="dependency-graph" aria-label="Dependency graph">
      <div className="board-graph-head">
        <span>Relationship graph</span>
        <span className="board-muted">click a case to inspect it</span>
      </div>
      <div className="board-graph-scroll">
        <div className="board-graph-canvas" style={{ width, height }}>
          <svg
            className="board-graph-lines"
            width={width}
            height={height}
            aria-hidden="true"
            focusable="false"
          >
            {edges.map((e) => {
              const a = centre(e.from);
              const b = centre(e.to);
              return (
                <line
                  key={`${e.from}-${e.to}-${e.viaPr}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className="board-graph-line"
                />
              );
            })}
          </svg>
          {nodeIndexes.map((i) => {
            const s = stories[i];
            return (
              <button
                type="button"
                className="board-graph-node"
                key={s.id}
                style={{ left: left(i), top: top(i), width: NODE_W, minHeight: NODE_H }}
                onClick={(e) => onSelect(s, e.currentTarget)}
              >
                <span className="board-mono">{s.id}</span>
                <strong>{s.title}</strong>
                <small>{GAME_STATUS_LABEL[s.status]}</small>
              </button>
            );
          })}
        </div>
      </div>
      <p className="board-muted board-graph-legend">
        A line runs from a case to a case that needs it first. Only waits the snapshot names with
        a PR number are drawn — {edges.length} links across {nodeIndexes.length} cases.
      </p>
    </section>
  );
}
