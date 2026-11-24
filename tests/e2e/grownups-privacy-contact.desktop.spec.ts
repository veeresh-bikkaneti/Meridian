import { resetContactStateForTests } from "../harness/module-seams.ts";
import http from "node:http";
import { test, expect, type Page, type Locator } from "playwright/test";
import { serveBuiltArtifact, APP_NO_IDLE } from "./helpers";
import {
  handleContactRequest,
  readContactRuntimeEnv,
} from "../../src/lib/contact/contact-handler.server";

/**
 * 2026-10-21 review remediation (P0-3, P1-5, P2-11 + the contact form)
 * + 2026-10-27 contact webhook enablement & full-stack E2E verification
 * + 2026-10-27 Home UX polish (unified Scout Map pill, whole-card journal
 *   & grown-ups click, high-visibility inline links, and navbar CONTACT).
 *
 * Unit tests cover the pieces; this proves the home page wires them up in
 * the built artifact AND exercises all moving parts of `/contact` end-to-end
 * against the real server handler (`handleContactRequest` + `readContactRuntimeEnv`)
 * and a real local HTTP Discord webhook receiver:
 *   1. `public/flags.json` loader (`loadFlags()`) fetches `/flags.json` and
 *      enables `contactEndpoint`.
 *   2. Client UI & `GrownUpGate` math challenge unlock the form; client-side
 *      validation checks topic, message, optional `replyTo`, and hidden
 *      `website` honeypot.
 *   3. Server `/api/contact` guards: `Origin` check (403 on disallowed/missing
 *      origin, CORS headers on allowed cross-origin), `Content-Length` / stream
 *      body cap (413), rate limiter (429 + `Retry-After` after 3 requests /
 *      10 min per client IP), and honeypot (`200 { ok: true }` silent drop with
 *      zero webhook calls).
 *   4. Runtime env / secret resolution (`readContactRuntimeEnv()`) selects
 *      `DiscordWebhookSink` when `CONTACT_DISCORD_WEBHOOK_URL` is configured
 *      (and `NoopSink` when unset).
 *   5. Outbound Discord webhook HTTP POST (`https://discord.com/api/webhooks/...`)
 *      delivers formatted message with code-fenced `replyTo` & `message`,
 *      `allowed_mentions: { parse: [] }`, and `flags: 4` (SUPPRESS_EMBEDS).
 *   6. Browser post-submit state renders `[data-testid="contact-sent"]` with
 *      "Thanks — we received your request and will get back to you." and
 *      resets form fields ONLY on confirmed delivery (stored:true, #220);
 *      on stored:false it renders the honest `[data-testid="contact-error"]`
 *      not-delivered state and preserves the draft, and likewise renders
 *      `[data-testid="contact-error"]` when rate-limited (429).
 */
test.setTimeout(180_000);

interface CapturedDiscordWebhookCall {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: {
    content: string;
    allowed_mentions: { parse: string[] };
    flags: number;
  };
}

/**
 * Starts a real local HTTP server on 127.0.0.1 to act as the Discord webhook
 * receiver, and redirects outbound `https://discord.com/api/webhooks/...`
 * fetches from `DiscordWebhookSink` to that local server so the entire HTTP
 * pipeline runs over real sockets without touching external Discord servers.
 */
async function startLocalDiscordWebhookReceiver() {
  const calls: CapturedDiscordWebhookCall[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      // A non-webhook client can hit this port with an empty body. Ignore it.
      // The assertions below still require the real JSON posts.
      if (!raw) {
        res.writeHead(204);
        res.end();
        return;
      }
      calls.push({
        method: req.method ?? "UNKNOWN",
        url: req.url ?? "",
        headers: req.headers,
        body: JSON.parse(raw) as CapturedDiscordWebhookCall["body"],
      });
      res.writeHead(204);
      res.end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr.startsWith("https://discord.com/api/webhooks/")) {
      const u = new URL(urlStr);
      return originalFetch(`http://127.0.0.1:${port}${u.pathname}${u.search}`, init);
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  return {
    calls,
    async close() {
      globalThis.fetch = originalFetch;
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

test.beforeEach(async ({ context }) => {
  resetContactStateForTests();
  await serveBuiltArtifact(context);
});

test("footer links reach the privacy notice and the tour stays reachable", async ({ page }) => {
  await page.goto(APP_NO_IDLE);
  await expect(page.getByTestId("take-tour-link")).toBeVisible();
  // Footer kids-privacy promise: factual claims only, never a "COPPA
  // compliant" badge (see the comment in game-app.tsx).
  const note = page.getByTestId("kids-privacy-note");
  await expect(note).toBeVisible();
  await expect(note).toContainText(/no tracking cookies/i);
  // The promise is about players only — grown-ups using the contact form do
  // send a message — so the "from players" qualifier must stay in the copy.
  await expect(note).toContainText(/from players/i);
  await expect(note).not.toContainText(/compliant/i);
  await page.getByTestId("privacy-link").click();
  await expect(page).toHaveURL(/\/privacy$/);
  // The COPPA posture is the headline claim; lock the wording a parent reads.
  await expect(page.getByText(/every visitor as a child/i).first()).toBeVisible();
  // Contact-message disclosures: the processor is named, retention is stated,
  // the server keeps nothing, and the gate is NOT presented as verified
  // parental consent.
  await expect(page.getByText(/The form is not switched on yet/i)).toHaveCount(0);
  await expect(page.getByText(/Discord receives the message/i)).toBeVisible();
  await expect(page.getByText(/within 90 days/i).first()).toBeVisible();
  await expect(page.getByText(/Our server keeps nothing/i)).toBeVisible();
  await expect(page.getByText(/not a parental-consent mechanism/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Contact us" }).first()).toBeVisible();
});

test("full-stack E2E: contact form exercises all moving parts (flags, gate, real /api/contact handler, Discord webhook HTTP sink, honeypot, CORS/Origin guards, and rate limiter)", async ({
  context,
  page,
}) => {
  const webhookReceiver = await startLocalDiscordWebhookReceiver();
  const prevWebhookEnv = process.env.CONTACT_DISCORD_WEBHOOK_URL;
  const prevAllowedOriginsEnv = process.env.CONTACT_ALLOWED_ORIGINS;
  process.env.CONTACT_DISCORD_WEBHOOK_URL =
    "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123456789?wait=true";
  // The harness origin is cross-origin to the live worker URL this test posts to.
  process.env.CONTACT_ALLOWED_ORIGINS = "http://127.0.0.1:4123";

  let simulatedClientIp = "198.51.100.10";
  const serverResponses: Array<{ status: number; body: unknown; headers: Record<string, string> }> =
    [];
  const browserPosts: Array<{
    method: string;
    contentType: string | null;
    cookie: string | null;
    referer: string | null;
    origin: string | null;
  }> = [];

  try {
    // Wire the browser's requests to https://meridian.knowledgetest.workers.dev/api/contact
    // directly into the REAL server handler (`handleContactRequest` + `readContactRuntimeEnv`),
    // NOT a static mock response.
    await context.route("https://meridian.knowledgetest.workers.dev/api/contact", async (route) => {
      const pwReq = route.request();
      const headers = new Headers(await pwReq.allHeaders());
      if (!headers.has("cf-connecting-ip")) {
        headers.set("cf-connecting-ip", simulatedClientIp);
      }
      const method = pwReq.method();
      const rawBody = pwReq.postDataBuffer();
      browserPosts.push({
        method,
        contentType: headers.get("content-type"),
        cookie: headers.get("cookie"),
        referer: headers.get("referer"),
        origin: headers.get("origin"),
      });
      const webReq = new Request(pwReq.url(), {
        method,
        headers,
        body: method !== "GET" && method !== "HEAD" && rawBody ? new Uint8Array(rawBody) : undefined,
      });

      const env = await readContactRuntimeEnv();
      const webRes = await handleContactRequest(webReq, env);
      const resBodyText = await webRes.text();
      const resHeaders: Record<string, string> = {};
      webRes.headers.forEach((v, k) => {
        resHeaders[k] = v;
      });
      let parsedBody: unknown = null;
      try {
        parsedBody = resBodyText ? JSON.parse(resBodyText) : null;
      } catch {
        parsedBody = resBodyText;
      }
      serverResponses.push({ status: webRes.status, body: parsedBody, headers: resHeaders });

      await route.fulfill({
        status: webRes.status,
        headers: resHeaders,
        body: resBodyText,
      });
    });

    // Moving Part 1 & 2: Navigate to /contact, fetch real /flags.json, and unlock GrownUpGate
    await page.goto(APP_NO_IDLE);
    // The boot splash paints the shared footer too, so the contact link
    // exists twice until the home screen replaces the splash. The tour
    // button renders only in the home footer — wait for it, as the
    // footer-links test above does, so the click names one element.
    await expect(page.getByTestId("take-tour-link")).toBeVisible();
    await page.getByTestId("contact-link").click();
    await expect(page).toHaveURL(/\/contact$/);

    const gate = page.getByTestId("grownup-gate");
    await expect(gate).toBeVisible();
    await expect(page.getByTestId("contact-form")).toHaveCount(0);

    const question = await page.locator(".agep-question").textContent();
    const m = question?.match(/(\d+) × (\d+)/);
    expect(m).not.toBeNull();
    for (const d of String(Number(m![1]) * Number(m![2]))) await page.keyboard.press(d);
    await page.keyboard.press("Enter");

    const form = page.getByTestId("contact-form");
    await expect(form).toBeVisible();
    await expect(page.getByTestId("contact-parked-note")).toHaveCount(0);
    await expect(page.getByTestId("contact-kid-note")).toBeVisible();

    // a11y (#220 blockers round): both result live regions are in the DOM,
    // empty, BEFORE any send — a live region inserted together with its
    // text is not reliably announced. Results are rendered INTO them.
    const statusRegion = page.getByTestId("contact-status-region");
    const alertRegion = page.getByTestId("contact-alert-region");
    await expect(statusRegion).toHaveAttribute("role", "status");
    await expect(statusRegion).toBeEmpty();
    await expect(alertRegion).toHaveAttribute("role", "alert");
    await expect(alertRegion).toBeEmpty();

    // Moving Part 3, 4, 5, 6: Real browser submission -> real server validation ->
    // real DiscordWebhookSink HTTP POST to local receiver -> 200 { ok: true, stored: true } ->
    // confirmation banner shown & form reset.
    await form.locator("select").selectOption("privacy");
    await form.locator("textarea").fill("Please verify full E2E pipeline");
    await form.locator('input[type="email"]').fill("parent@example.com");
    await form.getByRole("button", { name: /send/i }).click();

    const sentBanner = page.getByTestId("contact-sent");
    await expect(sentBanner).toBeVisible();
    await expect(sentBanner).toContainText(
      "Thanks — we received your request and will get back to you.",
    );
    await expect(form.locator("textarea")).toHaveValue("");
    await expect(form.locator('input[type="email"]')).toHaveValue("");
    // Announced once: the thank-you sits inside the pre-existing polite
    // region and carries no live role of its own (no double announcement).
    await expect(statusRegion.getByTestId("contact-sent")).toBeVisible();
    await expect(sentBanner).not.toHaveAttribute("role");
    await expect(alertRegion).toBeEmpty();

    expect(serverResponses).toHaveLength(1);
    expect(serverResponses[0].status).toBe(200);
    expect(serverResponses[0].body).toEqual({ ok: true, stored: true });
    expect(serverResponses[0].headers["access-control-allow-origin"]).toBe("http://127.0.0.1:4123");
    // The post rides the shared transport with no cookies and no referrer.
    // Origin stays: the server's CORS and Origin guard still sees the page.
    expect(browserPosts[0]?.method).toBe("POST");
    expect(browserPosts[0]?.contentType).toContain("application/json");
    expect(browserPosts[0]?.cookie).toBeNull();
    expect(browserPosts[0]?.referer).toBeNull();
    expect(browserPosts[0]?.origin).toBe("http://127.0.0.1:4123");

    expect(webhookReceiver.calls).toHaveLength(1);
    expect(webhookReceiver.calls[0].method).toBe("POST");
    expect(webhookReceiver.calls[0].url).toBe(
      "/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123456789?wait=true",
    );
    expect(webhookReceiver.calls[0].body.allowed_mentions).toEqual({ parse: [] });
    expect(webhookReceiver.calls[0].body.flags).toBe(4);
    expect(webhookReceiver.calls[0].body.content).toContain("**Meridian contact** · topic: privacy");
    expect(webhookReceiver.calls[0].body.content).toContain("```text\nparent@example.com\n```");
    expect(webhookReceiver.calls[0].body.content).toContain(
      "```text\nPlease verify full E2E pipeline\n```",
    );
    expect(webhookReceiver.calls[0].body.content).toContain("within 90 days");

    // Moving Part 4b (Fallback when webhook secret is unset -> NoopSink returns stored: false,
    // and the browser is HONEST about it (#220): no thank-you banner, the
    // not-delivered state in the not-configured wording, and the draft is
    // preserved verbatim so the visitor keeps their words):
    delete process.env.CONTACT_DISCORD_WEBHOOK_URL;
    await form.locator("select").selectOption("other");
    await form.locator("textarea").fill("Follow-up question when sink is NoopSink");
    const noopResponse = page.waitForResponse(
      (res) => res.url().includes("/api/contact") && res.request().method() === "POST",
    );
    await form.getByRole("button", { name: /send/i }).click();

    // Honesty gate: judge the page only AFTER the stored:false response has
    // arrived and a result has rendered. (Checking right after the click
    // would pass trivially: the previous thank-you is cleared when a send
    // starts.) The count below is deliberately non-retrying.
    await noopResponse;
    const notDeliveredBanner = page.getByTestId("contact-error");
    await expect(sentBanner.or(notDeliveredBanner)).toBeVisible();
    expect(await sentBanner.count(), "no thank-you after a stored:false response").toBe(0);
    await expect(notDeliveredBanner).toBeVisible();
    await expect(notDeliveredBanner).toContainText("isn't switched on yet");
    await expect(alertRegion.getByTestId("contact-error")).toBeVisible();
    await expect(notDeliveredBanner).not.toHaveAttribute("role");
    await expect(statusRegion).toBeEmpty();
    // Keep a handle on this result node: the next send (Part 3b) ends in the
    // SAME wording, and it must be a fresh insertion so it is announced again.
    const firstNotDelivered = await notDeliveredBanner.elementHandle();
    expect(serverResponses).toHaveLength(2);
    expect(serverResponses[1].status).toBe(200);
    expect(serverResponses[1].body).toEqual({ ok: true, stored: false });
    // Webhook receiver was NOT called for NoopSink
    expect(webhookReceiver.calls).toHaveLength(1);
    // Draft preserved: topic and message exactly as typed.
    await expect(form.locator("select")).toHaveValue("other");
    await expect(form.locator("textarea")).toHaveValue("Follow-up question when sink is NoopSink");

    // Re-enable webhook secret for remaining moving parts
    process.env.CONTACT_DISCORD_WEBHOOK_URL =
      "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123456789?wait=true";

    // Moving Part 3b (Honeypot filled in browser -> 200 { ok: true } silent drop, +0 webhook calls):
    await form.locator("select").selectOption("bug");
    await form.locator("textarea").fill("Bot spam submission");
    await form.locator('input[type="text"]').fill("https://spam-bot.example");
    await form.getByRole("button", { name: /send/i }).click();

    // The honeypot 200 carries no `stored` flag, so on the client it is
    // indistinguishable from a not-delivered send (#220 honesty states):
    // no thank-you and the text stays in the box. The drop itself is
    // proven server-side — 200 { ok: true } and zero webhook calls.
    await expect.poll(() => serverResponses.length).toBe(3);
    await expect(form.locator("textarea")).toHaveValue("Bot spam submission");
    // Same wording as Part 4b, but a NEW node in the alert region: the stale
    // result was cleared when this send started, so the repeat is announced.
    await expect(alertRegion.getByTestId("contact-error")).toContainText("isn't switched on yet");
    expect(await firstNotDelivered!.evaluate((el) => el.isConnected)).toBe(false);
    expect(serverResponses).toHaveLength(3);
    expect(serverResponses[2].status).toBe(200);
    expect(serverResponses[2].body).toEqual({ ok: true });
    // Honeypot must NOT trigger the Discord webhook receiver!
    expect(webhookReceiver.calls).toHaveLength(1);

    // Moving Part 3b' (SPEC §3.2 order — rate limit runs LAST, just before the sink):
    // the honeypot drop above spent NO rate-limit quota, so after clearing the
    // honeypot this same client IP can still deliver a real message — its 3rd
    // COUNTED request (Parts 3 and 4b were the first two).
    await form.locator('input[type="text"]').fill("");
    await form.locator("select").selectOption("bug");
    await form.locator("textarea").fill("Third counted message from same IP is still delivered");
    await form.getByRole("button", { name: /send/i }).click();
    await expect(sentBanner).toBeVisible();
    await expect.poll(() => serverResponses.length).toBe(4);
    expect(serverResponses[3].status).toBe(200);
    expect(serverResponses[3].body).toEqual({ ok: true, stored: true });
    expect(webhookReceiver.calls).toHaveLength(2);

    // Moving Part 3c (Rate limiter: 4th COUNTED submission from same client IP
    // `198.51.100.10` within 10m -> 429 with Retry-After header, and browser
    // displays rate-limit alert):
    await form.locator("select").selectOption("bug");
    await form.locator("textarea").fill("Fourth message from same IP triggers rate limit");
    await form.getByRole("button", { name: /send/i }).click();

    const errorBanner = page.getByTestId("contact-error");
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText(
      "That's a lot of messages in a short time — please try again in a few minutes.",
    );
    await expect(alertRegion.getByTestId("contact-error")).toBeVisible();
    await expect(statusRegion).toBeEmpty();
    expect(serverResponses).toHaveLength(5);
    expect(serverResponses[4].status).toBe(429);
    expect(Number(serverResponses[4].headers["retry-after"])).toBeGreaterThan(0);
    expect(webhookReceiver.calls).toHaveLength(2);

    // Moving Part 3d (Cross-origin CORS preflight + harness origin + Disallowed origin):
    const env = await readContactRuntimeEnv();
    const preflightRes = await handleContactRequest(
      new Request("https://meridian.knowledgetest.workers.dev/api/contact", {
        method: "OPTIONS",
        headers: { origin: "http://127.0.0.1:4123" },
      }),
      env,
    );
    expect(preflightRes.status).toBe(204);
    expect(preflightRes.headers.get("access-control-allow-origin")).toBe(
      "http://127.0.0.1:4123",
    );

    const pagesPostRes = await handleContactRequest(
      new Request("https://meridian.knowledgetest.workers.dev/api/contact", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://127.0.0.1:4123",
          "cf-connecting-ip": "198.51.100.99",
        },
        body: JSON.stringify({
          topic: "delete-data",
          message: "Cross-origin request from the harness origin",
        }),
      }),
      env,
    );
    expect(pagesPostRes.status).toBe(200);
    expect(pagesPostRes.headers.get("access-control-allow-origin")).toBe(
      "http://127.0.0.1:4123",
    );
    expect(await pagesPostRes.json()).toEqual({ ok: true, stored: true });
    expect(webhookReceiver.calls).toHaveLength(3);

    const attackerRes = await handleContactRequest(
      new Request("https://meridian.knowledgetest.workers.dev/api/contact", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://attacker.example",
          "cf-connecting-ip": "198.51.100.100",
        },
        body: JSON.stringify({
          topic: "bug",
          message: "Cross-origin request from disallowed origin",
        }),
      }),
      env,
    );
    expect(attackerRes.status).toBe(403);
    expect(await attackerRes.json()).toEqual({ error: "origin not allowed" });
    expect(webhookReceiver.calls).toHaveLength(3);
  } finally {
    if (prevWebhookEnv === undefined) delete process.env.CONTACT_DISCORD_WEBHOOK_URL;
    else process.env.CONTACT_DISCORD_WEBHOOK_URL = prevWebhookEnv;
    if (prevAllowedOriginsEnv === undefined) delete process.env.CONTACT_ALLOWED_ORIGINS;
    else process.env.CONTACT_ALLOWED_ORIGINS = prevAllowedOriginsEnv;
    await webhookReceiver.close();
  }
});

test("contact form fails closed if flags.json omits contactEndpoint", async ({ context, page }) => {
  await context.route("**/flags.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ flags: { globeTierSplit: true }, version: 1 }),
    });
  });

  await page.goto(APP_NO_IDLE);
  // Same settle wait as the full-stack test above: the boot splash
  // paints the shared footer too, so the contact link exists twice
  // until the home screen replaces the splash; the tour button
  // renders only in the home footer.
  await expect(page.getByTestId("take-tour-link")).toBeVisible();
  await page.getByTestId("contact-link").click();
  await expect(page).toHaveURL(/\/contact$/);

  const question = await page.locator(".agep-question").textContent();
  const m = question?.match(/(\d+) × (\d+)/);
  expect(m).not.toBeNull();
  for (const d of String(Number(m![1]) * Number(m![2]))) await page.keyboard.press(d);
  await page.keyboard.press("Enter");

  const form = page.getByTestId("contact-form");
  await expect(form).toBeVisible();
  await form.locator("select").selectOption("bug");
  await form.locator("textarea").fill("Checking kill-switch behavior");
  await form.getByRole("button", { name: /send/i }).click();
  await expect(page.getByTestId("contact-error")).toContainText("isn't switched on yet");
});

test("Begin exploring starts a Globe round", async ({ page }) => {
  await page.goto(APP_NO_IDLE);
  await page.getByTestId("begin-exploring").click();
  await expect(page.locator(".satellite-map")).toBeVisible();
});

/**
 * Fix round 2: after a viewport change (or scroll), layout may still be
 * settling when measurements run — the task-stated CI flake cause.
 * Wait 2 rAFs, then require the nav boxes to be identical on two
 * consecutive reads, and let font swaps finish (document.fonts.ready,
 * best-effort with a short timeout so it can never hang the test).
 * If the flake persists after this fix, the wait was not the cause
 * (rollback note for the report).
 *
 * Shared-shell adoption (fix/ui-shared-shell): the header is now
 * header.site-header, not the pre-adoption home header, and below 1024px its nav
 * collapses behind a Menu button — so this reads the VISIBLE header
 * controls only. The old selector matched nothing after adoption and
 * the wait timed out on an empty read.
 */
async function waitForNavLayoutSettled(page: Page): Promise<void> {
  const readNavBoxes = () =>
    page
      .locator("header.site-header button:visible, header.site-header a:visible")
      .evaluateAll((els) =>
        els
          .map((el) => {
            const b = el.getBoundingClientRect();
            return `${b.x},${b.y},${b.width},${b.height}`;
          })
          .join(";"),
      );
  await page.evaluate(async () => {
    await Promise.race([
      document.fonts.ready.then(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 1000)),
    ]);
  });
  let prev = "";
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    const cur = await readNavBoxes();
    if (cur !== "" && cur === prev) return;
    prev = cur;
  }
  throw new Error("nav boxes did not stabilize after viewport change");
}

// The map-mode popover's clamp tracks its button frame by frame while
// the popover is open, so its box keeps moving for a few frames after
// the click. Owner ruling 2026-11-19: the settled state is the product
// truth — sample the popover the way the nav checks above sample the
// header: wait until two consecutive reads of its box agree.
async function waitForPopoverSettled(page: Page, popover: Locator): Promise<void> {
  const readBox = () =>
    popover.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return `${b.x},${b.y},${b.width},${b.height}`;
    });
  let prev = "";
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    const cur = await readBox();
    if (cur !== "" && cur === prev) return;
    prev = cur;
  }
  throw new Error("popover box did not stabilize after opening");
}

test("home UX polish across 6 viewports: unified map-mode pill, whole-card journal & grownups click, inline links, and navbar CONTACT", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const viewports = [
    [320, 568],
    [375, 667],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1280, 800],
  ] as const;

  await page.goto(APP_NO_IDLE);
  await expect(page.getByTestId("map-mode-button")).toBeVisible();
  const notNow = page.getByRole("button", { name: "Not now" });
  if ((await notNow.count()) > 0) {
    await notNow.click();
    await expect(page.getByTestId("tutorial-invite")).toHaveCount(0);
  }

  // Arrival modal (2026-11-20): after the invite, the read-aloud
  // sheet is the pending prompt and it now HOLDS the page — backdrop,
  // inert page, scroll lock — until it is answered. On main it was a
  // passive overlay and this spec answered it after the viewport
  // loop; under the modal nothing beneath it is reachable first,
  // which is the point. A first-visit player answers it in one tap
  // before touching the page — do the same here, up front. No
  // assertion below changes; only the answer moved earlier.
  const readAloudSheet = page.getByTestId("first-visit-queue");
  if ((await readAloudSheet.count()) > 0 && (await readAloudSheet.getAttribute("data-prompt-id")) === "read-aloud-sheet") {
    await readAloudSheet.getByRole("button", { name: /Never/ }).click();
    await expect(page.locator('[data-prompt-id="read-aloud-sheet"]')).toHaveCount(0);
  }

  for (const [w, h] of viewports) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => window.scrollTo(0, 0));
    // Fix round 2: never measure right after a viewport change —
    // wait for layout to settle first (CI flake cause).
    await waitForNavLayoutSettled(page);

    // Header nav items >=44px tall and 0 overlap. The adopted shared
    // shell header is header.site-header (was the pre-adoption home header before the
    // fix/ui-shared-shell adoption); only visible controls are measured
    // — below 1024px the nav collapses behind the Menu button.
    const navItems = page.locator("header.site-header button:visible, header.site-header a:visible");
    const count = await navItems.count();
    const boxes: { x: number; y: number; width: number; height: number }[] = [];
    for (let i = 0; i < count; i++) {
      const b = (await navItems.nth(i).boundingBox())!;
      expect(b.height, `${w}x${h} nav item #${i} height`).toBeGreaterThanOrEqual(43.5);
      boxes.push(b);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const ox = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
        const oy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
        expect(ox * oy, `${w}x${h} nav overlap`).toBeLessThan(1);
      }
    }

    // CONTACT stays a >=44px target at every width: inline in the nav
    // from 1024px, behind the Menu button below that (the adopted
    // header's collapse). Measure whichever copy is visible; close the
    // menu again so the rest of the loop sees the resting header.
    const navContact = page.locator('[data-testid="nav-contact-link"]:visible');
    let menuOpened = false;
    if ((await navContact.count()) === 0) {
      await page.locator(".site-header-menu-button").click();
      menuOpened = true;
      await expect(navContact).toHaveCount(1);
    }
    const cBox = (await navContact.boundingBox())!;
    expect(cBox.width).toBeGreaterThanOrEqual(44);
    expect(cBox.height).toBeGreaterThanOrEqual(44);
    if (menuOpened) {
      await page.locator(".site-header-menu-button").click();
      await expect(page.locator(".site-header-panel")).toHaveCount(0);
    }

    // Map-mode popover opens directly below map-mode-button and scrolls WITH the button
    const mapBtnVp = page.getByTestId("map-mode-button");
    await mapBtnVp.click();
    const popVp = page.getByTestId("map-mode-popover");
    await expect(popVp).toBeVisible();
    // Settled-state sampling (owner ruling 2026-11-19): the popover's
    // clamp tracks the button for a few frames after opening, so
    // measure only once its box has stopped moving.
    await waitForPopoverSettled(page, popVp);
    const btnBefore = (await mapBtnVp.boundingBox())!;
    const popBefore = (await popVp.boundingBox())!;
    expect(
      Math.abs(popBefore.y - (btnBefore.y + btnBefore.height + 8)),
      `${w}x${h} popover top must be 8px below button bottom before scroll`,
    ).toBeLessThanOrEqual(2);
    expect(popBefore.x, `${w}x${h} popover left margin`).toBeGreaterThanOrEqual(8);
    expect(popBefore.x + popBefore.width, `${w}x${h} popover right margin`).toBeLessThanOrEqual(w - 8);

    await page.evaluate(() => window.scrollBy(0, 200));
    // Fix round 2: same settle wait before the post-scroll measurements.
    await waitForNavLayoutSettled(page);
    const btnAfter = (await mapBtnVp.boundingBox())!;
    const popAfter = (await popVp.boundingBox())!;
    expect(
      Math.abs(popAfter.y - (btnAfter.y + btnAfter.height + 8)),
      `${w}x${h} popover top must remain 8px below button bottom after scroll`,
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs(popBefore.y - popAfter.y),
      `${w}x${h} popover must scroll with the page instead of staying fixed`,
    ).toBeGreaterThanOrEqual(150);

    await page.keyboard.press("Escape");
    await expect(popVp).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  // 1. Unified map-mode pill button contains map-mode-indicator inside map-mode-button
  const mapBtn = page.getByTestId("map-mode-button");
  const indicator = mapBtn.getByTestId("map-mode-indicator");
  await mapBtn.scrollIntoViewIfNeeded();
  const btnBox = (await mapBtn.boundingBox())!;
  expect(btnBox.width).toBeGreaterThanOrEqual(44);
  expect(btnBox.height).toBeGreaterThanOrEqual(44);
  await indicator.click();
  await expect(page.getByTestId("map-mode-popover")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("map-mode-popover")).toHaveCount(0);

  // (The read-aloud sheet was answered up front, right after the
  // invite: as an arrival modal it holds the page until then.)

  // 2. Whole-card click on the teaser card's text & illustration scrolls & focuses #home-journal.
  // Item 42 (PR #522) removed the teaser card's own "What the land remembers"
  // heading — the journal section below carries the one heading (pinned by
  // src/components/home-journal-heading.test.ts) — so the text click target
  // is the card's intro line, and the card must have no h2 of its own.
  const journalCard = page.getByTestId("journal-card");
  await journalCard.scrollIntoViewIfNeeded();
  await expect(journalCard.locator("h2")).toHaveCount(0);
  const journalText = (await journalCard.locator("p", { hasText: "Short field stories" }).boundingBox())!;
  await page.mouse.click(journalText.x + journalText.width / 2, journalText.y + journalText.height / 2);
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id ?? null))
    .toBe("home-journal");

  await journalCard.scrollIntoViewIfNeeded();
  const journalArt = (await journalCard.locator(".hv5-art").boundingBox())!;
  await page.mouse.click(journalArt.x + journalArt.width / 2, journalArt.y + journalArt.height / 2);
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id ?? null))
    .toBe("home-journal");

  // 3. Navbar GET INVOLVED scrolls & focuses #home-grownups ("For grown-ups" card)
  const getInvolvedBtn = page.locator("header.site-header nav").getByRole("button", { name: "GET INVOLVED" });
  await getInvolvedBtn.scrollIntoViewIfNeeded();
  await getInvolvedBtn.click();
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id ?? null))
    .toBe("home-grownups");

  // 4. Whole-card click on "For grown-ups" heading & illustration opens the grown-up math gate modal
  const grownupsCard = page.getByTestId("grownups-card");
  await grownupsCard.scrollIntoViewIfNeeded();
  const grownupsH2 = (await grownupsCard.locator("h2", { hasText: "For grown-ups" }).boundingBox())!;
  await page.mouse.click(grownupsH2.x + grownupsH2.width / 2, grownupsH2.y + grownupsH2.height / 2);
  await expect(page.getByTestId("grownup-gate")).toBeVisible();
  await page.getByRole("button", { name: "Cancel and go back" }).click();
  await expect(page.getByTestId("grownup-gate")).toHaveCount(0);

  await grownupsCard.scrollIntoViewIfNeeded();
  const grownupsArt = (await grownupsCard.locator(".hv5-art").boundingBox())!;
  await page.mouse.click(grownupsArt.x + grownupsArt.width / 2, grownupsArt.y + grownupsArt.height / 2);
  await expect(page.getByTestId("grownup-gate")).toBeVisible();
  await page.getByRole("button", { name: "Cancel and go back" }).click();
  await expect(page.getByTestId("grownup-gate")).toHaveCount(0);

  // 5. Inline links inside "For grown-ups" navigate independently without opening the home modal
  await grownupsCard.scrollIntoViewIfNeeded();
  await grownupsCard.getByRole("link", { name: "privacy notice" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await page.goBack();
  await expect(grownupsCard).toBeVisible();

  await grownupsCard.scrollIntoViewIfNeeded();
  await grownupsCard.getByRole("link", { name: "contact us" }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await page.goBack();
  await expect(grownupsCard).toBeVisible();

  // 6. Top navbar CONTACT link right after ABOUT navigates to /contact
  const navContact = page.getByTestId("nav-contact-link");
  await navContact.scrollIntoViewIfNeeded();
  await expect(navContact).toBeVisible();
  await navContact.click();
  await expect(page).toHaveURL(/\/contact$/);
});
