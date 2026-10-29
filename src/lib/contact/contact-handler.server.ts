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
 * - The message text is scrubbed before delivery: email addresses and
 *   phone numbers typed into the message are replaced with placeholders
 *   (validateContact → stripContactDetails). The form tells kids not to
 *   type personal details; this is the safety net for when they do
 *   anyway. The replyTo field is NOT scrubbed — it is the grown-up's
 *   chosen reply path.
 * - Delivery goes through a small ContactSink interface:
 *     DiscordWebhookSink        → used when the
 *                                 CONTACT_DISCORD_WEBHOOK_URL secret is
 *                                 set on the worker (declared by name in
 *                                 the root wrangler.jsonc, issue #220;
 *                                 no URL is hard-coded)
 *     NoopSink (fallback)       → accepts, stores nothing, reports
 *                                 `stored: false` so the page can say so
 *                                 honestly. This was the parked default
 *                                 (path B, 2026-10-21) until #220 wired
 *                                 the secret; it remains the fail-closed
 *                                 fallback whenever the secret is unset
 *                                 or malformed.
 *   A future KV / email sink just implements ContactSink and is chosen in
 *   selectSink(). What any sink receives: topic, message, replyTo (if
 *   given), received-at timestamp. No IP, user agent, headers, or cookies.
 * - Origin: a POST MUST carry an Origin header (every browser sends one on
 *   a fetch POST). A request without one is refused with 403, so a bare
 *   script cannot skip the origin check. Allowed: same-origin, plus the
 *   GitHub Pages mirror (or CONTACT_ALLOWED_ORIGINS). Never "*".
 * - Stores nothing server-side: no KV, no database, no cache, no message
 *   text in logs. Retention of the one delivered copy (Discord) is in
 *   retention.ts.
 * - Logs: one structured line per outcome with the topic only — never the
 *   message, never the reply-to, never the IP.
 */

import { CONTACT_MESSAGE_MAX, CONTACT_REPLY_TO_MAX, CONTACT_TOPICS as TOPIC_OPTIONS } from "./contact-form.ts";
import { CONTACT_RETENTION_REMINDER } from "./retention.ts";
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
   * Discord channel webhook URL for CONTACT messages (secret, optional).
   * Declared by name in the root wrangler.jsonc (`secrets.required`);
   * the value itself is set as an encrypted runtime secret on the
   * worker and read from the runtime bindings (see
   * readContactRuntimeEnv). Unset → NoopSink. Never hard-code it.
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
/** An email address appearing inside free text (EMAIL_SHAPE, unanchored). */
const EMAIL_IN_TEXT = /[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}/g;
/**
 * Phone-number shapes inside free text: North-American numbers with the
 * usual separators or parentheses (+1 optional), +-prefixed
 * international numbers, 3+4 local numbers with a separator, and any
 * bare run of 7+ digits. Deliberately conservative below 7 digits, so
 * years, scores, and ZIP codes survive.
 */
const PHONE_IN_TEXT =
  /(?:\+?1[\s.(-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-]?)\d{3}[\s.-]?\d{4}|\+\d[\d\s.-]{5,14}\d|\b\d{3}[\s.-]\d{4}\b|\d{7,}/g;

/**
 * Replace email addresses and phone numbers in free text with
 * placeholders. The contact form tells children not to type personal
 * details into the message; this is the safety net for when they do
 * anyway, applied on the server before anything is delivered. The
 * replyTo field is NOT passed through here — it is the grown-up's
 * chosen reply path, validated separately.
 */
export function stripContactDetails(text: string): string {
  return text.replace(EMAIL_IN_TEXT, "[email removed]").replace(PHONE_IN_TEXT, "[phone removed]");
}

/**
 * The honeypot condition on a raw parsed body, before full validation:
 * the hidden `website` field holds text. Humans never see the field, so
 * only bots fill it. handleContactRequest checks this ahead of the
 * origin gate; validateContact applies the same condition to the
 * validated payload.
 */
export function honeypotFilled(parsed: unknown): boolean {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
  const website = (parsed as Record<string, unknown>).website;
  return typeof website === "string" && website.trim().length > 0;
}

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
  const message =
    typeof o.message === "string" ? stripContactDetails(o.message.replace(CONTROL_CHARS, "")).trim() : "";
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
  const honeypot = honeypotFilled(o);
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

/** The GitHub Pages mirror posts cross-origin to the workers.dev site. */
export const DEFAULT_ALLOWED_ORIGINS = ["https://veeresh-bikkaneti.github.io"];

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
  if (request.method !== "POST") return json(405, { error: "method not allowed" }, origin, { allow: "POST, OPTIONS" });

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json(413, { error: "body too large" }, origin);
  const body = await readBodyCapped(request, MAX_BODY_BYTES);
  if (body === null) return json(413, { error: "body too large" }, origin);

  // Parse before the gates: the honeypot check below needs the field,
  // and the body is already size-capped, so this is bounded work. A
  // parse failure is only REPORTED after the origin gate, exactly as
  // before — the gates keep their old answer precedence.
  let parsed: unknown;
  let parseFailed = false;
  try {
    parsed = JSON.parse(body);
  } catch {
    parseFailed = true;
  }

  // Rate-limit before the gates so junk floods are cheap to refuse.
  const ip = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
  const limiter = selectRateLimiter(env, (binding) => log(`rate-limit-binding-error:${binding}`));
  const slot = await limiter.take(ip, now);
  if (!slot.allowed) {
    log("rate-limited");
    return json(429, { error: "too many messages — try again later" }, origin, { "retry-after": String(slot.retryAfterSec) });
  }

  // Honeypot BEFORE the origin gate (issue #220): a bot that filled the
  // hidden field gets the same quiet 200 wherever it posts from, so the
  // response teaches it nothing — not even "your origin was wrong".
  if (!parseFailed && honeypotFilled(parsed)) {
    log("honeypot-dropped");
    return json(200, { ok: true }, origin);
  }

  // A browser always sends Origin on a fetch POST. No Origin means a
  // non-browser client trying to skip the origin check, so refuse it.
  if (!request.headers.get("origin")) return json(403, { error: "origin required" }, null);
  if (origin === null) return json(403, { error: "origin not allowed" }, null);

  if (parseFailed) return json(400, { error: "invalid JSON" }, origin);
  const result = validateContact(parsed);
  // `"problems" in` narrows even in the non-strict single-file deploy emit.
  if ("problems" in result) return json(400, { error: "invalid message", problems: result.problems }, origin);
  if (result.honeypot) {
    // Backstop: honeypotFilled() above applies the same condition to
    // the raw body, so a filled honeypot never reaches validation. The
    // drop does not depend on the early check alone.
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

// Server-only build-time fallbacks injected by `ssrContactEnvPlugin()` in
// `vite.config.ts` ONLY for the `"ssr"` Worker bundle (never in `"client"` or
// `build:pages`). Used when `CONTACT_DISCORD_WEBHOOK_URL` is configured in
// Cloudflare Workers Builds build variables rather than as a runtime binding.
declare const __MERIDIAN_SSR_CONTACT_WEBHOOK_URL__: string | undefined;
declare const __MERIDIAN_SSR_CONTACT_ALLOWED_ORIGINS__: string | undefined;

const CLOUDFLARE_WORKERS_SPECIFIER = "cloudflare:workers";

function nonEmptyEnvString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

async function readCloudflareWorkerEnvStrings(): Promise<
  Pick<ContactEnv, "CONTACT_DISCORD_WEBHOOK_URL" | "CONTACT_ALLOWED_ORIGINS">
> {
  try {
    const mod = (await import(/* @vite-ignore */ CLOUDFLARE_WORKERS_SPECIFIER)) as {
      env?: Record<string, unknown>;
    };
    const workerEnv = mod?.env;
    if (!workerEnv || typeof workerEnv !== "object") return {};
    const out: Pick<ContactEnv, "CONTACT_DISCORD_WEBHOOK_URL" | "CONTACT_ALLOWED_ORIGINS"> = {};
    const webhook = nonEmptyEnvString(workerEnv.CONTACT_DISCORD_WEBHOOK_URL);
    if (webhook) out.CONTACT_DISCORD_WEBHOOK_URL = webhook;
    const origins = nonEmptyEnvString(workerEnv.CONTACT_ALLOWED_ORIGINS);
    if (origins) out.CONTACT_ALLOWED_ORIGINS = origins;
    return out;
  } catch {
    return {};
  }
}

/**
 * Read the contact config (strings only) from synchronous sources, in
 * the owner's precedence (2026-10-21): the Worker's runtime env first,
 * `process.env` only as a local-dev fallback.
 * 1. `globalThis.__env__` (the runtime env Nitro exposes)
 * 2. Server-only SSR build-time fallback (`__MERIDIAN_SSR_CONTACT_*__`,
 *    for Cloudflare Workers Builds build-time variables — see
 *    wrangler.jsonc)
 * 3. `process.env` (local dev and Node tests)
 * The async readContactRuntimeEnv() additionally tries the
 * `cloudflare:workers` env, which outranks all of these — that is where
 * the declared secret binding (root wrangler.jsonc) shows up.
 */
export function readContactEnv(): ContactEnv {
  try {
    const procEnv = (globalThis as { process?: { env?: Record<string, unknown> } }).process?.env;
    const nitroEnv = (globalThis as { __env__?: Record<string, unknown> }).__env__;
    const ssrWebhook =
      typeof __MERIDIAN_SSR_CONTACT_WEBHOOK_URL__ === "string"
        ? __MERIDIAN_SSR_CONTACT_WEBHOOK_URL__
        : undefined;
    const ssrOrigins =
      typeof __MERIDIAN_SSR_CONTACT_ALLOWED_ORIGINS__ === "string"
        ? __MERIDIAN_SSR_CONTACT_ALLOWED_ORIGINS__
        : undefined;
    return {
      CONTACT_DISCORD_WEBHOOK_URL:
        nonEmptyEnvString(nitroEnv?.CONTACT_DISCORD_WEBHOOK_URL) ??
        nonEmptyEnvString(ssrWebhook) ??
        nonEmptyEnvString(procEnv?.CONTACT_DISCORD_WEBHOOK_URL),
      CONTACT_ALLOWED_ORIGINS:
        nonEmptyEnvString(nitroEnv?.CONTACT_ALLOWED_ORIGINS) ??
        nonEmptyEnvString(ssrOrigins) ??
        nonEmptyEnvString(procEnv?.CONTACT_ALLOWED_ORIGINS),
    };
  } catch {
    return {};
  }
}

/**
 * Full runtime config for the route, in the owner's precedence
 * (2026-10-21 — runtime bindings first, `process.env` only as a
 * local-dev fallback):
 * 1. The Workers runtime `env` via `import("cloudflare:workers")`
 *    (works without `nodejs_compat`) — where the declared
 *    CONTACT_DISCORD_WEBHOOK_URL secret binding (root wrangler.jsonc,
 *    issue #220) appears.
 * 2. The synchronous sources in readContactEnv() (`globalThis.__env__`,
 *    then the SSR build-time fallback, then `process.env`).
 * Plus the Workers Rate Limiting binding objects.
 */
export async function readContactRuntimeEnv(): Promise<ContactEnv> {
  const [cfStrings, bindings] = await Promise.all([
    readCloudflareWorkerEnvStrings(),
    readRateLimitBindings(),
  ]);
  const fallback = readContactEnv();
  return {
    CONTACT_DISCORD_WEBHOOK_URL:
      cfStrings.CONTACT_DISCORD_WEBHOOK_URL ?? fallback.CONTACT_DISCORD_WEBHOOK_URL,
    CONTACT_ALLOWED_ORIGINS:
      cfStrings.CONTACT_ALLOWED_ORIGINS ?? fallback.CONTACT_ALLOWED_ORIGINS,
    ...bindings,
  };
}
