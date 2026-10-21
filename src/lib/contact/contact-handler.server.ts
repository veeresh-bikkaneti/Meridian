/**
 * Grown-ups "Contact us" — server handler for `POST /api/contact` on the
 * main `meridian` worker (mounted by the TanStack Start server route in
 * src/routes/api/contact.ts). Owner decision 2026-10-21: no third worker;
 * the endpoint lives on the main site worker, but with its OWN secret
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
 * - Body cap: MAX_BODY_BYTES, checked on content-length AND actual bytes.
 * - Rate limit: per-client fixed window, keyed by a SALTED SHA-256 of the
 *   connecting IP. The raw IP is never stored, logged, forwarded, or kept
 *   in memory past the hash; the salt is random per isolate, so the keys
 *   are useless outside this process. Plus a global per-isolate cap so a
 *   distributed flood cannot fill the inbox.
 * - Delivery goes through a small ContactSink interface (owner decision
 *   2026-10-21: the real target is parked, ship scaffolding only):
 *     NoopSink (default)        → accepts, stores nothing, reports
 *                                 `stored: false` so the page can say so
 *     DiscordWebhookSink        → wired ONLY when the
 *                                 CONTACT_DISCORD_WEBHOOK_URL secret is set
 *                                 (no URL is hard-coded)
 *   A future KV / email sink just implements ContactSink and is chosen in
 *   selectSink(). What any sink receives: topic, message, replyTo (if
 *   given), received-at timestamp. No IP, user agent, headers, or cookies.
 * - CORS: same-origin always; cross-origin only for the GitHub Pages
 *   mirror (or CONTACT_ALLOWED_ORIGINS). Never "*".
 * - Logs: one structured line per outcome with the topic only — never the
 *   message, never the reply-to, never the IP.
 */

import { CONTACT_MESSAGE_MAX, CONTACT_REPLY_TO_MAX, CONTACT_TOPICS as TOPIC_OPTIONS } from "./contact-form.ts";

/** Topic values — one source of truth shared with the page (contact-form.ts). */
export const CONTACT_TOPICS: readonly string[] = TOPIC_OPTIONS.map((t) => t.value);
export type ContactTopic = (typeof TOPIC_OPTIONS)[number]["value"];

export const MAX_MESSAGE_CHARS = CONTACT_MESSAGE_MAX;
export const MAX_REPLY_TO_CHARS = CONTACT_REPLY_TO_MAX;
export const MAX_BODY_BYTES = 4096;

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const GLOBAL_LIMIT_MAX = 60;
const GLOBAL_LIMIT_WINDOW_MS = 60 * 60_000;
const FORWARD_TIMEOUT_MS = 5_000;
/** Discord rejects message content over 2000 characters. */
const DISCORD_MAX_CONTENT = 2000;

export interface ContactEnv {
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

// Control chars except tab/newline/carriage return.
// eslint-disable-next-line no-control-regex -- stripping control chars is the point
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const EMAIL_SHAPE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

/** Pure validation — the server never trusts the page's checks. */
export function validateContact(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, problems: ["body must be a JSON object"] };
  }
  const o = input as Record<string, unknown>;
  const problems: string[] = [];
  const allowed = new Set(["topic", "message", "replyTo", "website"]);
  for (const k of Object.keys(o)) if (!allowed.has(k)) problems.push(`unexpected field ${k}`);

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
      const r = o.replyTo.trim();
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

// --- Rate limiting (in-memory, hashed keys) ---------------------------

interface Window {
  start: number;
  count: number;
}
const perClient = new Map<string, Window>();
let globalWindow: Window = { start: 0, count: 0 };
let salt: string | null = null;

/** Test-only reset. */
export function resetContactStateForTests(): void {
  perClient.clear();
  globalWindow = { start: 0, count: 0 };
  salt = null;
}

/** Salted SHA-256 of the client IP; the raw IP goes no further than this. */
export async function clientKey(ip: string): Promise<string> {
  if (salt === null) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    salt = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${ip}`));
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

function takeSlot(key: string, now: number): { allowed: boolean; retryAfterSec: number } {
  for (const [k, w] of perClient) if (now - w.start >= RATE_LIMIT_WINDOW_MS) perClient.delete(k);
  if (now - globalWindow.start >= GLOBAL_LIMIT_WINDOW_MS) globalWindow = { start: now, count: 0 };
  if (globalWindow.count >= GLOBAL_LIMIT_MAX) {
    return { allowed: false, retryAfterSec: Math.ceil((globalWindow.start + GLOBAL_LIMIT_WINDOW_MS - now) / 1000) };
  }
  const w = perClient.get(key);
  if (w && w.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((w.start + RATE_LIMIT_WINDOW_MS - now) / 1000)) };
  }
  if (w) w.count += 1;
  else perClient.set(key, { start: now, count: 1 });
  globalWindow.count += 1;
  return { allowed: true, retryAfterSec: 0 };
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
  if (!origin) return ""; // same-origin navigation/fetch or non-browser client
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

/**
 * Forwards to a private Discord channel webhook. Stub-level on purpose:
 * plain text, mentions disabled (a message can't @everyone), truncated to
 * Discord's limit, 5 s timeout. Failure → ok:false so the page can ask the
 * grown-up to try again.
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
    const text =
      `**Meridian contact** — ${record.topic}\n` +
      `Reply-to (grown-up, optional): ${record.replyTo ?? "—"}\n` +
      `Received: ${record.receivedAt}\n\n${record.message}`;
    return text.length > DISCORD_MAX_CONTENT ? `${text.slice(0, DISCORD_MAX_CONTENT - 1)}…` : text;
  }

  async deliver(record: ContactRecord): Promise<DeliveryResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FORWARD_TIMEOUT_MS);
    try {
      const res = await this.fetchFn(this.webhookUrl, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: DiscordWebhookSink.format(record), allowed_mentions: { parse: [] } }),
      });
      return { ok: res.ok, stored: res.ok };
    } catch {
      return { ok: false, stored: false };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Pick the sink from config: Discord only when its secret is set. */
export function selectSink(env: ContactEnv): ContactSink {
  const url = env.CONTACT_DISCORD_WEBHOOK_URL?.trim();
  if (url && /^https:\/\//.test(url)) return new DiscordWebhookSink(url);
  return new NoopSink();
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
  if (origin === null) return json(403, { error: "origin not allowed" }, null);

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json(413, { error: "body too large" }, origin);
  const body = await request.text();
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) return json(413, { error: "body too large" }, origin);

  // Rate-limit before parsing so junk floods are cheap to refuse.
  const ip = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
  const slot = takeSlot(await clientKey(ip), now);
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
 * Read the contact config from the runtime. On the Cloudflare `meridian`
 * worker, secrets reach `process.env` when the worker runs with the
 * `nodejs_compat` flag (compatibility date ≥ 2025-04-01). Anything missing
 * → empty config → NoopSink: the safe default.
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
