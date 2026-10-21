/**
 * Grown-ups "Contact us" — server handler for `POST /api/contact` on the
 * main `meridian` worker (mounted by the TanStack Start server route in
 * src/routes/api/contact.ts). Team rationale: no third worker — the
 * endpoint lives on the main site worker, but with its OWN secret
 * (CONTACT_DISCORD_WEBHOOK_URL) and no code shared with the crash-report
 * worker (workers/crash-report) or its DISCORD_WEBHOOK_URL.
 *
 * Meridian is directed to children, so this endpoint is built to collect
 * as little as possible and to keep nothing it does not need:
 *
 * - Accepts ONE JSON message: { topic, message, replyTo?, website? }.
 *   `topic` is a fixed enum, `message` is ≤ 1000 chars, `replyTo` is an
 *   optional grown-up email (≤ 254 chars, shape-checked), `website` is a
 *   honeypot that humans never see. A filled honeypot gets a normal-
 *   looking 200 and the message is silently dropped (no signal to bots).
 * - Body cap: MAX_BODY_BYTES. A declared content-length over the cap is
 *   refused up front, and the body is read as a STREAM with a hard cap: the
 *   read is cancelled the moment it passes 4 KB, so a chunked upload with
 *   no content-length is never fully buffered.
 * - Rate limit: see rate-limiter.server.ts. An in-memory floor (salted,
 *   per-isolate keys) is always on. When the binding is configured, the
 *   free Workers Rate Limiting binding adds a per-client and a global limit
 *   that are shared across isolates. The raw IP is never stored, logged, or
 *   forwarded.
 * - Delivery goes through a small ContactSink interface (delivery is
 *   PARKED — path B, adopted by the owner 2026-10-21 with the words
 *   "Adopt B — start the cure round": ship scaffolding only):
 *     NoopSink (default)        → accepts, stores nothing, reports
 *                                 `stored: false` so the page can say so
 *     DiscordWebhookSink        → wired ONLY when the
 *                                 CONTACT_DISCORD_WEBHOOK_URL secret is set
 *                                 (no URL is hard-coded)
 *   A future KV / email sink just implements ContactSink and is chosen in
 *   selectSink(). What any sink receives: topic, message, replyTo (if
 *   given), received-at timestamp. No IP, user agent, headers, or cookies.
 * - Origin: a POST MUST carry an Origin header (every browser sends one on
 *   a fetch POST). A request without one is refused with 403, so a bare
 *   script cannot skip the origin check. Allowed: same-origin, the live
 *   production origin, plus the GitHub Pages mirror (or
 *   CONTACT_ALLOWED_ORIGINS). Never "*". One exception: a refused or
 *   missing Origin with a filled honeypot gets the same silent 200 as any
 *   other honeypot drop, so a bot never learns from a 403 that it was
 *   filtered (nothing is delivered either way).
 * - GET /api/contact is the readiness probe: it answers { sink: "discord" |
 *   "noop" } — the sink NAME only, never the webhook — so
 *   `npm run check:contact -- --url <origin>` can confirm what the live
 *   worker was really given.
 * - Config comes from the worker's own env (runtime-env.server.ts), with
 *   process.env only as a fallback.
 * - Stores nothing server-side: no KV, no database, no cache, no message
 *   text in logs. Retention of the one delivered copy (Discord) is in
 *   retention.ts.
 * - Logs: one structured line per outcome with the topic only — never the
 *   message, never the reply-to, never the IP.
 */

import { CONTACT_MESSAGE_MAX, CONTACT_REPLY_TO_MAX, CONTACT_TOPICS as TOPIC_OPTIONS } from "./contact-form.ts";
import { CONTACT_RETENTION_REMINDER } from "./retention.ts";
import { readRuntimeString } from "./runtime-env.server.ts";
import {
  readRateLimitBindings,
  resetRateLimitBindingLookupForTests,
  selectRateLimiter,
  sharedInMemoryLimiterForTests,
  type RateLimitBindings,
} from "./rate-limiter.server.ts";

/** Topic values — one source of truth shared with the page (contact-form.ts). */
export const CONTACT_TOPICS: readonly string[] = TOPIC_OPTIONS.map((t) => t.value);
export type ContactTopic = (typeof TOPIC_OPTIONS)[number]["value"];

export const MAX_MESSAGE_CHARS = CONTACT_MESSAGE_MAX;
export const MAX_REPLY_TO_CHARS = CONTACT_REPLY_TO_MAX;
export const MAX_BODY_BYTES = 4096;

const FORWARD_TIMEOUT_MS = 5_000;
/** Discord rejects message content over 2000 characters. */
const DISCORD_MAX_CONTENT = 2000;

export interface ContactEnv extends RateLimitBindings {
  /**
   * Discord channel webhook URL for CONTACT messages (secret, optional —
   * DEPLOY TODO). Unset → NoopSink. Never hard-code it.
   *
   * Set on the main `meridian` worker. Deliberately NOT
   * `DISCORD_WEBHOOK_URL`: that name is the crash-report worker's secret
   * (workers/crash-report). Contact and crash pipelines
   * must never share a secret, a channel, or a code path — parents'
   * messages must not land in the crash-alert channel, and a crash-side
   * rotation must not silently re-route contact mail. Use a different
   * Discord channel (and webhook) for this.
   */
  CONTACT_DISCORD_WEBHOOK_URL?: string;
  /**
   * Comma-separated extra origins allowed to POST cross-origin. Unset →
   * DEFAULT_ALLOWED_ORIGINS (the GitHub Pages mirror). Same-origin
   * requests are always allowed.
   */
  CONTACT_ALLOWED_ORIGINS?: string;
}

export interface ContactMessage {
  topic: ContactTopic;
  message: string;
  replyTo?: string;
}

export type ValidationResult =
  | { ok: true; value: ContactMessage; honeypot: boolean }
  | { ok: false; problems: string[] };

// Control chars except tab/newline/carriage return, plus every Unicode
// "format" char (\p{Cf}): zero-width spaces/joiners, bidi overrides (which
// can visually reorder text in the reader's client), soft hyphens, BOMs.
// eslint-disable-next-line no-control-regex -- stripping control chars is the point
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|\p{Cf}/gu;
const EMAIL_SHAPE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

/** Pure validation — the server never trusts the page's checks. */
export function validateContact(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, problems: ["body must be a JSON object"] };
  }
  const o = input as Record<string, unknown>;
  const problems: string[] = [];
  const allowed = new Set(["topic", "message", "replyTo", "website"]);
  // Never echo the caller's field names back (no reflection of input).
  if (Object.keys(o).some((k) => !allowed.has(k))) problems.push("unexpected fields");

  const topic = o.topic;
  if (typeof topic !== "string" || !CONTACT_TOPICS.includes(topic)) {
    problems.push("topic must be one of " + CONTACT_TOPICS.join(", "));
  }
  const message = typeof o.message === "string" ? o.message.replace(CONTROL_CHARS, "").trim() : "";
  if (typeof o.message !== "string" || message.length === 0) problems.push("message is required");
  else if (message.length > MAX_MESSAGE_CHARS) problems.push(`message must be ≤ ${MAX_MESSAGE_CHARS} characters`);

  let replyTo: string | undefined;
  if (o.replyTo !== undefined && o.replyTo !== null && o.replyTo !== "") {
    if (typeof o.replyTo !== "string") problems.push("replyTo must be a string");
    else {
      const r = o.replyTo.replace(CONTROL_CHARS, "").trim();
      if (r.length > MAX_REPLY_TO_CHARS || !EMAIL_SHAPE.test(r)) problems.push("replyTo must be an email address");
      else replyTo = r;
    }
  }
  if (o.website !== undefined && typeof o.website !== "string") problems.push("website must be a string");

  if (problems.length > 0) return { ok: false, problems };
  const honeypot = typeof o.website === "string" && o.website.trim().length > 0;
  return {
    ok: true,
    honeypot,
    value: { topic: topic as ContactTopic, message, ...(replyTo ? { replyTo } : {}) },
  };
}

// --- Rate limiting -------------------------------------------------------
// Lives in rate-limiter.server.ts (in-memory floor + optional Workers Rate
// Limiting binding).

/** Test-only reset of the per-isolate state (rate-limit windows, salt, binding lookup). */
export function resetContactStateForTests(): void {
  sharedInMemoryLimiterForTests().reset();
  resetRateLimitBindingLookupForTests();
}

// --- Responses ---------------------------------------------------------

/** The live site. Public hostname, not a secret. */
export const PRODUCTION_ORIGIN = "https://meridian.knowledgetest.workers.dev";

/**
 * The GitHub Pages mirror posts cross-origin to the workers.dev site. The
 * production origin is listed too, so the site's own form works even when
 * the request URL the worker sees is not the page's origin (a proxy or a
 * custom route). Same-origin is still checked first and always allowed.
 */
export const DEFAULT_ALLOWED_ORIGINS = ["https://veeresh-bikkaneti.github.io", PRODUCTION_ORIGIN];

/**
 * CORS decision. Returns the value for access-control-allow-origin, ""
 * for an allowed same-origin request (no CORS header needed), or null to
 * refuse. Never "*".
 */
function corsOrigin(request: Request, env: ContactEnv): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return ""; // no CORS header needed; POST without Origin is refused in the handler
  if (origin === new URL(request.url).origin) return "";
  const configured = env.CONTACT_ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const list = configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
  return list.includes(origin) ? origin : null;
}

function json(status: number, body: unknown, origin: string | null, extra?: Record<string, string>): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...extra,
  };
  if (origin) {
    headers["access-control-allow-origin"] = origin;
    headers.vary = "origin";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function log(outcome: string, topic?: string): void {
  try {
    // Topic + outcome only. Never the message, reply-to, or IP.
    console.log(JSON.stringify({ kind: "meridian-contact", at: new Date().toISOString(), outcome, topic }));
  } catch {
    // never break the request path
  }
}

// --- Delivery (sinks) ---------------------------------------------------

/** What a sink receives — nothing else about the sender ever reaches it. */
export interface ContactRecord extends ContactMessage {
  receivedAt: string;
}

export interface DeliveryResult {
  /** The message was accepted (the client may say "thanks"). */
  ok: boolean;
  /** The message was actually kept/forwarded somewhere a person can read it. */
  stored: boolean;
}

/** One delivery target. Implement this to add KV, email, etc. later. */
export interface ContactSink {
  readonly name: string;
  deliver(record: ContactRecord): Promise<DeliveryResult>;
}

/**
 * Default sink while the real target is parked: accepts and discards.
 * Returns stored:false so the page can be honest that nobody will read it.
 */
export class NoopSink implements ContactSink {
  readonly name = "noop";
  async deliver(_record: ContactRecord): Promise<DeliveryResult> {
    return { ok: true, stored: false };
  }
}

/** The only webhook URL shape accepted. Anything else stays on NoopSink. */
export const DISCORD_WEBHOOK_PREFIX = "https://discord.com/api/webhooks/";

/** Discord message flag SUPPRESS_EMBEDS (1 << 2): no link previews/unfurls. */
export const DISCORD_FLAG_SUPPRESS_EMBEDS = 4;

/**
 * User text goes inside a ```text fence, so Discord shows it literally:
 * no markdown, no links, no masked links. Backticks in the text are
 * swapped for U+02CB (ˋ) so the text cannot close the fence early.
 */
function fenceSafe(text: string): string {
  return text.replace(/`/g, "\u02cb");
}

/**
 * Forwards to a private Discord channel webhook. Plain on purpose. Every
 * mention is disabled (allowed_mentions.parse is empty, so no @everyone),
 * embeds are suppressed (flags: 4), user text is code-fenced, the message
 * is cut to Discord's limit with the fence still closed, and there is a 5 s
 * timeout. Failure → ok:false so the page can ask the grown-up to try
 * again.
 */
export class DiscordWebhookSink implements ContactSink {
  readonly name = "discord";
  // Plain fields (not TS parameter properties) so the file runs under
  // node --experimental-strip-types in tests.
  private readonly webhookUrl: string;
  private readonly fetchFn: typeof fetch;
  constructor(webhookUrl: string, fetchFn: typeof fetch = (input, init) => fetch(input, init)) {
    this.webhookUrl = webhookUrl;
    this.fetchFn = fetchFn;
  }

  static format(record: ContactRecord): string {
    const head =
      `**Meridian contact** · topic: ${record.topic}\n` +
      `Received: ${record.receivedAt}\n` +
      `Reply-to (grown-up, optional):\n\`\`\`text\n${fenceSafe(record.replyTo ?? "-")}\n\`\`\`\n` +
      "Message:\n```text\n";
    const tail = `\n\`\`\`\n_${CONTACT_RETENTION_REMINDER}_`;
    const room = DISCORD_MAX_CONTENT - head.length - tail.length;
    const body = fenceSafe(record.message);
    const fitted = body.length > room ? `${body.slice(0, Math.max(0, room - 1))}…` : body;
    return head + fitted + tail;
  }

  async deliver(record: ContactRecord): Promise<DeliveryResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FORWARD_TIMEOUT_MS);
    try {
      const res = await this.fetchFn(this.webhookUrl, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: DiscordWebhookSink.format(record),
          allowed_mentions: { parse: [] },
          flags: DISCORD_FLAG_SUPPRESS_EMBEDS,
        }),
      });
      return { ok: res.ok, stored: res.ok };
    } catch {
      return { ok: false, stored: false };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Pick the sink from config. Discord is used only when the secret is a
 * https://discord.com/api/webhooks/... URL. Any other host (including a
 * typo or a look-alike) falls back to NoopSink, so a mis-set secret can
 * never send parents' messages somewhere else.
 */
export function selectSink(env: ContactEnv): ContactSink {
  const url = env.CONTACT_DISCORD_WEBHOOK_URL?.trim();
  if (url && isDiscordWebhookUrl(url)) return new DiscordWebhookSink(url);
  return new NoopSink();
}

export function isDiscordWebhookUrl(url: string): boolean {
  if (!url.startsWith(DISCORD_WEBHOOK_PREFIX)) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "discord.com" && !u.username && !u.password && !u.port;
  } catch {
    return false;
  }
}

/**
 * Read the body as a stream, stopping at maxBytes. Returns null as soon as
 * the cap is passed, and cancels the stream so the rest is never read or
 * buffered. This covers chunked uploads that have no content-length.
 */
export async function readBodyCapped(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/**
 * True when the body is a JSON object with a non-empty honeypot field. Used
 * only on the refused-origin path, so it is deliberately loose (any other
 * field may be wrong) and has the same size cap as a real message.
 */
async function isHoneypotDrop(request: Request): Promise<boolean> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return false;
  try {
    const body = await readBodyCapped(request, MAX_BODY_BYTES);
    if (body === null) return false;
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
    const website = (parsed as Record<string, unknown>).website;
    return typeof website === "string" && website.trim().length > 0;
  } catch {
    return false;
  }
}

// --- Handler -----------------------------------------------------------

/**
 * Handle one request to /api/contact. Pure over (request, env, now) so it
 * is unit-testable without a Workers runtime.
 */
export async function handleContactRequest(
  request: Request,
  env: ContactEnv,
  now: number = Date.now(),
): Promise<Response> {
  const origin = corsOrigin(request, env);

  if (request.method === "OPTIONS") {
    if (!origin) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
        vary: "origin",
      },
    });
  }
  // GET is the readiness probe (scripts/contact-readiness.mjs --url): which
  // sink the worker really selected, by name only. No secret, no CORS grant,
  // never cached. It lets a person confirm production is wired without ever
  // seeing the webhook URL.
  if (request.method === "GET") return json(200, { sink: selectSink(env).name }, null);
  if (request.method !== "POST") return json(405, { error: "method not allowed" }, origin, { allow: "POST, GET, OPTIONS" });
  // A browser always sends Origin on a fetch POST. No Origin means a
  // non-browser client trying to skip the origin check, so refuse it. But a
  // filled honeypot is dropped silently first: a bot must not learn from a
  // 403 that it was filtered.
  if (!request.headers.get("origin") || origin === null) {
    if (await isHoneypotDrop(request)) {
      log("honeypot-dropped");
      return json(200, { ok: true }, null);
    }
    return json(403, { error: request.headers.get("origin") ? "origin not allowed" : "origin required" }, null);
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json(413, { error: "body too large" }, origin);
  const body = await readBodyCapped(request, MAX_BODY_BYTES);
  if (body === null) return json(413, { error: "body too large" }, origin);

  // Rate-limit before parsing so junk floods are cheap to refuse.
  const ip = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
  const limiter = selectRateLimiter(env, (binding) => log(`rate-limit-binding-error:${binding}`));
  const slot = await limiter.take(ip, now);
  if (!slot.allowed) {
    log("rate-limited");
    return json(429, { error: "too many messages — try again later" }, origin, { "retry-after": String(slot.retryAfterSec) });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return json(400, { error: "invalid JSON" }, origin);
  }
  const result = validateContact(parsed);
  // `"problems" in` narrows even in the non-strict single-file deploy emit.
  if ("problems" in result) return json(400, { error: "invalid message", problems: result.problems }, origin);
  if (result.honeypot) {
    log("honeypot-dropped");
    return json(200, { ok: true }, origin);
  }
  const sink = selectSink(env);
  const delivery = await sink.deliver({ ...result.value, receivedAt: new Date(now).toISOString() });
  log(delivery.ok ? `delivered:${sink.name}` : `delivery-failed:${sink.name}`, result.value.topic);
  return delivery.ok
    ? json(200, { ok: true, stored: delivery.stored }, origin)
    : json(502, { error: "could not deliver — try again later" }, origin);
}

/**
 * Fallback config source: `process.env`. On the Cloudflare `meridian`
 * worker, secrets reach `process.env` only with the `nodejs_compat` flag and
 * a compatibility date of 2025-04-01 or later (or
 * `nodejs_compat_populate_process_env`), which the repo cannot see or
 * guarantee. So this is no longer the primary source: readContactRuntimeEnv
 * reads the worker's own env first and falls back to this (local `npm run
 * check:contact`, tests, and the Vercel/preview build). Once the deployed
 * entry is known (docs/contact-activation.md, probe A1) this fallback can be
 * dropped on the worker.
 */
export function readContactEnv(): ContactEnv {
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
    return {
      CONTACT_DISCORD_WEBHOOK_URL: env.CONTACT_DISCORD_WEBHOOK_URL,
      CONTACT_ALLOWED_ORIGINS: env.CONTACT_ALLOWED_ORIGINS,
    };
  } catch {
    return {};
  }
}

/**
 * Full runtime config for the route: the contact strings from the worker's
 * own env (falling back to process.env), plus the Workers Rate Limiting
 * binding objects. This is the single reader — the route and the readiness
 * check both use it, so a readiness answer is what the handler will do.
 * Only the two contact names are ever read; the crash worker's
 * DISCORD_WEBHOOK_URL is never looked at.
 */
export async function readContactRuntimeEnv(): Promise<ContactEnv> {
  const [webhook, origins, bindings] = await Promise.all([
    readRuntimeString("CONTACT_DISCORD_WEBHOOK_URL"),
    readRuntimeString("CONTACT_ALLOWED_ORIGINS"),
    readRateLimitBindings(),
  ]);
  const fallback = readContactEnv();
  return {
    CONTACT_DISCORD_WEBHOOK_URL: webhook ?? fallback.CONTACT_DISCORD_WEBHOOK_URL,
    CONTACT_ALLOWED_ORIGINS: origins ?? fallback.CONTACT_ALLOWED_ORIGINS,
    ...bindings,
  };
}
