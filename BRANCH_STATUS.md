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

Three files, all at the source:

- **`src/routes/index.tsx`** — the index route now declares
  `ssr: false` and `pendingComponent: BootSplash`.
  `ssr: false` is the router's own mechanism for a match that is
  not server-rendered: the client wraps it in a `ClientOnly`
  boundary that renders the **fallback** during hydration (via
  React's server snapshot, so it cannot mismatch by construction)
  and swaps in the real component right after mount. Chunk timing
  is out of the equation, in both builds.
- **`src/components/boot-splash.tsx`** (new) — the boot splash
  ("Daily geography" / "Meridian"), extracted verbatim from
  GameApp. It is now the single source of the splash markup: the
  route's fallback paints it into the served HTML, and GameApp
  renders the same component until its `ready` gate opens, so the
  two painters can never drift apart.
- **`src/components/game-app.tsx`** — the `!ready` branch renders
  `<BootSplash />`; the now-unused `BRAND` import is removed.
  No other GameApp behavior changes.

Verified side effects, both intended:

- The Pages shell body now carries the splash inside its
  boundaries — the headline paints from the served HTML.
- The live SSR build still serves the splash for `/` (handler
  probe: 200, 3,607 bytes vs 3,590 before; the splash is now the
  route's fallback instead of GameApp's SSR render — same markup,
  same first paint).

Explicitly **not** used: no `suppressHydrationWarning`, no error
suppression, the prerender still runs and still produces the
shell. The mismatch is removed by making the served HTML and the
hydration render the same by construction.

Also in this branch: handbook ch07's #418 entry is marked FIXED
with the root cause, and a regression spec
(`tests/e2e/hydration-boot.desktop.spec.ts`) pins both halves of
the fix — the served shell must contain the splash headline, and a
full boot to the ready signal must show no #418/hydration error.
(The served-HTML half fails deterministically on the old build;
the error half was a race there and is structural now.)

## Proof

Same harness as the repro (built Pages artifact, Playwright route
fulfillment, headless Chromium, LCP via PerformanceObserver):

**Before (unmodified main @ `84ac861`):**

- Instant boots: #418 fired 1 of 3 (race).
- Throttled boot: shell body contains **no headline at all** —
  nothing paints until the client boots; hero H1 LCP 8,704 ms,
  settle 10,151 ms.
- /jury pilot (2026-10-20): #418 on desktop/hover/reduced passes;
  desktop hero LCP 10,564 ms.

**After (this branch, rebased on `a45674b`):**

- **13 harness boots, zero #418, zero console errors** — instant
  and throttled, before and after the rebase.
- Instant boots: FCP 236–588 ms; the first LCP is the splash H1
  "Meridian" in every run — painted from the served HTML.
- Throttled boots: FCP ≈ 1.25–1.30 s with the splash H1 as first
  LCP; the hero H1 (which still waits on the full game boot) lands
  at 7,644–8,108 ms vs 8,704 ms before the fix.
- Live-build handler probe: `/` still serves the splash in the
  HTML (see Fix above).

No journal 2-hour-boundary run was needed: the clock hypothesis
was ruled out before fixing (the journal renders only behind
GameApp's post-hydration `ready` gate, so build-clock vs
player-clock cannot diverge during hydration). Journal rotation
behavior is covered by the journal E2E suite below.

## Gates

All run at the rebased tip (on `a45674b`), `VITE_KOFI_URL` set at
build and test time, E2E `--workers=1` under the VM-wide lock:

- `npx tsc --noEmit` — **clean**
- `npm test` — scripts **799 (790 pass / 9 skip / 0 fail)** + src
  **1358 pass / 0 fail**
- `node scripts/lint-cards.mjs` — **GATE PASSED**
- `npm run build:pages` — **green** (shell verified to contain
  the splash)
- E2E vs the built artifact:
  - `hydration-boot.desktop.spec.ts` (new) — **pass**
  - `journal.spec.ts` + `journal-art.desktop.spec.ts` — **6/6
    pass** (rotation, 2-hour window roll, remainder set)
  - `scout-offer.desktop.spec.ts` +
    `scout-capability-offer.desktop.spec.ts` — **16/16 pass**
    (offer, fail-closed clean boot, manual override — first-visit
    flow unchanged)
  - `safari-launch.spec.ts` — the `?nosw=1` test **passes** (it
    flaked once under parallel load with a navigation race; it
    passes run alone on this branch and on main). The boot-JS
    ceiling test **fails — a pre-existing condition on
    unmodified main `a45674b`, where it fails identically;
    cause not pinned.** The 3,496,753 B total (vs the 1,800,000 B
    ceiling) was measured on this branch's `build:pages`
    artifact. Not this branch's regression; flagged for the
    owner, not fixed here (out of scope for the hydration fix).

Behavior non-regressions are covered above: journal rotation
(journal suite), streak/first-visit/scout offer (scout suites +
the boot spec), and GameApp itself is untouched apart from
rendering the shared splash component in its existing `!ready`
branch.

## Follow-ups (recorded, not built)

Panel-recommended hardening for the regression guard, deliberately
left out of this fix branch:

- A mobile twin of the regression spec (390×844), and/or a
  screenshot parity check on the splash first paint — the spec is
  desktop-only today.
- A spec pinning the **live-SSR hydration path**: the Worker build
  hydrates a fully rendered `/`, a different code path from the
  Pages shell the regression spec covers.

## Status

Ready for the owner's review pipeline. Nobody merges — the owner
merges on his word.
