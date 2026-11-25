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
 * Data flow:
 *  1. Ask GitHub for pulls and branches (refreshKanbanLive).
 *     Success renders deriveBoardItems and the stamp
 *     "Live · fetched HH:MM". Ledger-only rows stay hidden as
 *     cards, but the lane counts are a census over the ledger,
 *     the PR number map and the live window (TD-08.5), so an
 *     item that fell out of the 100-PR window still counts.
 *  2. Failure (offline, 403, 429, malformed) renders the
 *     snapshot — the per-deploy public file when it validates,
 *     otherwise the bundled kanban.json — under a visible
 *     "Offline snapshot from <asOf>" banner.
 *  3. Focus and visibility re-check only after the 5-minute
 *     cache expires. There is no interval.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  boardCensus,
  deriveBoardItems,
  freeToClaim,
  loadSnapshot,
  storyRollup,
  storySeatTags,
  type Column,
  type DerivedCard,
  type Lane,
  type Snapshot,
  type Story,
  type Subtask,
} from "./kanban-data";
import { loadPublicSnapshot, refreshKanbanLive } from "./kanban-live";
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
    case "live": {
      const d = new Date(stamp.at);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `Live · fetched ${hh}:${mm}`;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Subtask rows (rendered only inside an expanded story)               */
/* ------------------------------------------------------------------ */

function SubtaskRow({ sub, free }: { sub: Subtask; free: boolean }) {
  return (
    <li className={`kb-sub${free ? " kb-sub-free" : ""}`}>
      <div className="kb-sub-head">
        <span className="kb-sub-title">
          <span className="kb-num">{sub.num}</span> {sub.title}
        </span>
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
  const seatTags = storySeatTags(subtasks);
  return (
    <article className="kb-card kb-story" data-lane={story.lane} data-story-id={story.id}>
      <div className="kb-story-top">
        <div className="kb-story-main">
          <div className="kb-card-lane">{laneLabel}</div>
          <div className="kb-card-title">
            <span className="kb-num">{story.num}</span> {story.title}
          </div>
          {seatTags.length > 0 ? (
            <div className="kb-seat-tags">
              {seatTags.map((tag) => (
                <span key={tag} className="kb-chip kb-chip-seat" data-seat-tag={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
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
          aria-label={`${open ? "Hide" : "Show"} subtasks for ${story.num} ${story.title}`}
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

function LiveCard({ item, laneLabel }: { item: DerivedCard; laneLabel: string }) {
  return (
    <article
      className="kb-card kb-story"
      data-lane={item.lane}
      data-story-id={item.id}
      data-group={item.unnumbered ? "Unnumbered" : "numbered"}
    >
      <div className="kb-story-top">
        <div className="kb-story-main">
          <div className="kb-card-lane">{item.unnumbered ? "Unnumbered" : laneLabel}</div>
          <div className="kb-card-title">
            {item.num ? (
              <span className="kb-num">{item.num}</span>
            ) : (
              <span className="kb-num">Unnumbered</span>
            )}{" "}
            {item.title}
          </div>
          {item.seatTags.length > 0 ? (
            <div className="kb-seat-tags">
              {item.seatTags.map((tag) => (
                <span key={tag} className="kb-chip kb-chip-seat" data-seat-tag={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {item.note ? <span className="kb-chip kb-chip-note">{item.note}</span> : null}
          {item.prs.length > 0 ? (
            <div className="kb-card-links">
              {item.prs.map((pr) => (
                <a key={pr.number} className="kb-chip" href={pr.href}>
                  #{pr.number}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* The view                                                            */
/* ------------------------------------------------------------------ */

export function KanbanView() {
  const [snapshot, setSnapshot] = useState<Snapshot>(BUNDLED);
  const [subtasks, setSubtasks] = useState<Subtask[]>(BUNDLED.subtasks);
  const [items, setItems] = useState<DerivedCard[]>([]);
  const [mode, setMode] = useState<"pending" | "live" | "offline">("pending");
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

  /* GitHub first. The snapshot renders only when that check fails.
   * Focus and visibility re-check after the cache expires. */
  useEffect(() => {
    let active = true;
    const apply = async (event: "mount" | "focus" | "visible") => {
      const pubPromise = event === "mount" ? loadPublicSnapshot() : Promise.resolve(null);
      const resultPromise = refreshKanbanLive({ event });
      const pub = await pubPromise;
      const result = await resultPromise;
      if (!active) return;
      if (pub) {
        setSnapshot(pub);
        setSubtasks(pub.subtasks);
      }
      if (result.action === "skip") return;
      if (result.action === "fallback") {
        setMode("offline");
        return;
      }
      const rects = new Map<string, DOMRect>();
      boardRef.current
        ?.querySelectorAll<HTMLElement>("[data-story-id]")
        .forEach((el) => rects.set(el.dataset.storyId as string, el.getBoundingClientRect()));
      firstRects.current = rects;
      setItems(deriveBoardItems(result.state.pulls, result.state.branches));
      setStamp({ kind: "live", at: result.state.fetchedAt });
      setMode("live");
    };
    void apply("mount");
    const onFocus = () => void apply("focus");
    const onVisible = () => {
      if (document.visibilityState === "visible") void apply("visible");
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
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
  /* Live counts come from the census (TD-08.5): the union of
   * the ledger, the PR number map and the live window, with
   * stories and tasks counted separately — never the window
   * length, which capped both at the number of derived cards. */
  const census = useMemo(() => boardCensus(snapshot, items), [snapshot, items]);
  const laneCountsFor = (key: Lane | "all") => {
    if (mode === "live") {
      const c = census[key];
      return { stories: c.stories, tasks: c.tasks };
    }
    return {
      stories:
        key === "all"
          ? snapshot.stories.length
          : snapshot.stories.filter((s) => s.lane === key).length,
      tasks: key === "all" ? subtasks.length : subtasks.filter((s) => s.lane === key).length,
    };
  };

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
        <span className={`kb-stamp${mode === "offline" ? " kb-offline" : ""}`} role="status">
          {mode === "offline"
            ? `Offline snapshot from ${snapshot.asOf}`
            : mode === "pending"
              ? "Checking GitHub…"
              : stampText(stamp, snapshot.asOf)}
        </span>
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
            {mode !== "live" ? (
              <button
                type="button"
                className="kb-claim"
                aria-pressed={claimOnly}
                onClick={() => setClaimOnly((on) => !on)}
              >
                Free to claim {freeSubs.length}
              </button>
            ) : null}
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
        {mode === "live" ? (
          <p className="kb-count-note">
            Counts include the checked-in ledger plus the last 100 updated PRs
            {census.all.unnumbered > 0 ? ` · ${census.all.unnumbered} unnumbered` : ""}
          </p>
        ) : null}
        <div className="kb-board" ref={boardRef}>
          {mode === "pending" ? (
            <div className="kb-empty">Checking GitHub…</div>
          ) : mode === "live" ? (
            snapshot.columns.map((col) => {
              const colItems = items.filter(
                (item) => item.col === col && (lane === "all" || item.lane === lane),
              );
              const numbered = colItems.filter((item) => !item.unnumbered);
              const unnumbered = colItems.filter((item) => item.unnumbered);
              return (
                <section key={col} className="kb-col" data-col={col} aria-label={col}>
                  <h2>
                    {col}
                    <span>{colItems.length}</span>
                  </h2>
                  {numbered.map((item) => (
                    <LiveCard key={item.id} item={item} laneLabel={laneLabel(item.lane)} />
                  ))}
                  {unnumbered.length > 0 ? <p className="kb-group">Unnumbered</p> : null}
                  {unnumbered.map((item) => (
                    <LiveCard key={item.id} item={item} laneLabel={laneLabel(item.lane)} />
                  ))}
                  {colItems.length === 0 ? <div className="kb-empty">Nothing here yet</div> : null}
                </section>
              );
            })
          ) : (
            snapshot.columns.map((col) => {
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
            })
          )}
        </div>
      </div>
    </div>
  );
}
