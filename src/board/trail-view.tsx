/**
 * Board v4 — the trail and the shared story card.
 *
 * The trail is the owner-approved v4 sample, productionized: the
 * stops are the FEATURES (9 player-facing features under 4 epics),
 * each a panel that falls from the sky once on entry (staggered,
 * contact shadow tightening, ring-pulse and neighbour nudge on its
 * trail dot), with its stories inside behind "See what's inside".
 * A brass traveller rides the trail as a pure function of scroll,
 * with a plain-words readout naming the current stop. Stories keep
 * the v3 contract: plain title, status (icon + word, never colour
 * alone) and exactly ONE line; the same StoryCardPanel opens from
 * the trail and from the molecular map — one selection (§3).
 */
import { useEffect, useRef, useState } from "react";
import { STATUS_WORD, findStory, type PublishedBoard, type PublishedStory } from "./board-data.ts";
import { AnimWindow, StoryBanner } from "./card-animations.tsx";

/** Sentence form of a title for "Next: …" / banner prose (sample rule). */
export function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

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
      aria-label={`${pct}% delivered — ${done} of ${total} steps done`}
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
  const trailRef = useRef<HTMLDivElement>(null);
  const travRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);

  /* Stories live inside an opened feature (the sample's "See what's
   * inside"). The feature holding the selected story — a deep link,
   * the frontier banner's jump, a map selection — opens itself. */
  const [openFeatures, setOpenFeatures] = useState<ReadonlySet<string>>(() => {
    const fid = selectedSlug ? findStory(board, selectedSlug)?.featureId : undefined;
    return new Set(fid ? [fid] : []);
  });
  useEffect(() => {
    if (!selectedSlug) return;
    const fid = findStory(board, selectedSlug)?.featureId;
    if (fid)
      setOpenFeatures((prev) => (prev.has(fid) ? prev : new Set(prev).add(fid)));
  }, [selectedSlug, board]);

  const toggleFeature = (fid: string) =>
    setOpenFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(fid)) next.delete(fid);
      else next.add(fid);
      return next;
    });

  /* Arrival settles: a panel deepens its shadow as it crosses the
   * viewport's middle band (sample TECHNIQUE-MAP §2.2). */
  useEffect(() => {
    const root = trailRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) e.target.classList.add("v4-settled");
      },
      { rootMargin: "-30% 0px -30% 0px" },
    );
    root.querySelectorAll(".v4-panel").forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, [board]);

  /* The traveller + readout: pure functions of scroll progress,
   * exactly as in the sample. No scroll-jacking — the page scrolls
   * natively; the traveller only reports where the walk has got to. */
  useEffect(() => {
    const trail = trailRef.current;
    const trav = travRef.current;
    const line = lineRef.current;
    if (!trail || !trav || !line) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = trail.getBoundingClientRect();
      const total = Math.max(r.height - window.innerHeight * 0.5, 1);
      const done = Math.min(Math.max(-r.top + window.innerHeight * 0.35, 0), total);
      const p = done / total;
      trav.style.transform = `translateY(${p * (r.height - 40)}px)`;
      const mid = window.innerHeight * 0.5;
      const panels = [...trail.querySelectorAll<HTMLElement>(".v4-panel")];
      const passed = panels.filter((pan) => pan.getBoundingClientRect().top < mid);
      const current = passed.length > 0 ? passed[passed.length - 1].dataset.featureName : null;
      line.textContent =
        passed.length === 0
          ? "ON THE TRAIL — JUST STARTING"
          : `ON THE TRAIL — ${passed.length} OF ${panels.length} FEATURES · ${current?.toUpperCase()}`;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [board]);

  let panelIndex = 0;
  return (
    <>
      <p className="v4-progress-line" data-testid="board-progress-line" ref={lineRef}>
        ON THE TRAIL — JUST STARTING
      </p>
      <div className="v4-trail" ref={trailRef}>
        <div className="v4-traveller" ref={travRef} aria-hidden="true">
          <div className="v4-halo" />
          <svg viewBox="0 0 40 40" width="30" height="30">
            <circle cx="20" cy="20" r="13" fill="var(--hv5-card)" stroke="var(--hv5-brown)" strokeWidth="3" />
            <path d="M20 9 L24 20 L20 31 L16 20 Z" fill="var(--atlas-stamp)" />
            <circle cx="20" cy="20" r="2.6" fill="var(--hv5-brown)" />
          </svg>
        </div>
        {board.epics.map((epic, epicIdx) => {
          const epicStories = epic.features.flatMap((f) => f.stories);
          const epicDone = epicStories.filter((s) => s.status === "done").length;
          return (
            <div key={epic.id}>
              <section className="v3-epic" aria-label={epic.name}>
                <div className="v3-epic-head v4-epic-head">
                  <h2>{epic.name}</h2>
                  <span className="v3-epic-count">
                    {epicDone} of {epicStories.length} parts ready
                  </span>
                  <span className="v3-epic-rule" aria-hidden="true" />
                </div>
                {epic.features.map((feature) => {
                  const idx = panelIndex++;
                  const finished = feature.total > 0 && feature.done === feature.total;
                  const next = feature.stories.find((s) => s.status !== "done");
                  const isOpen = openFeatures.has(feature.id);
                  return (
                    <div
                      key={feature.id}
                      className="v4-panel"
                      data-feature-name={feature.name}
                      style={{ "--d": `${(idx * 0.13).toFixed(2)}s` } as React.CSSProperties}
                    >
                      <div className="v4-shadow" aria-hidden="true" />
                      <div className="v4-fall">
                        <article
                          className={`v3-feature${finished ? " v3-finished" : ""}`}
                          aria-label={feature.name}
                        >
                          <span className="v4-stop-dot" aria-hidden="true" />
                          <div className="v3-feature-card">
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
                                  <>
                                    Next: <strong>{lowerFirst(next.title)}</strong>
                                  </>
                                ) : null}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="v4-toggle"
                            data-testid={`board-feature-toggle-${feature.id}`}
                            aria-expanded={isOpen}
                            aria-controls={`v4-stories-${feature.id}`}
                            onClick={() => toggleFeature(feature.id)}
                          >
                            {isOpen ? "Hide the parts " : "See what's inside "}
                            <span className="v4-chev" aria-hidden="true">
                              ▾
                            </span>
                          </button>
                          <div id={`v4-stories-${feature.id}`} hidden={!isOpen}>
                        <div className="v3-groups">
                          {GROUP_ORDER.map((groupId) => {
                            const stories = feature.stories.filter(
                              (s) => storyGroup(board, s) === groupId,
                            );
                            if (stories.length === 0) return null;
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
                        </article>
                      </div>
                    </div>
                  );
                })}
              </section>
              {epicIdx < board.epics.length - 1 ? <div className="v4-mist" aria-hidden="true" /> : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
