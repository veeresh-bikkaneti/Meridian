/**
 * /kanban — the build board view (Option A mockup, ported): the
 * board content only — the route wraps it in the shared PageShell
 * (round 2), so this file renders no header, footer, column or
 * main landmark of its own. Inside: the three baseline gauges,
 * the lane segment with story and subtask counts, the
 * free-to-claim and Calm toggles, and the five columns of STORY
 * cards. A story expands into its subtasks; subtasks never
 * render as top-level cards.
 *
 * Data flow, three stages, each labelled by the stamp:
 *  1. The bundled snapshot (kanban.json, via loadSnapshot)
 *     renders first — "snapshot from <asOf>".
 *  2. On mount the per-deploy public snapshot
 *     (loadPublicSnapshot: build-board.json, refreshed every
 *     deploy) swaps in when it validates — "snapshot · built
 *     <builtAt>". Any failure keeps the bundled copy.
 *  3. The live overlay (loadKanbanLive) applies on top of
 *     whichever snapshot is showing: applyOverlay moves
 *     subtasks, story columns are recomputed with storyRollup
 *     (the stored rollup is never trusted), stories whose
 *     column changed FLIP to their new home within the motion
 *     budget, and the stamp turns live — "live · checked
 *     <time>". A failed check keeps the last good state under
 *     its snapshot label: the board never claims to be live
 *     when it is not.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  applyOverlay,
  freeToClaim,
  loadSnapshot,
  storyRollup,
  type Column,
  type Lane,
  type Snapshot,
  type Story,
  type Subtask,
} from "./kanban-data";
import { loadKanbanLive, loadPublicSnapshot } from "./kanban-live";
import { Gauges } from "./gauges";
import { beginMotion, endMotion, motionSettled } from "./motion-budget";
import snapshotJson from "./kanban.json";
import "./kanban.css";

const BUNDLED: Snapshot = loadSnapshot(snapshotJson);

type Stamp =
  | { kind: "bundled" }
  | { kind: "public"; builtAt?: string; asOf: string }
  | { kind: "live"; at: number };

function stampText(stamp: Stamp, bundledAsOf: string): string {
  switch (stamp.kind) {
    case "bundled":
      return `snapshot from ${bundledAsOf}`;
    case "public": {
      if (!stamp.builtAt) return `snapshot · built ${stamp.asOf}`;
      const built = new Date(stamp.builtAt);
      return Number.isNaN(built.getTime())
        ? `snapshot · built ${stamp.builtAt}`
        : `snapshot · built ${built.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}`;
    }
    case "live":
      return `live · checked ${new Date(stamp.at).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`;
  }
}

/* ------------------------------------------------------------------ */
/* Subtask rows (rendered only inside an expanded story)               */
/* ------------------------------------------------------------------ */

function SubtaskRow({ sub, free }: { sub: Subtask; free: boolean }) {
  return (
    <li className={`kb-sub${free ? " kb-sub-free" : ""}`}>
      <div className="kb-sub-head">
        <span className="kb-sub-title">{sub.title}</span>
        <span className="kb-chip kb-chip-col" data-col={sub.col}>
          {sub.col}
        </span>
        {free ? <span className="kb-chip kb-chip-free">free</span> : null}
      </div>
      <div className="kb-sub-meta">
        <span className="kb-sub-owner">{sub.owner}</span>
        {sub.prompt ? <span className="kb-chip">Prompt {sub.prompt}</span> : null}
        {sub.gate ? <span className="kb-chip kb-chip-gate">Gate: {sub.gate}</span> : null}
        {sub.blockedBy ? (
          <span className="kb-chip kb-chip-blocked">Blocked: {sub.blockedBy}</span>
        ) : null}
        {sub.note ? <span className="kb-chip kb-chip-note">{sub.note}</span> : null}
        {sub.ownsStatus === "unknown" ? (
          <span className="kb-chip kb-chip-unknown">
            files not mapped, check before you start
          </span>
        ) : null}
      </div>
      {sub.prs.length > 0 || sub.issues.length > 0 || sub.branches.length > 0 ? (
        <div className="kb-card-links">
          {sub.prs.map((pr) => (
            <a key={`pr-${pr.number}`} href={pr.href}>
              {pr.role === "closes" ? `finishes #${pr.number}` : `context #${pr.number}`}
            </a>
          ))}
          {sub.issues.map((issue) => (
            <a key={`issue-${issue.number}`} href={issue.href}>
              {`issue #${issue.number}`}
            </a>
          ))}
          {sub.branches.map((branch) =>
            branch.href ? (
              <a key={`branch-${branch.name}`} href={branch.href}>
                {branch.role === "work"
                  ? `branch ${branch.name}`
                  : `context branch ${branch.name}`}
              </a>
            ) : (
              <span key={`branch-${branch.name}`} className="kb-link-chip">
                {branch.role === "work"
                  ? `branch ${branch.name}`
                  : `context branch ${branch.name}`}
              </span>
            ),
          )}
        </div>
      ) : null}
      {sub.evidence ? <div className="kb-sub-evidence">{sub.evidence}</div> : null}
      {sub.owns.length > 0 ? (
        <details className="kb-sub-owns">
          <summary>Files it touches ({sub.owns.length})</summary>
          <ul>
            {sub.owns.map((path) => (
              <li key={path}>
                <code>{path}</code>
              </li>
            ))}
          </ul>
          {sub.ownsNote ? <p className="kb-sub-owns-note">{sub.ownsNote}</p> : null}
        </details>
      ) : sub.ownsNote ? (
        <p className="kb-sub-owns-note">{sub.ownsNote}</p>
      ) : sub.ownsStatus === "none" ? (
        <p className="kb-sub-owns-note">No files change.</p>
      ) : null}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Story cards (the only top-level cards)                              */
/* ------------------------------------------------------------------ */

function StoryCard({
  story,
  laneLabel,
  rollup,
  subtasks,
  open,
  onToggle,
  freeIds,
}: {
  story: Story;
  laneLabel: string;
  rollup: { col: Column; done: number; total: number };
  subtasks: Subtask[];
  open: boolean;
  onToggle: () => void;
  freeIds: ReadonlySet<string>;
}) {
  const listId = `kb-subs-${story.id}`;
  return (
    <article className="kb-card kb-story" data-lane={story.lane} data-story-id={story.id}>
      <div className="kb-story-top">
        <div className="kb-story-main">
          <div className="kb-card-lane">{laneLabel}</div>
          <div className="kb-card-title">{story.title}</div>
          {story.why ? <div className="kb-story-why">{story.why}</div> : null}
          {story.phase || story.prompts.length > 0 ? (
            <div className="kb-story-meta">
              {story.phase ? `Phase ${story.phase}` : null}
              {story.phase && story.prompts.length > 0 ? " · " : null}
              {story.prompts.length > 0 ? `Prompts ${story.prompts.join(", ")}` : null}
            </div>
          ) : null}
          <div className="kb-story-progress">
            <span>
              {rollup.done}/{rollup.total} done
            </span>
            <span className="kb-bar" aria-hidden="true">
              <span
                className="kb-bar-fill"
                style={{
                  width: `${rollup.total > 0 ? (rollup.done / rollup.total) * 100 : 0}%`,
                }}
              />
            </span>
          </div>
        </div>
        <button
          type="button"
          className="kb-expand"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`${open ? "Hide" : "Show"} subtasks for ${story.title}`}
          onClick={onToggle}
        >
          <span className={`kb-chevron${open ? " kb-chevron-open" : ""}`} aria-hidden="true">
            ▾
          </span>
        </button>
      </div>
      {open ? (
        <ul className="kb-subs" id={listId}>
          {subtasks.map((sub) => (
            <SubtaskRow key={sub.id} sub={sub} free={freeIds.has(sub.id)} />
          ))}
        </ul>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* The view                                                            */
/* ------------------------------------------------------------------ */

export function KanbanView() {
  const [snapshot, setSnapshot] = useState<Snapshot>(BUNDLED);
  const [subtasks, setSubtasks] = useState<Subtask[]>(BUNDLED.subtasks);
  const [stamp, setStamp] = useState<Stamp>({ kind: "bundled" });
  const [lane, setLane] = useState<Lane | "all">("all");
  const [claimOnly, setClaimOnly] = useState(false);
  const [calm, setCalm] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const boardRef = useRef<HTMLDivElement>(null);
  /* Story positions captured just before the overlay swap,
   * consumed by the layout effect below to FLIP the moved ones. */
  const firstRects = useRef<Map<string, DOMRect> | null>(null);
  /* Each story's column as last rendered, so the FLIP pass can
   * tell a real column change from a same-column re-render. */
  const prevCols = useRef<Map<string, Column>>(new Map());
  const calmRef = useRef(calm);
  calmRef.current = calm;

  /* Stages 2 and 3 of the data flow (see the header note): the
   * per-deploy public snapshot first, then the live overlay on
   * top of whichever snapshot won. Each failure keeps the last
   * good state and its label. */
  useEffect(() => {
    let active = true;
    void (async () => {
      let base = BUNDLED;
      const pub = await loadPublicSnapshot();
      if (!active) return;
      if (pub) {
        base = pub;
        setSnapshot(pub);
        setSubtasks(pub.subtasks);
        setStamp({ kind: "public", builtAt: pub.builtAt, asOf: pub.asOf });
      }
      const live = await loadKanbanLive();
      if (!active || !live) return;
      const rects = new Map<string, DOMRect>();
      boardRef.current
        ?.querySelectorAll<HTMLElement>("[data-story-id]")
        .forEach((el) => rects.set(el.dataset.storyId as string, el.getBoundingClientRect()));
      firstRects.current = rects;
      setSubtasks(applyOverlay(base.subtasks, live.pulls, live.branches));
      setStamp({ kind: "live", at: live.fetchedAt });
    })();
    return () => {
      active = false;
    };
  }, []);

  /* FLIP (the mock's kanban.js move, budgeted): after a swap
   * renders, each story whose column actually changed is played
   * back from its old spot over 650 ms with the mock's easing —
   * but only within the motion budget (motion-budget.ts: at most
   * 1 moving card on phones, 2 on desktop; the rest rest at
   * their end pose), and never under Calm or reduced motion. */
  useLayoutEffect(() => {
    const byId = new Map(subtasks.map((s) => [s.id, s]));
    const cols = new Map(
      snapshot.stories.map((story) => [story.id, storyRollup(story, byId).col]),
    );
    const first = firstRects.current;
    firstRects.current = null;
    if (first && !motionSettled(calmRef.current)) {
      boardRef.current
        ?.querySelectorAll<HTMLElement>("[data-story-id]")
        .forEach((el) => {
          const id = el.dataset.storyId as string;
          if (prevCols.current.get(id) === cols.get(id)) return;
          const from = first.get(id);
          if (!from) return;
          const last = el.getBoundingClientRect();
          const dx = from.left - last.left;
          const dy = from.top - last.top;
          if (!dx && !dy) return;
          if (!beginMotion(el)) return;
          const anim = el.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
            { duration: 650, easing: "cubic-bezier(.16,.8,.26,1)" },
          );
          anim.onfinish = () => endMotion(el);
          anim.oncancel = () => endMotion(el);
        });
    }
    prevCols.current = cols;
  }, [subtasks, snapshot]);

  const subtasksById = useMemo(() => new Map(subtasks.map((s) => [s.id, s])), [subtasks]);
  const rollups = useMemo(() => {
    const out = new Map<string, { col: Column; done: number; total: number }>();
    for (const story of snapshot.stories) out.set(story.id, storyRollup(story, subtasksById));
    return out;
  }, [snapshot, subtasksById]);

  const freeSubs = useMemo(
    () => freeToClaim(subtasks, snapshot.hotFiles),
    [subtasks, snapshot],
  );
  const freeIds = useMemo(() => new Set(freeSubs.map((s) => s.id)), [freeSubs]);
  const freeStoryIds = useMemo(
    () => new Set(freeSubs.map((s) => s.story)),
    [freeSubs],
  );

  const laneLabel = (id: Lane) => snapshot.lanes.find((l) => l.id === id)?.label ?? id;
  const laneCountsFor = (key: Lane | "all") => ({
    stories:
      key === "all"
        ? snapshot.stories.length
        : snapshot.stories.filter((s) => s.lane === key).length,
    tasks:
      key === "all" ? subtasks.length : subtasks.filter((s) => s.lane === key).length,
  });

  const visibleStories = snapshot.stories.filter(
    (story) =>
      (lane === "all" || story.lane === lane) &&
      (!claimOnly || freeStoryIds.has(story.id)),
  );
  /* In free-to-claim mode the matching stories render
   * auto-expanded; outside it, expansion is the reader's own. */
  const openStories: ReadonlySet<string> = claimOnly ? freeStoryIds : expanded;
  const toggleStory = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const LANE_FILTERS: { key: Lane | "all"; label: string }[] = [
    { key: "all", label: "All" },
    ...snapshot.lanes.map((l) => ({ key: l.id as Lane | "all", label: l.label })),
  ];

  return (
    <div className={`build-board${calm ? " kb-calm" : ""}`}>
      <div className="kb-main">
        <h1>Build board</h1>
        <p className="kb-sub">
          The handover work, as plain-English stories with their subtasks — what is
          queued, blocked, being built, in review and done — for the people and agents
          building Meridian.
        </p>
        <span className="kb-stamp">{stampText(stamp, snapshot.asOf)}</span>
        <Gauges gaugeInfo={snapshot.gaugeInfo} calm={calm} />
        <div className="kb-controls">
          <div className="kb-seg" role="group" aria-label="Swimlane">
            {LANE_FILTERS.map((filter) => {
              const counts = laneCountsFor(filter.key);
              return (
                <button
                  key={filter.key}
                  type="button"
                  aria-pressed={lane === filter.key}
                  onClick={() => setLane(filter.key)}
                >
                  {filter.label} · {counts.stories} stories, {counts.tasks} tasks
                </button>
              );
            })}
          </div>
          <div className="kb-toggles">
            <button
              type="button"
              className="kb-claim"
              aria-pressed={claimOnly}
              onClick={() => setClaimOnly((on) => !on)}
            >
              Free to claim {freeSubs.length}
            </button>
            <button
              type="button"
              className="kb-calm-toggle"
              aria-pressed={calm}
              onClick={() => setCalm((on) => !on)}
            >
              Calm
            </button>
          </div>
        </div>
        <div className="kb-board" ref={boardRef}>
          {snapshot.columns.map((col) => {
            const colStories = visibleStories.filter(
              (story) => rollups.get(story.id)?.col === col,
            );
            return (
              <section key={col} className="kb-col" data-col={col} aria-label={col}>
                <h2>
                  {col}
                  <span>{colStories.length}</span>
                </h2>
                {colStories.length > 0 ? (
                  colStories.map((story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      laneLabel={laneLabel(story.lane)}
                      rollup={rollups.get(story.id) as { col: Column; done: number; total: number }}
                      subtasks={story.subtasks
                        .map((id) => subtasksById.get(id))
                        .filter((s): s is Subtask => Boolean(s))}
                      open={openStories.has(story.id)}
                      onToggle={() => toggleStory(story.id)}
                      freeIds={freeIds}
                    />
                  ))
                ) : (
                  <div className="kb-empty">Nothing here yet</div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
