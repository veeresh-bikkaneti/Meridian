# Contact activation runbook

How the parent "Contact us" form goes from **parked** to **live**, in five
gated steps. Nobody skips a step. The owner's word is needed for every merge,
deploy, dashboard change and the final flag flip.

Governing words (Veeresh, 2026-10-21): **"Adopt B — start the cure round"** —
ship the scaffolding first, deliver nothing until the chain below is proven.

## Where things stand

| Piece | State |
| --- | --- |
| `/contact` page behind the grown-up gate | added by #207 (open, not merged, as of 2026-10-21) |
| `POST /api/contact` handler (validation, 4 KB cap, honeypot, rate limit) | added by #207 (same) |
| Delivery sink | `NoopSink` until the worker has the secret. Accepts and discards. |
| `flags.json` `contactEndpoint` | absent. The form is OFF. |
| `/privacy` and the remediation record | say "parked", truthfully |

## Step 1 — Probe A1: which server entry does production serve?

Run **only after #207 has deployed from `main`** (the answer is about the code
that is live). Read-only; it sends GET requests only.

```
node --experimental-strip-types scripts/entry-fingerprint-probe.mjs \
  --url https://meridian.knowledgetest.workers.dev
```

It fetches two worker-rendered pages (`/privacy`, `/`), `/api/contact`, and a
static control (`/flags.json`) and compares their headers with
`src/lib/security-headers.ts`.

| Result | Meaning | Next |
| --- | --- | --- |
| rendered pages carry every header | `src/start.ts` middleware is live, so TanStack's start entry is serving | continue to step 2 |
| static control has the headers, rendered pages do not | the Nitro entry is serving; `start.ts` is dead code and the CSP, HSTS and friends are **not** reaching the HTML kids load | **STOP. Escalate to the owner as its own priority item**, ahead of contact wiring. Do not fold it into the wiring PR. |
| anything failed or even the control lacks the headers | inconclusive | fix connectivity or investigate, re-run. Never treat as green. |

Paste the raw report into `config/cloudflare/meridian.wrangler.toml` (the
"Probe A1 result" block) and `BRANCH_STATUS.md`. The Reality Checker re-runs
the probe independently.

## Step 2 — Wiring (this branch's PR)

What changed, and why:

- **Config is read from the worker's own env** first, not only `process.env`
  (`src/lib/contact/runtime-env.server.ts`). `process.env` only carries
  secrets under `nodejs_compat`, a flag the repo cannot see or guarantee. The
  webhook, the origin list and the rate-limit bindings now go through one
  reader. *Expected to work, not yet proven on production:* only the
  `globalThis.__env__` source is unit-tested; the `cloudflare:workers` source
  cannot run on Node. Probe A1 and the step 4 smoke are what prove it. If both
  sources fail, the sink stays noop, which fails safe and shows in the
  readiness check. `process.env` stays as a fallback (local runs, tests, preview); once
  step 1 shows which entry serves, it can be dropped on the worker.
- **Origin gate.** The live origin (`https://meridian.knowledgetest.workers.dev`)
  is on the default allowlist next to the GitHub Pages mirror, so the site's
  own form works even if the request URL the worker sees differs. Same-origin
  is still always allowed. A filled honeypot is dropped with a silent `200`
  even on a missing or refused Origin, so a bot never learns from a `403`.
  Real messages with a bad or missing Origin still get `403`.
- **Readiness cannot read as a false green.** `npm run check:contact` uses the
  same reader as the route and says whose config it checked ("this shell's
  environment, not production"). `npm run check:contact -- --url <origin>`
  asks the live worker (`GET /api/contact` → `{ "sink": "discord" | "noop" }`,
  the sink name only) and exits non-zero for parked, unreachable or
  unexpected answers.

Not changed: what the form collects, rate-limit thresholds, retention, the
gate, the `ContactSink` interface, any game code, any dependency.

Tests: `src/lib/contact/*.test.ts`, `scripts/contact-smoke.test.mjs`,
`scripts/entry-fingerprint-probe.test.mjs`. Five of the new handler tests were
shown to fail against the parked #207 code and pass on this branch (see
`BRANCH_STATUS.md`).

## What the secret exposes (read before step 3)

`Origin` is a browser-side guard: it stops other websites' pages from posting
here. Any script can set that header, so it is **not authentication**. The
moment the worker has the secret, `POST /api/contact` can deliver to Discord
for anyone on the internet who sends a valid body, **even while the form is
OFF** — `flags.json` only hides the page. What limits abuse is the rate limiter
(3 per 10 minutes per sender and 60 per hour per isolate in memory; the
binding adds a limit that is shared across isolates), the 4 KB cap,
validation, and the fenced, mention-free Discord post. A flood could fill the
private channel and push Discord's webhook limit, so real parents would then
see "could not deliver".

Recommendation (owner decision): adopt the binding-layer rate limiter
(step 3.3) **before** the secret is set, rather than treating it as optional.
If abuse still shows up, the next step is a human-check token on the form.

Also known and accepted: `GET /api/contact` tells anyone whether the worker is
wired (sink name only), and a honeypot drop looks slightly different from a
real delivery (`{ok:true}` vs `{ok:true,stored:true}`), which the smoke test
relies on.

## Step 3 — Owner configuration (the owner does this; the value stays with the owner)

The webhook URL never goes into chat, a file, a commit or a log. Names and
existence only.

1. In Discord, create a **new private channel** for parent messages and a
   webhook for it. Do **not** reuse the crash-report channel or
   `DISCORD_WEBHOOK_URL`.
2. Cloudflare dashboard → Workers & Pages → **meridian** → Settings →
   Variables and Secrets → add secret **`CONTACT_DISCORD_WEBHOOK_URL`**
   (type: Secret). Deploy when prompted.
   *Readback:* the secret name is listed (value hidden). Then
   `npm run check:contact -- --url https://meridian.knowledgetest.workers.dev`
   must print `sink selected: discord`. That proves a Discord-shaped webhook is set, not that Discord accepts it; step 4 proves that.
3. *Recommended — and best done BEFORE item 2 (see "What the secret exposes").* Adopt the binding-layer rate limiter: copy the two
   `[[ratelimits]]` blocks from `config/cloudflare/meridian.wrangler.toml`
   into the worker's wrangler config (Wrangler 4.36 or later; bindings cannot
   be added in the dashboard yet). *Readback:* none needed; the in-memory
   floor works without it.
4. **After step 4 passes:** delete the GitHub repo secret of the same name, if
   one exists. One secret, one store. *Readback:* Settings → Secrets and
   variables → Actions no longer lists `CONTACT_DISCORD_WEBHOOK_URL`.

## Step 4 — Smoke (form still OFF)

```
node --experimental-strip-types scripts/contact-smoke.mjs \
  --url https://meridian.knowledgetest.workers.dev --yes-send-real-messages [--recovery]
```

It refuses to run without `--yes-send-real-messages` and stops before sending
anything if the readiness check does not say `discord`.
Sends real messages: 2 to 3 land in the private channel, each starting
`[smoke <runid>]`. It checks, over HTTP: the readiness answer is `discord`; a
gated POST from the site's own origin is `stored: true` (true only when Discord
itself accepted the call, so a parked sink fails here); honeypot posts return a
silent `200` and are not delivered (with and without an Origin); a missing or
foreign Origin gets `403`; an over-size body gets `413`; the rate limit trips
with `429` and `Retry-After` (and, with `--recovery`, recovers).

Then **by eye in Discord**: layout is right, nobody was pinged, no link
previews, the reply-to line is present on the reply-to message, and no message
mentions "honeypot". Delete the `[smoke]` messages.

"A look-alike webhook URL fails closed" cannot be shown on a live worker
without changing its secret; it is pinned in
`src/lib/contact/contact-handler.server.test.ts` and
`scripts/contact-smoke.test.mjs`.

Any failure goes back to step 2 or 3. Never forward.

## Step 5 — The flip (owner's word only)

One line in `public/flags.json`:

```json
"contactEndpoint": "https://meridian.knowledgetest.workers.dev/api/contact"
```

Use the absolute URL: `flags.json` is shared by the production worker and the
GitHub Pages mirror, and the mirror must post cross-origin (its origin is on
the allowlist). `src/lib/flags.ts` accepts an absolute `https:` URL or a
root-relative path and rejects anything else, so a bad edit fails closed to
"form off".

**Rollback:** delete that one line and deploy. On the worker `flags.json` is
served `no-cache`, so clients pick the change up on their next load. The
GitHub Pages mirror ignores `_headers` and uses GitHub's own caching, so it can
lag by minutes. Do not delete
the secret as a rollback; remove the flag first.

In the **same change**, update the public wording from "parked" to live:
`src/routes/privacy.tsx`, `src/routes/contact.tsx`, and
`docs/reviews/2026-10-21-p0-p2-remediation.md`. After deploy: one real
submission through the real form, verified in Discord. The docs must never
again describe a state that is not true.
