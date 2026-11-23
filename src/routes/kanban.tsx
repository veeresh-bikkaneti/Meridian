import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useState } from "react";
import { PageShell } from "@/components/ui/page-shell";
import { isEnabled, loadFlags } from "@/lib/flags";

const KanbanView = lazy(() =>
  import("@/build-board/kanban-view").then((m) => ({ default: m.KanbanView })),
);

/**
 * /kanban — the build board: the internal, live Kanban of the 45
 * handover work items (Option A mockup; owner rulings 2026-11-23).
 *
 * Hidden three ways, by ruling: behind the buildKanban flag
 * (default off — the route renders only its not-available shell
 * until the deployed flags.json turns it on), noindexed here in
 * head(), and absent from public/sitemap.xml and every nav and
 * footer link set. The home control is the shared shell's brand
 * lockup ("Meridian home"), as everywhere.
 *
 * The page sits in the shared PageShell (round 2): the route owns
 * the shell in both flag states, and neither the route nor the
 * view renders a page-local <main>. PageShell renders no <main>
 * landmark today — that gap is Phase 2's first-PR decision
 * (prompt 03), noted in the PR body; it is not worked around here.
 *
 * The view itself is lazy: the board's data and styles ride in
 * their own chunk and never touch the entry bundle. The flag read
 * follows the flags.ts contract — the baked-in default answers
 * first, then loadFlags() re-checks once the deployed payload has
 * spoken.
 */
export const Route = createFileRoute("/kanban")({
  head: () => ({
    meta: [
      { title: "Build board — Meridian" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: KanbanPage,
});

function KanbanPage() {
  const [on, setOn] = useState(() => isEnabled("buildKanban"));

  useEffect(() => {
    let active = true;
    void loadFlags().then(() => {
      if (active) setOn(isEnabled("buildKanban"));
    });
    return () => {
      active = false;
    };
  }, []);

  if (!on) {
    return (
      <PageShell header={{ to: "/", status: null, mute: null }} width="wide">
        <h1>Build board</h1>
        <p>This page is not available.</p>
      </PageShell>
    );
  }

  return (
    <PageShell header={{ to: "/", status: null, mute: null }} width="wide">
      <Suspense fallback={null}>
        <KanbanView />
      </Suspense>
    </PageShell>
  );
}
