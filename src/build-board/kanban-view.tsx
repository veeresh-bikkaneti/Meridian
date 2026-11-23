/**
 * /kanban — the build board view (Option A mockup, ported): the
 * shared shell, the three baseline gauges, the lane segment with
 * counts, a free-to-claim toggle, and the five columns of handover
 * work items.
 *
 * The bundled snapshot (kanban.json, via loadSnapshot) renders
 * first, labelled with its as-of stamp. On mount the live overlay
 * (kanban-live) checks GitHub; when the check completes, its
 * states go through applyOverlay, the cards swap state, any card
 * whose column changed FLIP-animates to its new home (the mock's
 * 650 ms move), and the stamp turns into a live label. When the
 * check cannot complete — offline, rate limited — the snapshot
 * simply stays, under its snapshot stamp: the board never claims
 * to be live when it is not.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PageColumn } from "@/components/ui/page-column";
import { SiteFooter } from "@/components/ui/site-footer";
import { SiteHeader } from "@/components/ui/site-header";
import {
  applyOverlay,
  COLUMNS,
  freeToClaim,
  laneCounts,
  loadSnapshot,
  type Card,
  type Lane,
  type Snapshot,
} from "./kanban-data";
import { loadKanbanLive } from "./kanban-live";
import { Gauges } from "./gauges";
import snapshotJson from "./kanban.json";
import "./kanban.css";

const SNAPSHOT: Snapshot = loadSnapshot(snapshotJson);

const LANE_FILTERS: { key: Lane | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tech-debt", label: "Tech debt" },
  { key: "architecture", label: "Architecture" },
  { key: "product", label: "Product" },
];

function KanbanCard({ card }: { card: Card }) {
  return (
    <article className="kb-card" data-lane={card.lane} data-card-id={card.id}>
      <div className="kb-card-lane">
        {card.owner}
        {card.prompt ? <span className="kb-card-prompt">Prompt {card.prompt}</span> : null}
      </div>
      <div className="kb-card-title">{card.title}</div>
      {card.evidence ? <div className="kb-card-evidence">{card.evidence}</div> : null}
      {card.col === "Blocked" && card.blockedBy ? (
        <div className="kb-card-blocked">Blocked: {card.blockedBy}</div>
      ) : null}
      {card.note ? <div className="kb-card-note">{card.note}</div> : null}
      {card.links.length > 0 ? (
        <div className="kb-card-links">
          {card.links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function KanbanView() {
  const [cards, setCards] = useState<Card[]>(SNAPSHOT.cards);
  const [liveAt, setLiveAt] = useState<number | null>(null);
  const [lane, setLane] = useState<Lane | "all">("all");
  const [claimOnly, setClaimOnly] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  /* Card positions captured just before the overlay swap, consumed
   * by the layout effect below to FLIP the moved cards. */
  const firstRects = useRef<Map<string, DOMRect> | null>(null);

  /* The live overlay: one check per mount (loadKanbanLive shares
   * it across mounts). Success swaps in applyOverlay's cards and
   * the live stamp; null keeps the snapshot and its stamp. */
  useEffect(() => {
    let active = true;
    void loadKanbanLive().then((live) => {
      if (!active || !live) return;
      const rects = new Map<string, DOMRect>();
      boardRef.current
        ?.querySelectorAll<HTMLElement>("[data-card-id]")
        .forEach((el) => rects.set(el.dataset.cardId as string, el.getBoundingClientRect()));
      firstRects.current = rects;
      setCards((prev) => applyOverlay(prev, live.pulls, live.branches));
      setLiveAt(live.fetchedAt);
    });
    return () => {
      active = false;
    };
  }, []);

  /* FLIP (the mock's kanban.js move, ported): after the overlay
   * swap renders, each card that actually changed position is
   * played back from its old spot over 650 ms with the mock's
   * easing; unmoved cards are never touched. Skipped entirely
   * under prefers-reduced-motion — the still board is the board. */
  useLayoutEffect(() => {
    const first = firstRects.current;
    if (!first) return;
    firstRects.current = null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    boardRef.current
      ?.querySelectorAll<HTMLElement>("[data-card-id]")
      .forEach((el) => {
        const from = first.get(el.dataset.cardId as string);
        if (!from) return;
        const last = el.getBoundingClientRect();
        const dx = from.left - last.left;
        const dy = from.top - last.top;
        if (dx || dy) {
          el.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
            { duration: 650, easing: "cubic-bezier(.16,.8,.26,1)" },
          );
        }
      });
  }, [cards]);

  const counts = useMemo(() => laneCounts(cards), [cards]);
  const claimableIds = useMemo(
    () => new Set(freeToClaim(cards).map((card) => card.id)),
    [cards],
  );
  const visible = cards.filter(
    (card) =>
      (lane === "all" || card.lane === lane) && (!claimOnly || claimableIds.has(card.id)),
  );

  return (
    <div className="build-board">
      <SiteHeader to="/" status={null} mute={null} />
      <PageColumn width="wide">
        <div className="kb-main">
          <h1>Build board</h1>
          <p className="kb-sub">
            The handover work items — what is queued, blocked, being built, in review and
            done — for the people and agents building Meridian.
          </p>
          <span className="kb-stamp">
            {liveAt !== null
              ? `live · checked ${new Date(liveAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : `snapshot from ${SNAPSHOT.asOf}`}
          </span>
          <Gauges gauges={SNAPSHOT.gauges} />
          <div className="kb-controls">
            <div className="kb-seg" role="group" aria-label="Swimlane">
              {LANE_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  aria-pressed={lane === filter.key}
                  onClick={() => setLane(filter.key)}
                >
                  {filter.label} {filter.key === "all" ? cards.length : counts[filter.key]}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="kb-claim"
              aria-pressed={claimOnly}
              onClick={() => setClaimOnly((on) => !on)}
            >
              Free to claim {claimableIds.size}
            </button>
          </div>
          <div className="kb-board" ref={boardRef}>
            {COLUMNS.map((col) => {
              const colCards = visible.filter((card) => card.col === col);
              return (
                <section key={col} className="kb-col" data-col={col} aria-label={col}>
                  <h2>
                    {col}
                    <span>{colCards.length}</span>
                  </h2>
                  {colCards.length > 0 ? (
                    colCards.map((card) => <KanbanCard key={card.id} card={card} />)
                  ) : (
                    <div className="kb-empty">Nothing here yet</div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </PageColumn>
      <SiteFooter />
    </div>
  );
}
