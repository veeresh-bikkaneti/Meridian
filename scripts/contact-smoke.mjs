#!/usr/bin/env node
/**
 * contact-smoke.mjs — activation smoke test for POST /api/contact (WI-4).
 *
 *   node --experimental-strip-types scripts/contact-smoke.mjs \
 *     --url https://meridian.knowledgetest.workers.dev --yes-send-real-messages [--recovery]
 *
 * It refuses to run without --yes-send-real-messages, and it stops before
 * sending anything if the readiness check does not say "discord".
 * RUN THIS ONLY AFTER the owner has set the worker secret, and only with the
 * form still OFF (no contactEndpoint in flags.json). It sends REAL messages:
 * up to 3 land in the private Discord channel, each starting "[smoke]" and
 * carrying a run id, so a person can find and delete them (retention.ts).
 *
 * Every check is HTTP-observable, so a no-op cannot pass:
 *   - readiness: GET /api/contact must say the sink is "discord".
 *   - delivery: a gated POST from the site's own origin must answer
 *     { ok: true, stored: true }. `stored` is true ONLY when Discord itself
 *     accepted the webhook call (DiscordWebhookSink.deliver), so a parked
 *     NoopSink (stored: false) fails here — the exact false green this
 *     project already shipped once.
 *   - honeypot: 200 { ok: true } with NO `stored` field, with and without an
 *     Origin header (silent, nothing delivered).
 *   - refusals: no Origin and a foreign Origin → 403; over-size body → 413.
 *   - rate limit: valid posts until a 429 with a Retry-After header, within
 *     MAX_ATTEMPTS. --recovery also waits out Retry-After and checks that the
 *     next post is accepted again.
 * What it cannot see — message formatting, suppressed mentions, the reply-to
 * line — a person confirms in Discord (the script prints what to look for).
 * "A look-alike webhook URL fails closed" cannot be tested on a live worker
 * without changing its secret; it is pinned in
 * src/lib/contact/contact-handler.server.test.ts.
 *
 * Exits 0 only if every check passes.
 */
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

/** Same-origin POSTs in a row before the in-memory limiter (3 / 10 min) must have said no. */
const MAX_ATTEMPTS = 6;

/**
 * Run all checks. `fetchFn` and `sleep` are injectable so the suite can run
 * it against an in-process worker (scripts/contact-smoke.test.mjs).
 * Returns [{ name, ok, detail }].
 */
export async function runSmoke({ origin, fetchFn = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), recovery = false, runId = randomBytes(4).toString("hex") }) {
  const base = origin.replace(/\/+$/, "");
  const endpoint = `${base}/api/contact`;
  const results = [];
  const check = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail });

  const post = (body, headers = { origin: base }) =>
    fetchFn(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  const asJson = async (res) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };

  // 1. Readiness — what the live worker was really given.
  try {
    const res = await fetchFn(endpoint, { method: "GET" });
    const body = await asJson(res);
    check("readiness: GET /api/contact reports the discord sink", res.status === 200 && body?.sink === "discord", `status ${res.status}, sink ${JSON.stringify(body?.sink)}`);
  } catch (err) {
    check("readiness: GET /api/contact reports the discord sink", false, String(err));
  }

  // Stop here if the worker is not wired. Everything below sends POSTs, and a
  // smoke run against a parked, mistyped or wrong-tenant URL must send nothing.
  if (!results[0].ok) {
    check("aborted: readiness failed, so no messages were sent", true, "nothing was posted");
    return { results, delivered: 0, runId };
  }

  // 2. Delivery — message, then message with a reply-to.
  const msg = (extra) => `[smoke ${runId}] activation test, please ignore${extra ?? ""}`;
  {
    const res = await post({ topic: "other", message: msg() });
    const body = await asJson(res);
    check("delivery: gated POST is stored by Discord", res.status === 200 && body?.ok === true && body?.stored === true, `status ${res.status}, body ${JSON.stringify(body)}`);
  }
  {
    const res = await post({ topic: "other", message: msg(" (with reply-to)"), replyTo: `smoke-${runId}@example.com` });
    const body = await asJson(res);
    check("delivery: POST with a reply-to is stored by Discord", res.status === 200 && body?.stored === true, `status ${res.status}, body ${JSON.stringify(body)}`);
  }

  // 3. Honeypot — silent 200, never delivered, with and without an Origin.
  for (const [label, headers] of [
    ["same-origin", { origin: base }],
    ["no Origin", {}],
    ["foreign Origin", { origin: "https://evil.example" }],
  ]) {
    const res = await post({ topic: "other", message: msg(" honeypot"), website: "http://spam.example" }, headers);
    const body = await asJson(res);
    check(`honeypot (${label}): silent 200, nothing delivered`, res.status === 200 && body?.ok === true && !("stored" in (body ?? {})), `status ${res.status}, body ${JSON.stringify(body)}`);
  }

  // 4. Refusals.
  {
    const res = await post({ topic: "other", message: msg(" no-origin") }, {});
    check("refusal: a real message with no Origin → 403", res.status === 403, `status ${res.status}`);
  }
  {
    const res = await post({ topic: "other", message: msg(" bad-origin") }, { origin: "https://evil.example" });
    check("refusal: a real message from a foreign Origin → 403", res.status === 403, `status ${res.status}`);
  }
  {
    const res = await post("x".repeat(5000));
    check("refusal: an over-size body → 413", res.status === 413, `status ${res.status}`);
  }

  // 5. Rate limit — valid posts until the limiter says no.
  let limited = null;
  let delivered = results.filter((r) => r.name.startsWith("delivery:") && r.ok).length;
  for (let i = 0; i < MAX_ATTEMPTS && !limited; i++) {
    const res = await post({ topic: "other", message: msg(` rate-limit probe ${i + 1}`) });
    if (res.status === 429) limited = res;
    else if (res.status === 200 && (await asJson(res))?.stored === true) delivered++;
  }
  const retryAfter = Number(limited?.headers.get("retry-after"));
  // The handler's own 429 says "too many messages"; a Cloudflare edge/WAF 429
  // would not, and must not count as the app's limiter.
  const limitedBody = limited ? await asJson(limited) : null;
  const fromHandler = typeof limitedBody?.error === "string" && /too many/i.test(limitedBody.error);
  check("rate limit: the handler trips with 429 and a Retry-After", limited !== null && fromHandler && Number.isFinite(retryAfter) && retryAfter > 0, limited ? `retry-after ${limited.headers.get("retry-after")}s, body ${JSON.stringify(limitedBody)}` : `no 429 within ${MAX_ATTEMPTS} extra posts`);
  if (recovery && limited && Number.isFinite(retryAfter)) {
    await sleep((retryAfter + 1) * 1000);
    const res = await post({ topic: "other", message: msg(" recovery") });
    const body = await asJson(res);
    check("rate limit: recovers after Retry-After", res.status === 200, `status ${res.status}`);
    if (body?.stored === true) delivered++;
  }

  return { results, delivered, runId };
}

/** 0 only when there is at least one check and every check passed. */
export function exitCodeFor(results) {
  return results.length > 0 && results.every((r) => r.ok) ? 0 : 1;
}

async function main() {
  const args = process.argv.slice(2);
  const urlAt = args.indexOf("--url");
  const url = urlAt === -1 ? "" : (args[urlAt + 1] ?? "");
  if (!/^(https:\/\/[^/]+|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?)$/.test(url.replace(/\/+$/, ""))) {
    console.error("usage: contact-smoke.mjs --url https://<origin> --yes-send-real-messages [--recovery]");
    process.exit(2);
  }
  if (!args.includes("--yes-send-real-messages")) {
    console.error(
      "This sends up to 3 REAL messages to the private Discord channel behind that URL.\n" +
        "Re-run with --yes-send-real-messages once the owner has set the secret and the form is still OFF.",
    );
    process.exit(2);
  }
  const { results, delivered, runId } = await runSmoke({ origin: url, recovery: args.includes("--recovery") });
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `  — ${r.detail}`}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  console.log(`In the private Discord channel, look for exactly ${delivered} message(s) starting "[smoke ${runId}]" and confirm by eye:`);
  console.log("  - the layout is right (topic, received time, fenced reply-to, fenced message, retention line)");
  console.log("  - nobody was pinged (no @mentions) and no link previews appeared");
  console.log("  - the reply-to line shows smoke-" + runId + "@example.com on the 'with reply-to' message");
  console.log("  - NO message contains the word 'honeypot' (those must never arrive)");
  console.log("Then delete the [smoke] messages. Any FAIL above means go back to the wiring/config step, never forward.");
  process.exit(exitCodeFor(results));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
