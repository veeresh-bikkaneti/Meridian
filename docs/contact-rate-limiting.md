# `/api/contact` rate limiting

Code: `src/lib/contact/rate-limiter.server.ts` (tests: `rate-limiter.server.test.ts`).
Config record: `config/cloudflare/meridian.wrangler.toml`.

## Layers

| Layer | Always on? | Limits | Scope |
| --- | --- | --- | --- |
| `InMemoryRateLimiter` | yes | 3 per 10 min per sender, 60 per hour in total | one isolate, so per instance of the worker |
| `CloudflareBindingRateLimiter` | only when the `CONTACT_RATE_LIMITER` binding exists | 3 per 60 s per sender (`CONTACT_RATE_LIMITER`), 10 per 60 s for everyone (`CONTACT_GLOBAL_RATE_LIMITER`, optional) | shared across isolates in each Cloudflare location. Counts are approximate |

`LayeredRateLimiter` asks the in-memory layer first and the binding second.
The first refusal wins and returns `429` with `Retry-After`.

The in-memory layer alone is per isolate, so a sender who lands on several
isolates gets several budgets, and the "global" cap is per isolate as well.
The binding closes that gap within a location. A strict worldwide limit
would need a Durable Object. That is not needed at this traffic level and is
not part of this change.

## Who the limit trusts

The per-sender limit keys on the `cf-connecting-ip` header. That is safe
on the real deploy because Cloudflare's edge sets the header itself, so a
visitor cannot override it. On a non-Cloudflare adapter the same header
is just text a client can write, so the per-sender limit would be
spoofable there. And when the header is missing entirely, every such
client shares one `unknown` fallback bucket — 3 messages per 10 minutes
collectively, not each.

## Is the binding free? (owner rule: free options only)

Yes, as far as Cloudflare's docs show (checked 2026-10-21):

- The Rate Limiting binding page (`workers/runtime-apis/bindings/rate-limit`)
  has no plan requirement. Pages for paid-only features say so explicitly,
  for example Logpush.
- The Workers pricing page (`workers/platform/pricing`) has no line item for
  it. It bills only requests, CPU, and the listed storage products.
- The binding went GA on 2025-09-19.

A `limit()` call only uses a little CPU inside a request the worker is already
handling. If Cloudflare ever gates it, removing the binding drops back to the
in-memory layer. Nothing else changes.

## Privacy

- In-memory keys: SHA-256 of the IP with a random salt that is unique to
  each isolate. They cannot be used outside that process.
- Binding keys must match across isolates, so they use no random salt:
  `SHA-256("meridian-contact-rl:v1:<UTC day>:<ip>")`, cut to 64 bits. The
  pseudonym changes every UTC day and lives only in Cloudflare's rate-limit
  counters for the 60-second period. Meridian stores, logs, and forwards
  neither the IP nor the key.

## Fail-safe behavior

- No binding, a value that is not a binding, or no `cloudflare:workers` module
  (Node, tests, Vercel/preview): in-memory limits only.
- A binding that throws: that layer allows the request and logs
  `rate-limit-binding-error:<name>` (no request data). The in-memory layer
  still applies.

## Owner deploy step

Copy the two `[[ratelimits]]` blocks from `config/cloudflare/meridian.wrangler.toml`
into the root `wrangler.jsonc` (as a `ratelimits` array), which Workers Builds
deploys with (WI-19b, issue #228). This needs Wrangler 4.36.0 or later. The dashboard
cannot add rate-limit bindings yet. The binding names must stay
`CONTACT_RATE_LIMITER` and `CONTACT_GLOBAL_RATE_LIMITER`.
