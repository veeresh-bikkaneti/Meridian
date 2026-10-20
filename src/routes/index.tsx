import { createFileRoute } from "@tanstack/react-router";
import { GameApp } from "@/components/game-app";
import { BootSplash } from "@/components/boot-splash";

// Why `ssr: false` + `pendingComponent` (the React #418 fix):
//
// The GitHub Pages build prerenders an SPA "shell" that renders only
// the root route — this route's outlet is an empty Suspense boundary
// in the served HTML, by framework design. On the client, whether
// this match's code-split chunk had finished loading by the time
// hydration rendered decided what the client painted into that
// boundary: still-loading matched (empty), already-loaded painted
// GameApp's splash — and React threw #418 and discarded the whole
// prerendered tree whenever the chunk won the race.
//
// `ssr: false` is the router's own tool for a match like this: the
// client wraps it in a ClientOnly boundary that renders the fallback
// during hydration and swaps in the real component right after
// mount, so chunk timing can no longer cause a mismatch — in the
// Pages shell or the live SSR build. `pendingComponent` keeps the
// first paint identical to before: the game's boot splash (shared
// with GameApp in boot-splash.tsx) is what the fallback paints, in
// the served HTML and during any pending moment. One consequence to
// know before extending this route: `ssr: false` also makes any
// future loader or `beforeLoad` added here client-only — it would
// run in the browser after mount, never on the server. The game itself is
// untouched — GameApp still shows the same splash until its ready
// gate opens, then the home screen exactly as before.
export const Route = createFileRoute("/")({
  component: Home,
  ssr: false,
  pendingComponent: BootSplash,
});

function Home() {
  return <GameApp />;
}
