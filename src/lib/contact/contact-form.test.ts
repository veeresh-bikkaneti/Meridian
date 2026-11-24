import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildContactPayload, sendContact, sendOutcome, CONTACT_MESSAGE_MAX } from "./contact-form.ts";
import { createFakeTransport } from "../../platform/transport/fake-transport.ts";

const draft = { topic: "bug" as const, message: " Map froze ", replyTo: "", website: "" };
const ENDPOINT = "https://c.test/contact";
const payload = { topic: "bug" as const, message: "x", website: "" };

const neverPost = async (): Promise<{ status: number; text: string }> => {
  throw new Error("transport should not be called");
};

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

test("sendContact maps server answers through a fake transport and never throws", async () => {
  assert.deepEqual(await sendContact(null, payload, neverPost), { status: "not-configured" });

  const cases: Array<{ status: number; text: string; want: unknown }> = [
    { status: 200, text: "{}", want: { status: "sent", stored: false } },
    { status: 200, text: '{"ok":true,"stored":true}', want: { status: "sent", stored: true } },
    { status: 200, text: "not-json", want: { status: "sent", stored: false } },
    { status: 503, text: "", want: { status: "not-configured" } },
    { status: 404, text: "", want: { status: "not-configured" } },
    { status: 429, text: "", want: { status: "rate-limited" } },
    { status: 500, text: "", want: { status: "error" } },
  ];
  for (const c of cases) {
    const fake = createFakeTransport();
    fake.queue(ENDPOINT, { type: "text", text: c.text, status: c.status });
    assert.deepEqual(await sendContact(ENDPOINT, payload, fake.port.postText), c.want);
    assert.equal(fake.calls.length, 1);
  }

  const down = createFakeTransport();
  down.queue(ENDPOINT, { type: "network" });
  assert.deepEqual(await sendContact(ENDPOINT, payload, down.port.postText), { status: "error" });
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

test("the contact post omits credentials and referrer and sends the honeypot field", async () => {
  const fake = createFakeTransport();
  fake.queue(ENDPOINT, { type: "text", text: "{}", status: 200 });
  const body = { topic: "other" as const, message: "x", website: "https://bot.example" };
  await sendContact(ENDPOINT, body, fake.port.postText);
  const call = fake.calls[0];
  assert.equal(call?.method, "POST");
  assert.equal(call?.credentials, "omit");
  assert.equal(call?.referrerPolicy, "no-referrer");
  assert.equal(call?.headers["content-type"], "application/json");
  assert.equal(call?.body, JSON.stringify(body));
});

test("a missing endpoint does not touch the transport", async () => {
  let called = false;
  const post = async () => {
    called = true;
    return { status: 200, text: "{}" };
  };
  assert.deepEqual(await sendContact(null, payload, post), { status: "not-configured" });
  assert.equal(called, false);
});

test("the contact page posts through the shared transport port, not raw fetch", () => {
  const src = readFileSync(new URL("../../routes/contact.tsx", import.meta.url), "utf8");
  assert.match(src, /from "@\/platform\/transport\/browser-transport"/);
  assert.match(src, /sendContact\(getContactEndpoint\(\), built\.payload, postText\)/);
  assert.doesNotMatch(src, /\bfetch\s*\(/);
});
