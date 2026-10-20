import { BRAND } from "@/game/brand";

/**
 * The boot splash — the very first thing a player sees: the brand
 * wordmark on a quiet page while the game gets itself ready.
 *
 * This one component is shared by the two places that paint it, and
 * they MUST stay the same markup, because both can end up as the
 * served HTML a browser hydrates against:
 *
 * - `GameApp` renders it until its `ready` gate opens (the splash is
 *   the game's first client render too).
 * - The index route uses it as its `pendingComponent`. The index
 *   route is `ssr: false` (see `src/routes/index.tsx` for why), so
 *   the router paints this splash as the match's fallback in the
 *   served HTML — including in the GitHub Pages SPA shell, whose
 *   prerender only renders the root route — and swaps in the real
 *   game right after hydration.
 *
 * Before this was shared, the shell's copy of the splash slot was an
 * empty Suspense boundary while the client raced to render the real
 * splash into it during hydration — that race was React error #418.
 */
export function BootSplash() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-end px-5 py-10">
      <p className="text-sm tracking-wide text-muted uppercase">Daily geography</p>
      <h1 className="mt-2 font-display text-5xl text-fg">{BRAND.name}</h1>
    </main>
  );
}
