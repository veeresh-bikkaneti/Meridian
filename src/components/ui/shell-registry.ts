/**
 * Shell registry (PR 3 Step 5): every route and screen in the app,
 * the shell it renders, and — where it does not — the registered
 * reason. The registry test (shell-registry.test.ts) checks this
 * list against the real sources and against the files on disk, so a
 * new screen cannot quietly skip the shell: it either renders
 * PageShell / SiteHeader (the ErrorScreen family counts — it frames
 * itself with SiteHeader, or in embedded mode is a panel inside a
 * screen that does), or it is named here as the one sanctioned
 * exception, or it sits on the shrink-only baseline below.
 *
 * - `exception` (header): the in-run globe HUD only (owner item 10,
 *   2026-11-17). It is a game overlay, not a page; its Home control
 *   was approved in Round 2. Any second header exception fails the
 *   test.
 * - `baseline` (header): screens that predate the shell and have not
 *   been adopted yet (loading states, the router error page, the
 *   challenge menu). The test freezes this list: it may only shrink,
 *   and a cured screen leaves it in the same change that adopts the
 *   shell.
 * - `footer: "exception"`: none remain. The Why Learn picker was
 *   the one exception (it rendered SiteFooter only while its host
 *   passed the grown-ups callback); the footer standardization
 *   (2026-11-18) closed it — the picker renders the shared footer
 *   unconditionally, and the frozen exception list below is empty.
 *   Screens with `footer: "none"` are registered no-footer screens
 *   (end-of-flow and in-game screens whose exit is the header's
 *   Home control); that is a design fact recorded per screen, not
 *   an exception list.
 * - Footer "shell" also means Grandpa's band: SiteFooter renders
 *   the coffee-run scene itself, and the registry test fails if
 *   any other file imports that scene — the band can never become
 *   a per-page copy.
 */

export type ShellKind = "PageShell" | "SiteHeader" | "ErrorScreen" | "exception" | "baseline";

export type ShellRegistryEntry = {
  id: string;
  /** Source file that renders the screen (repo-relative). */
  file: string;
  header: ShellKind;
  /** Source needle that proves the shell render; required unless
   *  the header kind is "exception" or "baseline". */
  needle?: string;
  footer: "shell" | "none" | "exception";
  /** Footer needle; required when footer is "shell" and the shell
   *  is not PageShell (PageShell renders SiteFooter itself). */
  footerNeedle?: string;
  reason?: string;
};

export const SHELL_REGISTRY: readonly ShellRegistryEntry[] = [
  // Routes
  { id: "home", file: "src/components/game-app.tsx", header: "SiteHeader", needle: "<SiteHeader", footer: "shell", footerNeedle: "<SiteFooter" },
  { id: "board", file: "src/routes/board.tsx", header: "SiteHeader", needle: "<SiteHeader", footer: "shell", footerNeedle: "<SiteFooter" },
  { id: "kanban", file: "src/routes/kanban.tsx", header: "PageShell", needle: "<PageShell", footer: "shell" },
  { id: "grownups-pages", file: "src/components/grownups/info-page.tsx", header: "PageShell", needle: "<PageShell", footer: "shell" },
  { id: "root-layout", file: "src/routes/__root.tsx", header: "baseline", footer: "none", reason: "The router root layout (outlet + update toast), not a screen; screens render inside it." },
  // In-app screens
  { id: "geodetective", file: "src/game/loop/LoopScreen.tsx", header: "PageShell", needle: "<PageShell", footer: "shell" },
  { id: "cold-trail", file: "src/game/coldtrail/TrailScreen.tsx", header: "PageShell", needle: "<PageShell", footer: "shell" },
  { id: "why-learn-picker", file: "src/subjects/shared/SubjectPicker.tsx", header: "SiteHeader", needle: "<SiteHeader", footer: "shell", footerNeedle: "<SiteFooter" },
  { id: "subject-case", file: "src/subjects/shared/SubjectCase.tsx", header: "SiteHeader", needle: "<SiteHeader", footer: "shell", footerNeedle: "<SiteFooter" },
  { id: "region-list", file: "src/components/game-app.tsx", header: "SiteHeader", needle: "<SiteHeader", footer: "none", reason: "Drill-down list; the header carries Home/Back, no footer in the shipped design." },
  { id: "review-complete", file: "src/components/game-app.tsx", header: "SiteHeader", needle: "<SiteHeader", footer: "shell", footerNeedle: "<SiteFooter" },
  { id: "challenge-complete", file: "src/components/game-app.tsx", header: "SiteHeader", needle: "<SiteHeader", footer: "none", reason: "End-of-flow screen; its in-flow primary Home button is the sanctioned end surface." },
  { id: "pool-error", file: "src/components/game-app.tsx", header: "ErrorScreen", needle: "<ErrorScreen", footer: "none", reason: "Failure branch; ErrorScreen frames itself with SiteHeader and its two exits." },
  { id: "map-error-boundary", file: "src/components/map-error-boundary.tsx", header: "ErrorScreen", needle: "ErrorScreen", footer: "none", reason: "ErrorScreen in embedded mode: a panel inside a screen that already carries the shell (PR 3 Step 3.9)." },
  // The one sanctioned header exception (owner item 10, 2026-11-17).
  { id: "in-run-hud", file: "src/components/game-app.tsx", header: "exception", footer: "none", reason: "The in-run globe HUD is a game overlay, not a page; its Home control was approved in Round 2. Sole sanctioned shell exception." },
  // Shrink-only baseline: not yet adopted, named so the test can
  // fail if this list ever grows.
  { id: "challenge-menu", file: "src/components/game-app.tsx", header: "baseline", footer: "none", reason: "Challenge-a-friend region picker: a hand-placed HomeButton over a <main>, not yet adopted. Baseline, shrink-only." },
  { id: "session-loading", file: "src/components/game-app.tsx", header: "baseline", footer: "none", reason: "Transient loading fallback; it reserves the destination's header space by design. Baseline, shrink-only." },
  { id: "region-loading", file: "src/components/game-app.tsx", header: "baseline", footer: "none", reason: "Transient chunk-loading state while a region's places load. Baseline, shrink-only." },
  { id: "boot-splash", file: "src/components/boot-splash.tsx", header: "SiteHeader", needle: "<SiteHeader", footer: "shell", footerNeedle: "<SiteFooter", reason: "Boot gate splash. It renders the shared frame (SiteHeader, narrow PageColumn, SiteFooter) directly — the same frame PageShell renders — so the first-paint module does not also import PageShell." },
  { id: "router-error", file: "src/lib/error-component.tsx", header: "baseline", footer: "none", reason: "The router's own error page, outside GameApp. Baseline, shrink-only." },
];

/** The frozen shrink-only lists: the test compares the registry
 *  against these, so adding an exception or a baseline entry fails
 *  until a person edits this record on purpose, in review. */
export const HEADER_EXCEPTIONS: readonly string[] = ["in-run-hud"];
export const FOOTER_EXCEPTIONS: readonly string[] = [];
export const HEADER_BASELINE: readonly string[] = [
  "challenge-menu",
  "region-loading",
  "root-layout",
  "router-error",
  "session-loading",
];

export function validateRegistry(
  entries: readonly ShellRegistryEntry[],
  sourceOf: (file: string) => string | null,
  mainFiles: readonly string[],
): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const e of entries) {
    if (ids.has(e.id)) problems.push(`${e.id}: duplicate registry id`);
    ids.add(e.id);
    const src = sourceOf(e.file);
    if (src === null) {
      problems.push(`${e.id}: file ${e.file} does not exist`);
      continue;
    }
    if (e.header === "exception" || e.header === "baseline") {
      if (!e.reason) problems.push(`${e.id}: ${e.header} entry needs a reason`);
    } else {
      if (!e.needle) problems.push(`${e.id}: shell entry needs a needle`);
      else if (!src.includes(e.needle)) problems.push(`${e.id}: ${e.file} does not render ${e.needle}`);
      if (e.header === "PageShell" && !src.includes("<PageShell")) problems.push(`${e.id}: not on PageShell`);
    }
    if (e.footer === "shell" && e.header !== "PageShell") {
      if (!e.footerNeedle || !src.includes(e.footerNeedle)) problems.push(`${e.id}: footer is "shell" but ${e.file} does not render ${e.footerNeedle ?? "SiteFooter"}`);
    }
    if (e.footer === "exception" && !e.reason) problems.push(`${e.id}: footer exception needs a reason`);
  }
  const headerExceptions = entries.filter((e) => e.header === "exception").map((e) => e.id);
  if (JSON.stringify([...headerExceptions].sort()) !== JSON.stringify([...HEADER_EXCEPTIONS].sort())) {
    problems.push(`header exceptions changed: ${headerExceptions.join(", ")} (frozen: ${HEADER_EXCEPTIONS.join(", ")})`);
  }
  const footerExceptions = entries.filter((e) => e.footer === "exception").map((e) => e.id);
  if (JSON.stringify([...footerExceptions].sort()) !== JSON.stringify([...FOOTER_EXCEPTIONS].sort())) {
    problems.push(`footer exceptions grew or changed: ${footerExceptions.join(", ")} (frozen: ${FOOTER_EXCEPTIONS.join(", ")})`);
  }
  const baseline = entries.filter((e) => e.header === "baseline").map((e) => e.id);
  if (JSON.stringify([...baseline].sort()) !== JSON.stringify([...HEADER_BASELINE].sort())) {
    problems.push(`header baseline grew or changed: ${baseline.join(", ")} (frozen: ${HEADER_BASELINE.join(", ")})`);
  }
  // Completeness: every file that renders a <main> must be registered.
  const registeredFiles = new Set(entries.map((e) => e.file));
  for (const f of mainFiles) {
    if (!registeredFiles.has(f)) problems.push(`${f}: renders a <main> but has no registry entry — adopt the shell or register it`);
  }
  return problems;
}
