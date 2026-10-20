# BRANCH_STATUS.md — fix/hydration-418

## What

Fix React error **#418** (hydration mismatch) on boot. The bug is
pre-existing — proven on unmodified main since 2026-10-16, and again by
the /jury pilot on 2026-10-20 (desktop LCP 10,564 ms with the hero
headline as the LCP element). When #418 fires, React throws away the
prerendered HTML and re-renders the whole page from scratch — the
prerender is wasted on exactly the slow devices that need it most.

## Reproduction (before the fix)

Harness: serve the production `build:pages` artifact locally with
Playwright route fulfillment (the same pattern the E2E suite's
`serveBuiltArtifact` helper uses), boot it in headless Chromium,
capture console errors / pageerrors verbatim, and observe LCP via a
PerformanceObserver init script.

Results on unmodified main @ `84ac861`:

- Instant (unthrottled) boots: **#418 fired on 1 of 3 runs** —
  `Minified React error #418; args[]=HTML&args[]=` (the
  "server rendered HTML didn't match the client" variant, with an
  empty text arg). Flaky, not deterministic — a race.
- Throttled boot (artificial Slow-4G-style latency + 4× CPU):
  no #418 on the sampled run; LCP was a post-boot element
  (scout-dialog text at 7,588 ms / hero H1 at 8,704 ms).
- The /jury pilot saw the same signature: #418 on its desktop,
  hover, and reduced-motion passes, not on its throttled mobile pass.
- A dev-mode build (`NODE_ENV=development`) names the exact
  mismatch: the client renders

  ```
  <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-end px-5 py-10">
  ```

  (GameApp's boot splash — "Daily geography" / "Meridian") where the
  server left an empty `<Suspense>` boundary in its place.

## Root cause

Meridian builds two artifacts from one source:

- the **live site** — a Worker SSRs each request, and its HTML for
  `/` contains the fully rendered splash, match stream ids
  `[__root__, /]`, both `ssr: true`;
- **GitHub Pages** — a static **SPA shell** prerendered at build
  time (`tanstackStart({ spa: { enabled: true } })` in
  `vite.config.ts`, written to `dist/client/_shell.html`).

The shell is prerendered with an `X-TSS_SHELL` header
(`@tanstack/start-plugin-core` `post-build.ts`). Seeing it, the
router renders **only the root route** and dehydrates only the root
match (`matchesToDehydrate.slice(0, 1)` in router-core). The index
route's outlet is left as an **empty, already-closed Suspense
boundary** — `<!--$--><!--$--><!--/$--><!--/$-->` in the shell body.
Calling the built server handler directly (no shell header) renders
the splash and the index match correctly, so the app code itself
renders fine; the shell is root-only **by framework design**.

On the client, `StartClient` suspends on `hydrateStart()`. When the
router first renders, whether the index match already has its
component decides the outcome:

- chunk still loading → the match renders its (empty) pending state
  → matches the shell → clean hydration;
- chunk already loaded (the shell **modulepreloads** the routes
  chunk, so on a fast pipe it usually is) → the match renders the
  splash **during the hydration pass**, where the server left an
  empty boundary → React #418 → React discards the whole tree and
  re-renders from scratch.

So this is a race between route-chunk load timing and the hydration
pass, at the router-match boundary — not a content divergence.

**Ruled out** (checked, not assumed):

- The Journal clock hypothesis: GameApp renders *only* the splash
  until its `ready` state flips in an effect **after** hydration.
  The journal's `Date.now()` initializers, streak/localStorage
  reads, and the render-time date line all sit behind that gate, so
  none of them can diverge during the hydration pass.
- No app code mutates `documentElement` attributes before hydration
  (grep-verified across `src/` and `scripts/`).
- GameApp is not itself divergent: its first render is the splash on
  both sides (`ready = useState(false)`, set only in effects).

## Fix

_(filled in with the change)_

## Proof

_(filled in with the after numbers)_

## Gates

_(filled in at the end)_
