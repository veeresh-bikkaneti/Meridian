# Meridian Product & Decision Handbook — 07 · Engineering & ops

> The technical spine of the product: what it's built with, how code ships safely, what breaks and how we know, and the operational traps that have bitten before. New engineers and agents: read 06 first for the *why*, then this page for the *how*.

---

## 1. The stack

- **App:** Vite + React + TypeScript — client-heavy single-page app. Homepage route (`src/routes/index.tsx`) renders `<GameApp />`; the home screen is the `Choose` component in `src/components/game-app.tsx`.
- **Map:** MapLibre GL on satellite tiles, with a lighter **Scout Map** fallback for weak GPUs and tile failures (see 06 §4).
- **Hero globe (v5):** Three.js `@0.160.0` as a **lazy chunk** — dynamic import only when the hero scrolls near (IntersectionObserver), DPR capped at 1.5, no post-processing, static fallback on reduced-motion / Save-Data / WebGL failure, full disposal on unmount.
- **Hosting (dual):** Cloudflare Workers (`meridian.knowledgetest.workers.dev`) **and** GitHub Pages. The production build is `npm run build:pages` → `dist/client`, served under the `/Meridian/` base.
- **Flags:** static `public/flags.json` + `src/lib/flags.ts` (see §2).
- **Tests:** node test runner for unit suites; Playwright for E2E against the built artifact via `serveBuiltArtifact` (route-interception serving `dist/client` at `http://127.0.0.1:4123/Meridian/` — see `tests/e2e/helpers.ts`).

---

## 2. Feature flags — and their one purpose

**Veeresh, 2026-10-03: feature flags exist for exactly one reason — experimental work must not break production code.** Every experimental track merges behind a flag, disabled in production until proven.

The mechanism is deliberately zero-cost: a versioned `public/flags.json`, a tiny `src/lib/flags.ts`, one network-first rule for `flags.json` in `public/sw.js`. No vendor, no SDK, no new dependencies.

| Flag | Repo default | Off behavior | Production state |
|---|---|---|---|
| `pwaUpdateToast` | `true` | Unregisters any live SW; plain web app, no update toast | on |
| `learningOutcomes` | `false` (code default in `flags.ts`) | No learning records, no growth UI | **on** — flipped by owner decision 2026-10-04 (PR #45, config-only); the shipped `public/flags.json` carries `true` |
| `globeTierSplit` | `false` | Globe loads all five fame-tier files, deals the full canonical pool | **on** (shipped live by PR #148) |

Rules every engineer must internalize (`docs/feature-flags.md`):

1. **The default must equal current production behavior — always.** Reviewers reject any flag whose default changes prod.
2. **Kill-switches gate before initialization** — they await the shared `loadFlags()` promise; remote off wins the boot race deterministically.
3. **Remote off = safe fallback**, never a broken app.
4. **Boot-time, not reactive.** Gated systems read the flag once per boot; there are no mid-game surprises. A kill decision takes effect on the *next* boot.
5. **Fail closed everywhere:** unknown flags, bad payloads, fetch failures all silently keep the baked-in defaults.

---

## 3. Quality gates (all mandatory for every PR)

From the repo's `AGENTS.md`:

1. `npx tsc --noEmit` — clean
2. `npm test` — full unit suite green. Report BOTH suite totals per run — counts rot with every test-adding PR, so no frozen number is the standing baseline. Measured at `f331846` (2026-10-17): scripts suite 799 tests (790 pass, 9 skipped, 0 fail); src suite 1351 tests (1351 pass, 0 fail).
3. `node scripts/lint-cards.mjs` — must print **GATE PASSED** (card-content lint: locked copy, story rules, no hardcoded keys)
4. `npm run build:pages` — production build green
5. **Playwright E2E** — `tests/e2e/` specs against the *built artifact*, never dev mode

Standing rules around those gates:

- **Chitti always runs E2E live for PR reviews** — panel code review alone is never enough (Veeresh's "Yes always", 2026-10-12; hardened to include live *visual* E2E: real browser, screenshots, multiple viewports).
- **Verify, don't trust builder claims** — Veeresh: "we don't trust what they did and that why we need to review." PR bodies are hypotheses; independently inspect code, tests, consumers, dead exports, conflicts, and UI behavior.
- **Baseline against unmodified main** to separate regressions from pre-existing failures (grandpa-tasting-tour needs `VITE_KOFI_URL` set at build AND test time, or the spec throws at load — record this with any grandpa number).
- **Stage named files only** — never `git add -A` (orphaned temp dirs have been swept into commits before).

---

## 4. Crash reporting — always-on production monitoring

**Veeresh, 2026-10-10: the pipeline must be receivable any time a user hits a problem.** Game → Worker → Discord is verified live.

- **Worker:** `meridian-crash-report` at `https://meridian-crash-report.knowledgetest.workers.dev` (`/health`, `/ingest`). `npm run smoke:crash` exercises it (4/4). The receiver (`meridian-crash-report`) is a Cloudflare Worker deployed as a separate, explicit step — repo docs prescribe `wrangler deploy` from `worker/observability/`. The game worker (`meridian`) deploys through Workers Builds on main. A separate record (2026-10) describes manual `version_upload` deployments of the crash receiver — that conflict needs Veeresh's one-line confirmation.
- **Event model** (`docs/observability.md`): field crashes on phones are usually *process kills* (jetsam) — no JS error fires. So the app keeps a **breadcrumb trail** in `sessionStorage` (last 12 milestones: boot → map ready → game loaded) and detects the crash by **asymmetry at next boot** (dirty clean-exit flag + a previous breadcrumb → one `suspected_crash` event carrying the previous trail).
- Event types: `suspected_crash`, `js_error`, `unhandled_rejection`, `map_error`, `webgl_context_lost`, `tile_failed`.
- **Privacy:** no PII, no coordinates, no guess content, no stack traces — error name + message only, truncated; per-tab random session id; client hard-caps events at 4096 bytes. Delivery is at-most-once; with no endpoint configured the emitter is a complete no-op.
- The endpoint is configured via a top-level `observabilityEndpoint` field in `flags.json` (not the flags map), so it flips on a static deploy with no client release.
- **OPEN:** Resend API key + report email still not set. **CORS `*` accepted** (no cookies/auth involved).

---

## 5. Analytics — COPPA-safe by default

- **GA4** for usage stats, on a COPPA-safe configuration: no ad personalization, IP anonymization, no cross-site tracking. Nothing leaves the phone for the learning-outcome measurement (client-side only).
- **No hardcoded IDs/keys in source.** GitHub Actions secrets inject them at build time: `VITE_GA4_MEASUREMENT_ID`, `VITE_CLARITY_PROJECT_ID`, `VITE_KOFI_URL`. Components **fail closed** when unset.
- Measurement scope (what gets tracked long-term) is still undecided — OPEN.

---

## 6. Branch protection and the merge traps

Main's protection is currently: required contexts **`build (22.x)`** + **GitGuardian Security Checks**, **0 required approvals**, dismiss-stale-reviews on — kept as-is **on Veeresh's explicit order** ("keep everything as-is", 2026-10-15). Do not "improve" it without his word.

Three traps have blocked real merges. Know them all:

1. **Unattributed-commits approval (ruleset 24141972 "protect main").** If any commit on the PR is *not authored by the PR author*, the ruleset demands an extra approval — and the owner **cannot approve his own PR**. The cure: author commits as Chitti with Veeresh's account email (`57240576+veeresh-bikkaneti@users.noreply.github.com`) so they attribute to his account (account id **57240576**). Lifting the ruleset to get past this was done for #148 and #158, each time on the owner's explicit say-so for that merge. Never lift, disable, or change branch protection or a ruleset without the owner's explicit approval for that specific merge. If you are blocked, stop and ask him.
2. **Required-check name drift.** The stored context name must match the real CI job name (`build (22.x)`), or merges 422 with "Required status check is expected". Check for drift before every merge; report it to Veeresh and get his word to correct the stored name.
3. **`Workers Builds: meridian` fails on every branch commit** — this is a branch-preview configuration artifact, not a code problem. It succeeds on main commits. Ignore on branches; verify green on the merge commit.

Also: **squash is the merge convention**; open the branch and push early/often; delete merged branches; rebase later PRs after earlier merges preserving the test-wrapper entries; **never merge PR #34** (permanent DO NOT MERGE).

---

## 7. Known pre-existing issues (not regressions — do not "fix" them inside feature work)

- **React error #418 (hydration mismatch) on slow boots** — found 2026-10-16 via a throttled-boot test (Slow-4G + 4× CPU). It fires on *every* throttled boot — proven on **unmodified main 2/2 and on a feature branch 3/3** — so it is pre-existing. The app recovers (React client-renders), but the prerender benefit is lost on exactly the slow connections that need it, and it's likely noise in the crash pipeline from real slow users. **Needs its own fix branch** (suspect: prerender-vs-client first-render divergence).
- **A `tapstart.desktop` E2E flake family of ~7–8 failures** that flips run-to-run under load — pre-existing on unmodified main; always baseline on main before adjudicating (re-measured 2026-10-17). Belong on their own fix branch.
- **Vacuous opacity regex** in the entering-tap E2E spec family (open nit from #152).
- **`mobile-home-overlap` fails on pristine main too** — environment-broken in this VM, not a branch defect.
- **Stale `node_modules` shows 3–4 phantom tsc/test errors** (missing `react-test-renderer`); identical on main. Cure: fresh `npm ci`.

---

## 8. Secrets hygiene

- No hardcoded IDs, keys, tokens, or webhooks in source — ever. The lint gate helps; the review culture enforces it.
- GitHub Actions secrets carry build-time IDs (see §5).
- **Old GitHub PATs pasted in earlier chats should be revoked** (GitHub Settings → Developer settings → PATs) — still **unconfirmed**. The temporary course-repo deploy key should be removed — still **unconfirmed**. A Discord webhook pasted in chat should be rotated — still **unconfirmed**.
- Never reproduce, store, or echo a secret value — in chat, logs, files, or memory.

---

## 9. Architecture

```mermaid
flowchart LR
    subgraph Player
        Browser[Player browser<br/>(Vite React app)]
    end
    subgraph "Deploy & hosting"
        GH[GitHub repo<br/>main branch]
        Actions[GitHub Actions<br/>CI + build:pages]
        Pages[GitHub Pages<br/>static host]
        WB[Cloudflare<br/>Workers Builds]
        Worker[meridian worker<br/>meridian.*.workers.dev<br/>stamped meridian-&lt;sha&gt;]
    end
    subgraph Observability
        CrashW[meridian-crash-report<br/>/health · /ingest]
        Discord[Discord<br/>crash channel]
    end
    subgraph "Flags (static)"
        Flags[public/flags.json<br/>network-first via SW]
    end

    GH --> Actions --> Pages
    GH --> WB --> Worker
    Browser --> Pages
    Browser --> Worker
    Flags --> Browser
    Browser -->|sendBeacon/fetch<br/>at-most-once, no PII| CrashW --> Discord
```

*Diagram in words: the player's browser runs the prerendered app, reads flags.json network-first through the service worker, and sends crash breadcrumbs at-most-once to the separate crash-report worker, which forwards events to Discord; GitHub is the source, Cloudflare serves it.*

Live check: fetch `https://meridian.knowledgetest.workers.dev/sw.js` and read the `meridian-<sha>` stamp — that is ground truth for which build is actually serving.

---

## Sources

- Repo `AGENTS.md` (gates, stage-named-files), workspace `~/AGENTS.md` (standing rules: download audits, SkillSpector, push-early, stop-means-stop).
- `docs/feature-flags.md` — one-purpose rule (Veeresh 2026-10-03), adopter pattern, catalog, boot-time semantics.
- `docs/observability.md` — breadcrumb/next-boot crash detection, event types, privacy, endpoint config.
- `docs/scout-offer-policy.md` — Scout offer rules.
- `docs/learning-outcomes.md` — learning-outcome instrumentation design (LIVE flag `learningOutcomes` — code default off, shipped on since PR #45).
- Memory record: dual hosting, Workers deploy method, crash pipeline verification, COPPA-safe analytics, branch-protection state + merge traps (#148/#155/#157), PR #34 rule, pre-existing issues (#418 2026-10-16, tapstart ×7, stale node_modules), secrets follow-ups, review lessons (byte-level escapes, branch docs are claims).
