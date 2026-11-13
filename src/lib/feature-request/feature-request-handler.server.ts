/**
 * Grown-ups feature requests — server handler for `POST /api/feature-request`
 * on the main `meridian` worker (mounted by src/routes/api/feature-request.ts).
 *
 * Built on the contact handler's code, not a copy of it: this module imports
 * the body cap reader, the Discord webhook URL check, the embed-suppression
 * flag, the email/phone scrubber and the origin/JSON helpers from
 * src/lib/contact/contact-handler.server.ts, and the rate limiter from
 * src/lib/contact/rate-limiter.server.ts. Its own secret is
 * FEATURE_DISCORD_WEBHOOK_URL, so requests land in their own Discord
 * channel; the webhook URL never appears in client code, logs, or errors.
 *
 * Until FEATURE_DISCORD_WEBHOOK_URL (and the Turnstile secret) are set, the
 * endpoint answers 503 "Feature requests are not open yet".
 *
 * Checks on every request, server side, in contact's order: body cap →
 * honeypot → origin → not-open gate → field validation → Turnstile →
 * rate limit → delivery. Only the expected fields are accepted, each
 * length-limited. Before forwarding, @everyone / @here / user, role and
 * channel mentions and all links are stripped, and the Discord post is
 * sent with allowed_mentions parse [] as plain text only.
 */

import {
  corsOrigin,
  honeypotFilled,
  isDiscordWebhookUrl,
  json as jsonResponse,
  MAX_BODY_BYTES,
  readBodyCapped,
  stripContactDetails,
  DISCORD_FLAG_SUPPRESS_EMBEDS,
} from "../contact/contact-handler.server.ts";
import { CONTACT_RETENTION_REMINDER } from "../contact/retention.ts";
import {
  isRateLimitBinding,
  selectRateLimiter,
  sharedInMemoryLimiterForTests,
  resetRateLimitBindingLookupForTests,
  readRateLimitBindings,
  type RateLimitBindings,
} from "../contact/rate-limiter.server.ts";
import { FEATURE_AGE_GROUPS, FEATURE_IDEA_MAX, FEATURE_SUBJECTS } from "./feature-request-form.ts";
import { verifyTurnstileToken, type TurnstileVerifyFn } from "./turnstile.server.ts";

export const FEATURE_NOT_OPEN_MESSAGE = "Feature requests are not open yet";
export const FEATURE_TRIAGE_FOOTER =
  "Triage note: requests on religion, LGBTQ or world politics are out of scope.";

const DISCORD_MAX_CONTENT = 2000;
const FORWARD_TIMEOUT_MS = 5_000;
const MAX_TURNSTILE_TOKEN_CHARS = 4096;

export interface FeatureRequestEnv extends RateLimitBindings {
  /** Discord webhook for the feature-request channel (secret, optional). */
  FEATURE_DISCORD_WEBHOOK_URL?: string;
  /** Turnstile secret key (secret, optional). */
  FEATURE_TURNSTILE_SECRET_KEY?: string;
  /** Optional dedicated rate-limit bindings; contact's are reused otherwise. */
  FEATURE_RATE_LIMITER?: unknown;
  FEATURE_GLOBAL_RATE_LIMITER?: unknown;
  /** Comma-separated extra origins (same semantics as contact's). */
  FEATURE_ALLOWED_ORIGINS?: string;
  CONTACT_ALLOWED_ORIGINS?: string;
}

export interface FeatureRequestMessage {
  idea: string;
  ageGroup: string;
  subject: string;
}

export type FeatureValidationResult =
  | { ok: true; value: FeatureRequestMessage; turnstileToken: string; honeypot: boolean }
  | { ok: false; problems: string[] };

// Same control/format-char strip as the contact handler.
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|\p{Cf}/gu;

const LINK_IN_TEXT =
  /\b(?:https?:\/\/|www\.)\S+|\bdiscord\.(?:gg|com|app\.com)\/\S+/gi;
const MENTION_IN_TEXT = /<@[!&]?\d+>|<#\d+>/g;

/**
 * Strip what must never reach Discord from visitor text: @everyone and
 * @here lose their @, user/role/channel mentions are removed, and all
 * links are removed. Email addresses and phone numbers typed into the
 * idea are scrubbed by the contact handler's stripContactDetails (the
 * form collects no personal data; this is the safety net).
 */
export function sanitizeFeatureText(text: string): string {
  return stripContactDetails(
    text
      .replace(MENTION_IN_TEXT, "[mention removed]")
      .replace(/@everyone\b/g, "everyone")
      .replace(/@here\b/g, "here")
      .replace(LINK_IN_TEXT, "[link removed]"),
  );
}

/** Pure validation — the server never trusts the page's checks. */
export function validateFeatureRequest(input: unknown): FeatureValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, problems: ["body must be a JSON object"] };
  }
  const o = input as Record<string, unknown>;
  const problems: string[] = [];
  const allowed = new Set(["idea", "ageGroup", "subject", "turnstileToken", "website"]);
  // Never echo the caller's field names back (no reflection of input).
  if (Object.keys(o).some((k) => !allowed.has(k))) problems.push("unexpected fields");

  const typed = typeof o.idea === "string" ? o.idea.replace(CONTROL_CHARS, "").trim() : "";
  let idea = "";
  if (typeof o.idea !== "string" || typed.length === 0) problems.push("idea is required");
  else if (typed.length > FEATURE_IDEA_MAX) problems.push(`idea must be ≤ ${FEATURE_IDEA_MAX} characters`);
  else idea = sanitizeFeatureText(typed).trim();

  const ageGroup = typeof o.ageGroup === "string" ? o.ageGroup : "";
  if (!FEATURE_AGE_GROUPS.some((g) => g.value === ageGroup)) {
    problems.push("ageGroup must be one of " + FEATURE_AGE_GROUPS.map((g) => g.value).join(", "));
  }
  const subject = typeof o.subject === "string" ? o.subject : "";
  if (!FEATURE_SUBJECTS.some((s) => s === subject)) problems.push("subject must be from the list");

  const turnstileToken = typeof o.turnstileToken === "string" ? o.turnstileToken : "";
  if (turnstileToken.length > MAX_TURNSTILE_TOKEN_CHARS) problems.push("turnstileToken is too long");

  if (o.website !== undefined && typeof o.website !== "string") problems.push("website must be a string");

  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    honeypot: honeypotFilled(o),
    turnstileToken,
    value: { idea, ageGroup, subject },
  };
}

/** Test-only reset, mirroring resetContactStateForTests. */
export function resetFeatureRequestStateForTests(): void {
  sharedInMemoryLimiterForTests().reset();
  resetRateLimitBindingLookupForTests();
}

function log(outcome: string, subject?: string): void {
  try {
    // Subject + outcome only. Never the idea, never the IP, never the webhook.
    console.log(JSON.stringify({ kind: "meridian-feature-request", at: new Date().toISOString(), outcome, subject }));
  } catch {
    // never break the request path
  }
}

function fenceSafe(text: string): string {
  return text.replace(/`/g, "ˋ");
}

/** The plain-text Discord post. Exported for tests. */
export function formatFeatureRequestPost(record: FeatureRequestMessage & { receivedAt: string }): string {
  const head =
    `**Meridian feature request** · age group: ${record.ageGroup} · subject: ${record.subject}\n` +
    `Received: ${record.receivedAt}\n` +
    "Idea:\n```text\n";
  const tail = `\n\`\`\`\n_${FEATURE_TRIAGE_FOOTER}_\n_${CONTACT_RETENTION_REMINDER}_`;
  const room = DISCORD_MAX_CONTENT - head.length - tail.length;
  const body = fenceSafe(sanitizeFeatureText(record.idea));
  const fitted = body.length > room ? `${body.slice(0, Math.max(0, room - 1))}…` : body;
  return head + fitted + tail;
}

export interface FeatureHandlerDeps {
  /** Discord delivery fetch (tests inject a fake). */
  fetchFn?: typeof fetch;
  /** Turnstile verifier (tests inject a fake; default is siteverify). */
  verifyTurnstile?: TurnstileVerifyFn;
}

function featureRateLimiter(env: FeatureRequestEnv): ReturnType<typeof selectRateLimiter> {
  // Dedicated FEATURE_* bindings when present, otherwise the contact
  // limiter bindings — the same limiter code either way.
  const bindings: RateLimitBindings = isRateLimitBinding(env.FEATURE_RATE_LIMITER)
    ? {
        CONTACT_RATE_LIMITER: env.FEATURE_RATE_LIMITER,
        CONTACT_GLOBAL_RATE_LIMITER: isRateLimitBinding(env.FEATURE_GLOBAL_RATE_LIMITER)
          ? env.FEATURE_GLOBAL_RATE_LIMITER
          : env.CONTACT_GLOBAL_RATE_LIMITER,
      }
    : env;
  return selectRateLimiter(bindings, (binding) => log(`rate-limit-binding-error:${binding}`));
}

function featureEnvForContactHelpers(env: FeatureRequestEnv): Parameters<typeof corsOrigin>[1] {
  return { CONTACT_ALLOWED_ORIGINS: env.FEATURE_ALLOWED_ORIGINS ?? env.CONTACT_ALLOWED_ORIGINS };
}

export async function handleFeatureRequest(
  request: Request,
  env: FeatureRequestEnv,
  now: number = Date.now(),
  deps: FeatureHandlerDeps = {},
): Promise<Response> {
  const helperEnv = featureEnvForContactHelpers(env);
  const origin = corsOrigin(request, helperEnv);

  if (request.method === "OPTIONS") {
    if (origin === null) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        ...(origin ? { "access-control-allow-origin": origin, vary: "origin" } : {}),
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
      },
    });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "method not allowed" }, origin, { allow: "POST, OPTIONS" });
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: "body too large" }, origin);
  }
  const body = await readBodyCapped(request, MAX_BODY_BYTES);
  if (body === null) return jsonResponse(413, { error: "body too large" }, origin);

  let parsed: unknown;
  let parseFailed = false;
  try {
    parsed = JSON.parse(body);
  } catch {
    parseFailed = true;
  }

  if (!parseFailed && honeypotFilled(parsed)) {
    log("honeypot-dropped");
    return jsonResponse(200, { ok: true }, origin);
  }

  if (!request.headers.get("origin")) return jsonResponse(403, { error: "origin required" }, null);
  if (origin === null) return jsonResponse(403, { error: "origin not allowed" }, null);

  // Not-open gate: no (valid) Discord webhook, or no Turnstile secret,
  // means the owner has not finished setup — say so honestly instead of
  // accepting text nobody will read. The URL itself is never echoed.
  const webhookUrl = env.FEATURE_DISCORD_WEBHOOK_URL?.trim();
  if (!webhookUrl || !isDiscordWebhookUrl(webhookUrl) || !env.FEATURE_TURNSTILE_SECRET_KEY?.trim()) {
    log("not-open");
    return jsonResponse(503, { error: FEATURE_NOT_OPEN_MESSAGE }, origin);
  }

  if (parseFailed) return jsonResponse(400, { error: "invalid JSON" }, origin);
  const result = validateFeatureRequest(parsed);
  if ("problems" in result) {
    return jsonResponse(400, { error: "invalid feature request", problems: result.problems }, origin);
  }
  if (result.honeypot) {
    log("honeypot-dropped");
    return jsonResponse(200, { ok: true }, origin);
  }

  // Turnstile: a missing token is a failed verification, not a pass.
  const ip = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
  const verify =
    deps.verifyTurnstile ??
    ((token: string, remoteIp?: string) =>
      verifyTurnstileToken(token, env.FEATURE_TURNSTILE_SECRET_KEY, deps.fetchFn, remoteIp));
  if (!result.turnstileToken || !(await verify(result.turnstileToken, ip))) {
    log("turnstile-failed", result.value.subject);
    return jsonResponse(403, { error: "turnstile verification failed" }, origin);
  }

  const slot = await featureRateLimiter(env).take(ip, now);
  if (!slot.allowed) {
    log("rate-limited", result.value.subject);
    return jsonResponse(429, { error: "too many requests — try again later" }, origin, {
      "retry-after": String(slot.retryAfterSec),
    });
  }

  const fetchFn = deps.fetchFn ?? ((input, init) => fetch(input, init));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FORWARD_TIMEOUT_MS);
  try {
    const res = await fetchFn(webhookUrl, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: formatFeatureRequestPost({ ...result.value, receivedAt: new Date(now).toISOString() }),
        allowed_mentions: { parse: [] },
        flags: DISCORD_FLAG_SUPPRESS_EMBEDS,
      }),
    });
    if (!res.ok) {
      log("delivery-failed", result.value.subject);
      return jsonResponse(502, { error: "could not deliver — try again later" }, origin);
    }
  } catch {
    log("delivery-failed", result.value.subject);
    return jsonResponse(502, { error: "could not deliver — try again later" }, origin);
  } finally {
    clearTimeout(timer);
  }
  log("delivered", result.value.subject);
  return jsonResponse(200, { ok: true, stored: true }, origin);
}

// --- Runtime env reading (mirrors readContactRuntimeEnv) ---------------------

const CLOUDFLARE_WORKERS_SPECIFIER = "cloudflare:workers";

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function readFeatureRequestEnv(): FeatureRequestEnv {
  try {
    const procEnv = (globalThis as { process?: { env?: Record<string, unknown> } }).process?.env;
    const nitroEnv = (globalThis as { __env__?: Record<string, unknown> }).__env__;
    return {
      FEATURE_DISCORD_WEBHOOK_URL:
        nonEmptyString(nitroEnv?.FEATURE_DISCORD_WEBHOOK_URL) ??
        nonEmptyString(procEnv?.FEATURE_DISCORD_WEBHOOK_URL),
      FEATURE_TURNSTILE_SECRET_KEY:
        nonEmptyString(nitroEnv?.FEATURE_TURNSTILE_SECRET_KEY) ??
        nonEmptyString(procEnv?.FEATURE_TURNSTILE_SECRET_KEY),
      FEATURE_ALLOWED_ORIGINS:
        nonEmptyString(nitroEnv?.FEATURE_ALLOWED_ORIGINS) ?? nonEmptyString(procEnv?.FEATURE_ALLOWED_ORIGINS),
      CONTACT_ALLOWED_ORIGINS:
        nonEmptyString(nitroEnv?.CONTACT_ALLOWED_ORIGINS) ?? nonEmptyString(procEnv?.CONTACT_ALLOWED_ORIGINS),
    };
  } catch {
    return {};
  }
}

export async function readFeatureRequestRuntimeEnv(): Promise<FeatureRequestEnv> {
  const fallback = readFeatureRequestEnv();
  const bindings = await readRateLimitBindings();
  let cf: FeatureRequestEnv = {};
  try {
    const mod = (await import(/* @vite-ignore */ CLOUDFLARE_WORKERS_SPECIFIER)) as {
      env?: Record<string, unknown>;
    };
    const workerEnv = mod?.env;
    if (workerEnv && typeof workerEnv === "object") {
      cf = {
        FEATURE_DISCORD_WEBHOOK_URL: nonEmptyString(workerEnv.FEATURE_DISCORD_WEBHOOK_URL),
        FEATURE_TURNSTILE_SECRET_KEY: nonEmptyString(workerEnv.FEATURE_TURNSTILE_SECRET_KEY),
        FEATURE_ALLOWED_ORIGINS: nonEmptyString(workerEnv.FEATURE_ALLOWED_ORIGINS),
        CONTACT_ALLOWED_ORIGINS: nonEmptyString(workerEnv.CONTACT_ALLOWED_ORIGINS),
        FEATURE_RATE_LIMITER: workerEnv.FEATURE_RATE_LIMITER,
        FEATURE_GLOBAL_RATE_LIMITER: workerEnv.FEATURE_GLOBAL_RATE_LIMITER,
      };
    }
  } catch {
    cf = {};
  }
  return {
    FEATURE_DISCORD_WEBHOOK_URL: cf.FEATURE_DISCORD_WEBHOOK_URL ?? fallback.FEATURE_DISCORD_WEBHOOK_URL,
    FEATURE_TURNSTILE_SECRET_KEY: cf.FEATURE_TURNSTILE_SECRET_KEY ?? fallback.FEATURE_TURNSTILE_SECRET_KEY,
    FEATURE_ALLOWED_ORIGINS: cf.FEATURE_ALLOWED_ORIGINS ?? fallback.FEATURE_ALLOWED_ORIGINS,
    CONTACT_ALLOWED_ORIGINS: cf.CONTACT_ALLOWED_ORIGINS ?? fallback.CONTACT_ALLOWED_ORIGINS,
    FEATURE_RATE_LIMITER: cf.FEATURE_RATE_LIMITER,
    FEATURE_GLOBAL_RATE_LIMITER: cf.FEATURE_GLOBAL_RATE_LIMITER,
    ...bindings,
  };
}
