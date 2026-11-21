# Branch status — refactor/phase-1-transport-port

## Capsule

Phase 1 slice 3: a transport port in `src/platform/transport/` in the
audio/storage ports' shape (contract, browser implementation, fake,
contract tests, hook), with `src/components/pack-shelf-data.ts`'s one
fetch moved onto it. No player-visible change. Draft PR only.

Base: `origin/main` 189c021b4692579fe376188afa36267e9f83076a
(slice 2, PR #563, is merged into this base). Tier 2, cap 400k
tokens (shared lead + helpers).

## Facts (re-run on this base)

- pack-shelf-data.ts (480 lines) has exactly ONE fetch site:
  `fetchJsonOrNull` — bare `fetch(url)`, no options/signal; `!res.ok`
  → null; any throw → null. Never throws, no retries, no timeout.
  Validation is hand-rolled (`isPackManifest`); an injection seam
  already exists (`type Fetcher = (url) => Promise<unknown>`).
  [fact-find, this branch's evidence pack]
- Baseline entries for pack-shelf-data.ts: 3, all noRawIo —
  `fetch()` ×1 and `localStorage reference` ×2, both of the latter
  from `defaultStorage()`, not the fetch path. This slice removes
  ONLY the `fetch()` entry; the two storage references stay (the
  storage reads in this file are a storage-port matter, not this
  slice). [tested: eslint/layer-baseline.json on base]
- fetch( census: 18 non-test files, 23 call sites; pack-shelf-data
  is the only one this slice touches. [tested: grep on base]
- Layers: `src/components/**` is feature (5); platform is 3;
  imports point down, so feature may import the port. Platform is
  exempt from no-raw-io (raw I/O is its job). Tests are exempt.
- The design doc named in the brief
  (/mnt/project-files/meridian/architecture/phase-1-platform-ports.md)
  is not present on this machine or in the repo; the slice follows
  the brief's stated contract (getJson/postJson, one error type,
  abort through the caller's signal, zod-parsed responses).

## Statechart (one request, as the hook exposes it)

- idle → loading: a call starts (hook: mount with a URL, or refetch).
- loading → ready: final attempt succeeds (2xx, schema parses).
- loading → error: final attempt fails — TransportError kind
  network | timeout | http | parse.
- loading → aborted: the caller's signal aborts; the promise
  rejects with an AbortError (never a TransportError), so callers
  can tell "I cancelled" from a failure.
- ready | error | aborted → loading: a new call (URL change,
  refetch). Retries keep the request in `loading` across attempts —
  no state flicker per attempt.

## Architect — layer per file, one import direction

| File | Layer | Imports |
| --- | --- | --- |
| src/platform/transport/transport.ts (contract) | platform 3 | types only — the schema parameter is structural (`{ parse(input): T }`), which zod's ZodType satisfies; no runtime zod import, so zod cannot enter the entry bundle through the port |
| src/platform/transport/browser-transport.ts | platform 3 | transport.ts |
| src/platform/transport/fake-transport.ts | platform 3 | transport.ts, browser-transport.ts (the fake port layers over the real attempt loop via a scripted fetch, so there is one semantics) |
| src/platform/transport/use-transport.ts (hook) | platform 3 | react, transport.ts, browser-transport.ts |
| src/components/pack-shelf-data.ts (migrated) | feature 5 | platform/transport (convenience getJson) |

The browser implementation resolves the global `fetch` lazily per
call (never at import), so tests that stub `globalThis.fetch` —
pack-shelf-data's dedupe tests do — keep working. No register file:
no domain consumer needs a slot (the only consumer is feature
layer and imports the port directly).

Timeout is per attempt: each attempt gets an internal
AbortController composed with the caller's signal (listener added
per attempt, removed on settle); `timeoutMs` expiry fails that
attempt with kind `timeout`. Retry eligibility: kind network,
kind timeout, http status ≥ 500. Never retried: parse failures,
http 4xx, and anything after the caller aborts. Backoff between
attempts: 200 ms × 2^attempt, through an injectable sleep so
contract tests run instantly.

## Arena — retry/timeout ownership

- Option A (port owns policy): built-in defaults (a retry count,
  a default timeout) inside the port; callers override. Strongest
  point: the mechanism is pinned once. Weakest point, by its
  advocate's account: a wrong default fails silently — a caller
  that needed no retries or a long timeout must remember to
  override.
- Option B (caller owns policy): the port performs exactly one
  attempt unless the caller passes retries/timeoutMs; no defaults.
  Strongest point: no hidden behaviour — pack-shelf's behaviour
  stays literally identical, and policy sits where idempotency and
  patience are known. Weakest point, by its advocate's account:
  callers could reinvent retry inconsistently.

PICKED: B's ownership with A's machinery. The port owns the
mechanism (attempt loop, backoff, signal composition, error
classification — written once, pinned by the contract tests and
the fake); the caller owns the numbers (`retries`, `timeoutMs` in
the call options, exactly as the brief's signature has it);
defaults are zero retries and no timeout. Nobody hand-rolls a
loop (B's weakness answered) and nothing retries or times out
that did not ask to (A's weakness answered).

## Status

- Arena done, hybrid picked (above). Port built TDD-first
  (contract tests RED on the missing module, then green):
  26/26 contract scenarios across both drivers; tsc and
  lint:arch clean at build time.
- Migration done: `fetchJsonOrNull`'s default path is one
  `getJson(url, rawJsonSchema)` call (identity schema — validation
  stays with the existing guards) inside the same
  try/catch-to-null, no options passed. The Fetcher seam, the
  injected path and `sharedManifestLoads` are untouched. The
  pack-shelf suites pass unchanged (46/46), including the
  dedupe tests that stub `globalThis.fetch`.
- Baseline: the one `fetch()` entry for pack-shelf-data.ts
  removed; the two `localStorage reference` entries stay.
- Gates and panel run at integration (see the PR body for the
  recorded results).
- Open questions: none for the owner at this point.

## Graph

For the integrator to fold in at merge (branches never edit
graph.json):

- Node: `branch:refactor/phase-1-transport-port` (this branch).
- Node: the transport port, path `src/platform/transport/`,
  summary: typed JSON-over-fetch port (contract, browser impl,
  fake, hook) in the audio/storage ports' shape.
- Edges: the port node is depended on by
  `src/components/pack-shelf-data.ts`.
