import { createFileRoute } from "@tanstack/react-router";
import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FALLBACK_BOARD,
  allClosedFeatureIds,
  findStory,
  formatUpdated,
  frontierSlug,
  isStale,
  loadBoardLinks,
  loadBoardStatus,
  newlyClosedFeatures,
  readSeenClosed,
  writeSeenClosed,
  type LoadedBoard,
  type PublishedBoard,
} from "@/board/board-data";
import { loadLiveBoard } from "@/board/live-feed";
import { computeLayout } from "@/board/status-core";
import { TrailView, lowerFirst } from "@/board/trail-view";
import { FeatureRequestForm } from "@/board/feature-request-form";
import { flagsRemoteApplied, isEnabled, loadFlags } from "@/lib/flags";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import "@/board/board.css";
import { getStorageItem, setStorageItem } from "../platform/storage/browser-storage.ts";
import { STORAGE_KEYS } from "../platform/storage/keys.ts";

const MoleculeMap = lazy(() => import("@/board/molecule-map"));

/**
 * /board — "What's coming" (board v4 trail; v3 map/form).
 *
 * The board's base layer is the published status file
 * (public/board-status.json), generated from the team's own curated
 * records by scripts/board/publish-status.mjs. It renders first,
 * exactly as published, with its own Updated stamp.
 *
 * Over it sits the live feed (owner ruling, 2026-11-16: "getting
 * the live feed was the biggest requirement we had") — the overlay
 * board v2 shipped and v3 removed, restored on the published
 * contract. On load the page checks the repo's public PR/issue
 * state on GitHub (live-feed.ts), paginating until every record
 * linked from the publisher's links file is covered. Full coverage:
 * statuses are recomputed from the live answer (player words only:
 * the board's own banned-token scan in status-core.ts bars the
 * service's name from anything public). The header, though, keeps
 * only the snapshot's Updated stamp in every state (owner ruling,
 * 2026-11-16) — no platform or coverage wording. Anything less —
 * a failed, rate-limited or partial check — keeps the snapshot on
 * screen and says so plainly. The claim is never made without the
 * coverage to back it: that was v2's centrepiece defect (a one-page
 * fetch under a "Live" label), and it stays dead. Behind the
 * boardLiveFeed kill switch.
 * If the published file itself cannot be fetched, the bundled copy
 * renders and the header discloses that ("showing the copy that
 * came with the site").
 *
 * Three views over the same published data: the trail (the journey),
 * the molecular map (the structure; behind the board3d kill switch),
 * and the tip form. One selection, mirrored to the URL
 * (?view=&story=), shared by trail and map.
 *
 * Theme (owner ruling, 2026-11-15): the board loads on the
 * visitor's system theme and the visitor can switch it — System /
 * Light / Dark in the view nav. An explicit choice sets
 * data-board-theme on the board root, where board.css re-declares
 * the scheme tokens (copies pinned by theme-parity.test.ts), and
 * persists through the storage port; System sets no attribute and the
 * media query rules, exactly as before the switch existed.
 *
 * Indexing: the board IS indexed and listed in the sitemap
 * (owner ruling, 2026-11-15, superseding board v2 step 15's
 * noindex): the "What's coming" surface is for parents to
 * discover, so search engines are welcome alongside the link
 * exposure (nav, footer, grown-ups pages).
 * scripts/static-wellknown.test.mjs asserts both halves.
 *
 * ssr: false, like / and /contact: the page reads saved preferences (the
 * seen-closed set, Calm mode) and fetches the status file.
 */
export const Route = createFileRoute("/board")({
  validateSearch: (search: Record<string, unknown>): { view?: string; story?: string } => ({
    view: typeof search.view === "string" ? search.view : undefined,
    story: typeof search.story === "string" ? search.story : undefined,
  }),
  head: () => ({
    meta: [
      { title: "What's coming — Meridian" },
      {
        name: "description",
        content:
          "What the Meridian team is making next: the features being built, in plain words, for grown-ups.",
      },
    ],
  }),
  ssr: false,
  component: BoardPage,
});

type BoardView = "trail" | "map" | "tip";
type BoardThemeChoice = "system" | "light" | "dark";

/** The seen-closed helpers take a storage-shaped object. This one
 * speaks the port, so the page never touches the browser store. */
function boardSeenStorage(): Storage {
  const def = STORAGE_KEYS.boardSeenClosed;
  return {
    getItem(key: string): string | null {
      if (key !== def.key) return null;
      return getStorageItem(def);
    },
    setItem(key: string, value: string): void {
      if (key !== def.key) return;
      setStorageItem(def, value);
    },
    removeItem(): void {},
    clear(): void {},
    key(): string | null {
      return null;
    },
    get length(): number {
      return 0;
    },
  };
}

function BoardPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const view: BoardView = search.view === "map" ? "map" : search.view === "tip" ? "tip" : "trail";
  const selectedSlug = search.story ?? null;

  const [loaded, setLoaded] = useState<LoadedBoard | null>(null);
  const [mapOn, setMapOn] = useState(true);
  const [calm, setCalm] = useState(
    () => typeof window !== "undefined" && getStorageItem(STORAGE_KEYS.boardCalm) === "1",
  );
  /* Board theme: the stored choice wins; "system" (the default,
   * and the fallback for anything unreadable) sets no attribute —
   * the media query rules, exactly as before the switch existed. */
  const [themeChoice, setThemeChoice] = useState<BoardThemeChoice>(() => {
    if (typeof window === "undefined") return "system";
    try {
      const v = getStorageItem(STORAGE_KEYS.boardTheme);
      return v === "light" || v === "dark" ? v : "system";
    } catch {
      return "system";
    }
  });
  const [systemScheme, setSystemScheme] = useState<"light" | "dark">(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark",
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) =>
      setSystemScheme(e.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const scheme: "light" | "dark" =
    themeChoice === "system" ? systemScheme : themeChoice;
  const pickTheme = (choice: BoardThemeChoice) => {
    setThemeChoice(choice);
    try {
      setStorageItem(STORAGE_KEYS.boardTheme, choice);
    } catch {
      /* ignore */
    }
  };
  const [toast, setToast] = useState<string | null>(null);

  /* Fix 2 (owner, 2026-11-16): on small screens every control hides
   * behind one Menu bar; on big screens the bar is CSS-hidden and the
   * panel below is the horizontal nav bar in the header. The menu
   * contract follows the play pages' popover discipline: opening moves
   * focus into the panel, Esc closes and returns focus to the Menu
   * button, and a tap outside closes. */
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const navPanelRef = useRef<HTMLDivElement | null>(null);
  const viewnavRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    navPanelRef.current
      ?.querySelector<HTMLButtonElement>("button:not([disabled])")
      ?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (viewnavRef.current && !viewnavRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    let active = true;
    void loadBoardStatus().then((result) => {
      if (active) setLoaded(result);
    });
    void loadFlags().then(() => {
      if (active) setMapOn(isEnabled("board3d"));
    });
    return () => {
      active = false;
    };
  }, []);

  /* The live feed: once the snapshot is on screen and the flags
   * have spoken, run the one GitHub check for this page load. The
   * snapshot never waits for it. A completed check swaps the board
   * underneath every view at once (counts, pills, groups, map —
   * they all read the one `board` below); a failed or partial one
   * only adds the honest note under the header. Kill switch off =
   * no fetch and no note: the board is the snapshot, as v3 shipped. */
  const [liveBoard, setLiveBoard] = useState<PublishedBoard | null>(null);
  const [liveLine, setLiveLine] = useState<
    { kind: "live"; covered: number; wanted: number } | { kind: "unavailable" } | null
  >(null);

  useEffect(() => {
    if (!loaded) return;
    let active = true;
    void loadFlags().then(async () => {
      // Fail closed: the check runs only when the deployed flags.json
      // was actually read and says on. If the fetch failed or timed
      // out, the baked-in default (on) must not defeat a deployed
      // kill switch — the snapshot board is the safe state.
      if (!active || !flagsRemoteApplied() || !isEnabled("boardLiveFeed")) return;
      const links = await loadBoardLinks();
      const result = await loadLiveBoard(loaded.board, links);
      if (!active) return;
      if (result.kind === "live") {
        setLiveBoard(result.board);
        setLiveLine({ kind: "live", covered: result.covered, wanted: result.wanted });
      } else {
        setLiveLine({ kind: "unavailable" });
      }
    });
    return () => {
      active = false;
    };
  }, [loaded]);

  const board = liveBoard ?? loaded?.board ?? FALLBACK_BOARD;
  const layout = useMemo(() => computeLayout(board), [board]);
  const frontier = useMemo(() => frontierSlug(board), [board]);
  const stale = loaded && !liveBoard ? isStale(board.updatedAt, Date.now()) : false;

  /* Honest celebration: toast only for a feature that closed since
   * the visitor's last visit — never on first sight (spec §2). */
  useEffect(() => {
    if (!loaded) return;
    const seenStorage = boardSeenStorage();
    const seen = readSeenClosed(seenStorage);
    const names = newlyClosedFeatures(board, seen);
    if (names.length > 0) setToast(names[0]);
    writeSeenClosed(seenStorage, allClosedFeatureIds(board));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  /* Deep link: scroll the open stop into view on the trail. */
  useEffect(() => {
    if (view !== "trail" || !selectedSlug) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`v3-stop-${selectedSlug}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [view, selectedSlug, loaded]);

  const go = (next: Partial<{ view: BoardView; story: string | null }>) => {
    void navigate({
      search: {
        view: next.view ?? (view === "trail" ? undefined : view),
        story: (next.story === undefined ? selectedSlug : next.story) ?? undefined,
      },
    });
  };
  /* Picking a view from the small-screen panel closes it and returns
   * focus to the Menu button; on big screens the button is hidden, so
   * focus simply stays in the bar. Theme and Calm picks are settings,
   * not navigation — they leave the panel open. */
  const pickView = (next: BoardView) => {
    if (menuOpen) {
      setMenuOpen(false);
      const btn = menuButtonRef.current;
      if (btn && btn.offsetParent !== null) btn.focus();
    }
    go({ view: next });
  };
  const select = (slug: string | null) => go({ story: slug });
  const frontierStory = frontier ? findStory(board, frontier) : null;

  /* Parallax ground (v4 sample): two fixed layers drift at different
   * rates against scroll, as CSS vars on the board root. Frozen under
   * Calm mode and prefers-reduced-motion — the ground simply rests. */
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm || reduced) {
      main.style.setProperty("--v4-pf", "0px");
      main.style.setProperty("--v4-pm", "0px");
      return;
    }
    let ticking = false;
    const update = () => {
      ticking = false;
      main.style.setProperty("--v4-pf", `${window.scrollY * -0.045}px`);
      main.style.setProperty("--v4-pm", `${window.scrollY * -0.09}px`);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => window.removeEventListener("scroll", onScroll);
  }, [calm, view]);

  return (
    <main
      ref={mainRef}
      className={`board-v3${calm ? " v3-calm" : ""}${view === "trail" ? " v4-trail-page" : ""}`}
      data-board-theme={themeChoice === "system" ? undefined : themeChoice}
    >
      {view === "trail" ? (
        <>
          <div className="v4-layer v4-layer-far" aria-hidden="true" />
          <div className="v4-layer v4-layer-mid" aria-hidden="true" />
          <div className="v4-vignette" aria-hidden="true" />
        </>
      ) : null}
      <div className="v3-wrap">
        {/* The shared shell header (PR 3 Step 3.2): SiteHeader carries
            the one Home control; the board's dark-capable theme rides
            the shell's map variant (a prop, not a fork). The board's
            own title block below is content, not a second header. */}
        <SiteHeader to="/" variant="map" status={null} mute={null} />
        <div className="v3-head">
          <p className="v3-eyebrow">For grown-ups</p>
          <h1 className="v3-title">What&rsquo;s coming</h1>
          <p className="v3-counts" data-testid="board-counts-line">
            {board.counts.done} of {board.counts.total} steps finished · {board.counts.inProgress}{" "}
            being built · {board.counts.notStarted} not started yet
          </p>
          <p className="v4-walk">Every stop is a feature your child will play.</p>
          <p className="v3-updated" data-testid="board-updated-line">
            Updated {formatUpdated(board.updatedAt)}
            {loaded?.source === "manual" ? " — showing the copy that came with the site" : ""}
          </p>
          {liveLine?.kind === "unavailable" ? (
            <p className="v3-stale" role="note" data-testid="board-live-note">
              The live check couldn&rsquo;t be completed just now — showing the list as last
              updated.
            </p>
          ) : null}
          {stale ? (
            <p className="v3-stale" role="note">
              This list is more than a day old — a fresher one is on its way.
            </p>
          ) : null}
        </div>

        {frontierStory ? (
          <div className="v3-frontier-banner">
            <p>
              <strong>We&rsquo;re working on this now:</strong> {lowerFirst(frontierStory.story.title)}
            </p>
            <button
              type="button"
              className="v3-btn"
              onClick={() => go({ view: "trail", story: frontier })}
            >
              Take me there
            </button>
          </div>
        ) : null}

        <nav className="v3-viewnav" aria-label="Board views" ref={viewnavRef}>
          <div className="v3-menubar">
            <button
              type="button"
              className="v3-menu-button"
              data-testid="board-menu-button"
              ref={menuButtonRef}
              aria-expanded={menuOpen}
              aria-controls="board-nav-panel"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span aria-hidden="true">☰</span> Menu
            </button>
          </div>
          <div
            className="v3-nav-panel"
            id="board-nav-panel"
            ref={navPanelRef}
            data-open={menuOpen ? "true" : "false"}
          >
          <div className="v3-nav-row" role="group" aria-label="Views">
            <span className="v3-nav-row-label" aria-hidden="true">Views</span>
            <div className="v3-nav-cluster">
            <button
              type="button"
              data-testid="board-nav-trail"
              aria-pressed={view === "trail"}
              onClick={() => pickView("trail")}
            >
              What&rsquo;s coming
            </button>
            {mapOn ? (
              <button
                type="button"
                data-testid="board-nav-map"
                aria-pressed={view === "map"}
                onClick={() => pickView("map")}
              >
                The structure
              </button>
            ) : null}
            <button
              type="button"
              data-testid="board-nav-tip"
              aria-pressed={view === "tip"}
              onClick={() => pickView("tip")}
            >
              Ask for something new
            </button>
          </div>
          </div>
          <div className="v3-nav-row" role="group" aria-label="Settings">
            <span className="v3-nav-row-label" aria-hidden="true">Settings</span>
            <div className="v3-nav-cluster v3-nav-settings">
          <div className="v3-theme-switch" role="group" aria-label="Board theme">
            <span className="v3-theme-label" aria-hidden="true">
              Theme
            </span>
            {(
              [
                ["system", "System"],
                ["light", "Light"],
                ["dark", "Dark"],
              ] as [BoardThemeChoice, string][]
            ).map(([choice, label]) => (
              <button
                key={choice}
                type="button"
                data-testid={`board-theme-${choice}`}
                aria-pressed={themeChoice === choice}
                onClick={() => pickTheme(choice)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="v3-calm-toggle"
            data-testid="board-calm-toggle"
            role="switch"
            aria-checked={calm}
            onClick={() => {
              const next = !calm;
              setCalm(next);
              try {
                setStorageItem(STORAGE_KEYS.boardCalm, next ? "1" : "0");
              } catch {
                /* ignore */
              }
            }}
          >
            <span className="v3-calm-label">Calm mode</span>
            <span className="v3-switch-track" aria-hidden="true">
              <span className="v3-switch-knob" />
            </span>
            <span className="v3-calm-state">{calm ? "On" : "Off"}</span>
          </button>
          </div>
          </div>
          </div>
        </nav>

        {toast ? (
          <p className="v3-toast" role="status" data-testid="board-toast">
            🎉 {toast} is finished — every step in it is done.{" "}
            <button type="button" onClick={() => setToast(null)} aria-label="Dismiss">
              ✕
            </button>
          </p>
        ) : null}

        {!loaded ? (
          <p className="v3-loading">Loading what&rsquo;s coming…</p>
        ) : view === "trail" ? (
          <TrailView
            board={board}
            selectedSlug={selectedSlug}
            frontier={frontier}
            onSelect={select}
            onShowInMap={(slug) => go({ view: "map", story: slug })}
          />
        ) : view === "map" ? (
          mapOn ? (
            <Suspense fallback={<p className="v3-loading">Loading the structure…</p>}>
              <MoleculeMap
                board={board}
                layout={layout}
                selectedSlug={selectedSlug}
                onSelect={select}
                onOpenInTrail={(slug) => go({ view: "trail", story: slug })}
                scheme={scheme}
              />
            </Suspense>
          ) : (
            <TrailView
              board={board}
              selectedSlug={selectedSlug}
              frontier={frontier}
              onSelect={select}
              onShowInMap={(slug) => go({ view: "map", story: slug })}
            />
          )
        ) : (
          <section className="v3-tip" aria-label="Ask for something new">
            <FeatureRequestForm />
          </section>
        )}

        {/* The shared shell footer (PR 3 Step 3.2): the board's own
            ask stays as the footer's lead, word for word; the shared
            route links and kids-privacy note follow it. */}
        <SiteFooter
          lead={
            <>
              <p className="v3-footer-lead">Didn&rsquo;t find your idea here?</p>
              <button type="button" className="v3-btn" onClick={() => go({ view: "tip" })}>
                Ask for something new
              </button>
            </>
          }
        />
      </div>
    </main>
  );
}
