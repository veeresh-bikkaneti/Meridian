# 2026-10-21 review — P0–P2 remediation

Branch: `fix/review-p0-p2-kids-privacy-ux` (from `main` @ `157d215`, the live build).
Scope: the P0 privacy, P1 functional/UX, and P2 hardening findings from the
2026-10-21 review, plus the owner decisions made while the work was in
progress (recorded below).

## Owner decisions taken during this branch

1. **Analytics: COPPA first.** Google Analytics (gtag, `G-NYKKMLQSN5`,
   `VITE_GA4_MEASUREMENT_ID`) and Microsoft Clarity (`ytspaudpvs`,
   `VITE_CLARITY_PROJECT_ID`) are **removed entirely**, not consent-gated.
   *Rationale:* Meridian is directed to children, so every visitor is
   treated as a child. GA sets cookies and identifiers, and Clarity
   records sessions. A grown-up consent toggle would still put third-party
   trackers in front of a child audience, and the "consent" would come
   from whoever tapped it on a shared family device. The only analytics
   left is **Cloudflare Web Analytics**: cookieless, no localStorage,
   aggregate counts only, and injected **only** when the build sets
   `VITE_CF_BEACON_TOKEN`. No consent UI is needed because nothing is
   stored on the device.
2. **Crash telemetry coarsened.** Outbound reports no longer carry
   `deviceMemory` or `hardwareConcurrency`. Exact `screenW`/`screenH` became
   a short-side bucket (`sm`/`md`/`lg`/`xl`) and DPR is rounded. This
   applies to the app (`coarseDeviceFacts`) and the inline boot watchdog.
   Crash triage only ever used the os/form buckets, and the extra numbers
   were fingerprint entropy.
3. **No email address on the privacy page.** Grown-ups use a **Contact us**
   page (`/contact`) that sits behind the existing grown-up math gate.
4. **Contact delivery parked, scaffolding only.** The contact handler
   (`src/lib/contact/contact-handler.server.ts`) sends messages through a
   `ContactSink` interface.
   The default is `NoopSink`, which accepts a message, stores nothing, and
   returns `stored:false` so the page can say nobody can read it yet.
   `DiscordWebhookSink` is wired only when the secret
   `CONTACT_DISCORD_WEBHOOK_URL` is set. No URL is hard-coded.
5. **No third worker; contact and crash stay separate.** The owner runs
   two Cloudflare workers, `meridian` (the site) and
   `meridian-crash-report`. The contact endpoint is the TanStack server
   route **`/api/contact` on the main `meridian` worker**
   (`src/routes/api/contact.ts`), not a new worker. An earlier
   `workers/contact/` scaffold was removed before commit. Separation
   from crash reporting is kept by secret name and code path instead:
   contact reads only `CONTACT_DISCORD_WEBHOOK_URL` (on `meridian`),
   while crash reporting reads `DISCORD_WEBHOOK_URL` (on
   `meridian-crash-report`). They post to different channels and share no
   module. A unit test proves `readContactEnv()` ignores
   `DISCORD_WEBHOOK_URL` even when it is set.

## What changed

### P0 — Privacy
| # | Finding | Change |
| --- | --- | --- |
| 1 | Microsoft Clarity loaded | Removed from `__root.tsx`, `vite-env.d.ts`, and `pages.yml`. A test bans it from the shell |
| 2 | GA loaded by default on a kids' product | GA removed entirely (decision 1). The optional Cloudflare beacon is in `src/lib/web-analytics.ts`, which validates the token |
| 3 | No privacy policy | `/privacy` route covers no accounts or personal questions, every visitor treated as a child, no analytics cookies or identifiers, Cloudflare/GitHub hosting, Esri tiles seeing the IP, first-party crash reports (per-session ID + coarse buckets), local-only game storage, outbound links, and the gated contact form. It is linked from the home footer and the For grown-ups card |

### P1 — Functional / UX
| # | Finding | Change |
| --- | --- | --- |
| 4 | PWA hardcoded `/Meridian/` (broken on the Cloudflare `/` build) | `manifest.webmanifest` uses `./` for scope/start_url and omits `id` (review follow-up: a relative `id` resolves against the origin, so `"./"` became the github.io root; with no `id` it defaults to the resolved `start_url`). `sw.js` derives `BASE` from its own URL. `scripts/pwa-base-path.test.mjs` runs the SW under both bases |
| 5 | "Begin exploring" only scrolled | It now starts a Globe expedition at the difficulty picked above it, through the same path as the Globe card. The nav buttons still scroll |
| 6 | Easy pulled obscure GeoNames suburbs | `src/game/easy-curation.ts` builds the Easy pool in rungs: curated starters + tier-1 places with a verified history hook → all tier-1 → the full 1–2 band, falling back only below 25 places. Every pool decision goes through `dealingPoolFor`. Documented in `docs/scoring-difficulty-contract.md` |
| 7 | Scout forced too aggressively | A 2 GB `deviceMemory` reading no longer demotes a device whose WebGL probe passes cleanly. ≤ 1 GB still demotes, and the crash/probe/contextlost safety nets are unchanged. Documented in `docs/scout-offer-policy.md` |

### P2 — Hardening
| # | Finding | Change |
| --- | --- | --- |
| 8 | No security headers | `public/_headers` sets CSP, XFO DENY / `frame-ancestors 'none'`, Referrer-Policy, Permissions-Policy, nosniff, COOP, and HSTS. See `docs/security-headers.md` |
| 9 | Caching | Hashed `/assets/*` are immutable. Fixed-name assets, `sw.js`, `flags.json`, and the manifest revalidate. HTML uses `max-age=0, s-maxage=60` |
| 10 | Parent-gate cooldown could be dodged by closing and reopening | Failed attempts persist for 15 min (`meridian.grownupStrikes.v1`), so 3 strikes start the 60 s cooldown across remounts. The gate already required a correct answer |
| 11 | No way back to the tour after "Not now" | A "🗺️ Take the tour" footer button is always available |

### Contact form (new)
- `/contact` route: math gate, then topic dropdown (privacy question / delete my data / bug / other), message (≤ 1000 chars), and an optional reply-to labelled "for grown-ups only". It shows a visible note asking kids not to type names, addresses, or other personal details, and includes a hidden honeypot.
- Client model: `src/lib/contact/contact-form.ts`. The endpoint comes from `flags.json` `contactEndpoint` (null until switched on, and the page says so).
- Server: `src/lib/contact/contact-handler.server.ts`, mounted at `POST /api/contact` by `src/routes/api/contact.ts` on the main worker. It validates, caps the body at 4 KB, and rate-limits with salted-hash IP keys: 3 per 10 min per client and 60/h per isolate. The raw IP is never stored, logged, or forwarded. Unknown fields are rejected, a filled honeypot gets a silent 200, and logs record topic + outcome only. CORS allows same-origin, plus the GitHub Pages mirror (`https://veeresh-bikkaneti.github.io`) or `CONTACT_ALLOWED_ORIGINS`, and never `*`.
- The GitHub Pages mirror is static, so it has no `/api/contact` of its own. It posts cross-origin to the worker's absolute URL, which is why `contactEndpoint` is a full https URL rather than a root-relative path.
- The `.server.ts` handler is server-only. A `build:pages` client bundle grep for `CONTACT_DISCORD` / `handleContactRequest` comes back empty.

## Deploy TODOs for the owner (none are done by this branch)

1. **Cloudflare Workers Builds env:** delete `VITE_GA4_MEASUREMENT_ID` and
   `VITE_CLARITY_PROJECT_ID` from the `meridian` build settings. They are now
   ignored, but should not linger. Optionally add `VITE_CF_BEACON_TOKEN`
   after enabling Web Analytics for the site. Do the same in GitHub
   Actions secrets.
2. **Verify headers** after the next deploy (commands in
   `docs/security-headers.md`). If they are missing, the build is not
   served as static assets, and the headers must move into the game worker.
3. **Switch the contact form on:** the route ships with the normal
   `meridian` deploy, and nothing new needs uploading. Check after
   deploy: `curl -i -X POST https://meridian.knowledgetest.workers.dev/api/contact -H 'content-type: application/json' -d '{"topic":"bug","message":"test"}'`
   should return `200 {"ok":true,"stored":false}`. Then add
   `"contactEndpoint": "https://meridian.knowledgetest.workers.dev/api/contact"`
   to `public/flags.json`. Until then, the form says it is not switched on.
   `readContactEnv()` reads `process.env`, which on Workers needs
   `nodejs_compat` with a compatibility date ≥ 2025-04-01 (or
   `nodejs_compat_populate_process_env`). Without it the handler falls
   back to `NoopSink`, which fails safe. Optional: set
   `CONTACT_ALLOWED_ORIGINS` if a custom domain replaces the Pages origin.
4. **Contact delivery (when a Discord server exists):** create a **new**
   channel and webhook, then set it as the secret
   `CONTACT_DISCORD_WEBHOOK_URL` on the **`meridian`** worker
   (`wrangler secret put CONTACT_DISCORD_WEBHOOK_URL --name meridian`, or
   the dashboard). Never reuse the crash worker's `DISCORD_WEBHOOK_URL`,
   and never put that name on `meridian`. Update the privacy page's
   contact paragraph in the same change.
5. **Crash worker:** no change needed. It accepts the coarser device
   object as-is (only `os`/`form` are read).

| Secret | Worker | Purpose |
| --- | --- | --- |
| `DISCORD_WEBHOOK_URL` | `meridian-crash-report` | crash alerts and digests (existing) |
| `CONTACT_DISCORD_WEBHOOK_URL` | `meridian` (main site, `/api/contact`) | grown-ups contact messages (new, optional, separate channel) |
| `CONTACT_ALLOWED_ORIGINS` | `meridian` | optional comma list of cross-origin callers. Default is the GitHub Pages origin |

## Overlap with PR #203 (perf, F1 immutable caching)

PR #203 also adds `public/_headers`, containing only the `/assets/*`
immutable rule and three detach-only carve-outs. This branch aligned its
`/assets` blocks to be **text-identical** to #203's. It had used a
wildcard `! Cache-Control` + set-line pair, which #203 rightly avoids
because Cloudflare comma-joins duplicate headers across matching rules.
Merge plan for whichever PR lands second:

1. Keep one file. Use #203's long header comment for the `/assets` section
   (it cites the Cloudflare docs), and keep this branch's CSP comment above `/*`.
2. Keep this branch's `/*` security block. #203 has no equivalent.
3. Keep the shared `/assets/*` + three carve-out blocks once (already identical).
4. Keep this branch's `no-cache` blocks (`/sw.js`, `/flags.json`,
   `/build-meta.json`, `/manifest.webmanifest`) and the HTML `s-maxage=60`
   blocks. None of them overlaps an `/assets` path, so nothing comma-joins.
   #203's comment says these paths "keep the platform default". Edit that
   sentence to point at the explicit blocks.
5. Run `node --test scripts/security-headers.test.mjs` plus #203's own
   header test, if it has one.

## Remaining (P3+, not in this branch)

- CSP still allows `'unsafe-inline'` scripts. Move to hashes or nonces for
  the hydration payload, watchdog, and nosw hatch.
- Contact delivery target (decision 4), and a retention policy once a
  real sink exists.
- The Easy Globe pool is limited to places with history hooks. Big world
  cities that the Globe tier files lack, or that lack a hook (e.g. Lagos,
  Moscow), need curation or fact-ladder hooks to join it.
- The full COPPA notice requirements (operator name and postal contact)
  need the owner's decision on what to publish, given the no-email ruling.
- E2E coverage for `/privacy`, `/contact`, Begin exploring, and the tour
  re-entry (unit-covered here; Playwright specs were not added).
- Rate limiting is in-memory per isolate (and per instance of the main
  worker). Use a Durable Object or
  Cloudflare rate-limiting binding if abuse appears.

## Addendum: footer kids-privacy note (owner request, 2026-10-21)

The home footer now carries a one-line promise linking to `/privacy`:
"Made for kids: no accounts, no ads, no tracking cookies, and no personal
information collected."

It deliberately does **not** say "COPPA compliant". Compliance is a legal
determination that no one (for example an FTC-approved Safe Harbor such as
kidSAFE or PRIVO) has certified, and an unqualified claim on a child-directed
site is itself a deceptive-practice risk. Factual statements are safe as long
as they stay true, so:

- If analytics, ads, accounts, or any data collection are ever added, update
  this line and `/privacy` in the same PR.
- `tests/e2e/grownups-privacy-contact.desktop.spec.ts` asserts the note is
  visible, mentions tracking cookies, and never contains the word "compliant".
- If the project later earns a Safe Harbor certification, the note can name it.
