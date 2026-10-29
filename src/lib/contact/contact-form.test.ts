import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContactPayload, sendContact, sendOutcome, CONTACT_MESSAGE_MAX } from "./contact-form.ts";

const draft = { topic: "bug" as const, message: " Map froze ", replyTo: "", website: "" };

test("builds a minimal payload (no replyTo key when blank)", () => {
  const r = buildContactPayload(draft);
  assert.deepEqual(r, { ok: true, payload: { topic: "bug", message: "Map froze", website: "" } });
});

test("rejects missing topic, empty or oversized message, malformed reply-to", () => {
  assert.equal(buildContactPayload({ ...draft, topic: "" }).ok, false);
  assert.equal(buildContactPayload({ ...draft, message: "  " }).ok, false);
  assert.equal(buildContactPayload({ ...draft, message: "x".repeat(CONTACT_MESSAGE_MAX + 1) }).ok, false);
  assert.equal(buildContactPayload({ ...draft, replyTo: "nope" }).ok, false);
  assert.equal(buildContactPayload({ ...draft, replyTo: "grownup@example.com" }).ok, true);
});

test("sendContact maps server answers and never throws", async () => {
  const payload = { topic: "bug" as const, message: "x", website: "" };
  const respond = (status: number, body = "{}") => async () => new Response(body, { status });
  assert.deepEqual(await sendContact(null, payload), { status: "not-configured" });
  assert.deepEqual(await sendContact("https://c.test/contact", payload, respond(200)), { status: "sent", stored: false });
  assert.deepEqual(
    await sendContact("https://c.test/contact", payload, respond(200, '{"ok":true,"stored":true}')),
    { status: "sent", stored: true },
  );
  assert.deepEqual(await sendContact("https://c.test/contact", payload, respond(503)), { status: "not-configured" });
  assert.deepEqual(await sendContact("https://c.test/contact", payload, respond(429)), { status: "rate-limited" });
  assert.deepEqual(await sendContact("https://c.test/contact", payload, respond(500)), { status: "error" });
  assert.deepEqual(
    await sendContact("https://c.test/contact", payload, async () => {
      throw new Error("offline");
    }),
    { status: "error" },
  );
});

test("sendOutcome: delivered ONLY when sent AND stored (the honesty contract, #220)", () => {
  assert.equal(sendOutcome(null), null);
  assert.equal(sendOutcome({ status: "sent", stored: true }), "delivered");
  // Accepted-but-not-stored must never read as delivered: the page shows
  // the honest not-delivered state and keeps the draft.
  assert.equal(sendOutcome({ status: "sent", stored: false }), "not-delivered");
  assert.equal(sendOutcome({ status: "not-configured" }), "not-configured");
  assert.equal(sendOutcome({ status: "rate-limited" }), "rate-limited");
  assert.equal(sendOutcome({ status: "error" }), "error");
});

test("requests omit credentials and referrer", async () => {
  let seen: RequestInit | undefined;
  await sendContact("https://c.test/contact", { topic: "other", message: "x", website: "" }, async (_u, init) => {
    seen = init;
    return new Response("{}", { status: 200 });
  });
  assert.equal(seen?.credentials, "omit");
  assert.equal(seen?.referrerPolicy, "no-referrer");
});
