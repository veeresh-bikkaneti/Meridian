import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildFeatureRequestPayload,
  sendFeatureRequest,
  FEATURE_IDEA_MAX,
} from "./feature-request-form.ts";
import { createFakeTransport } from "../../platform/transport/fake-transport.ts";

const ENDPOINT = "https://c.test/feature-request";
const draft = {
  idea: " A rivers quiz ",
  ageGroup: "7-10" as const,
  subject: "Geography" as const,
  website: "",
};
const payload = {
  idea: "A rivers quiz",
  ageGroup: "7-10" as const,
  subject: "Geography" as const,
  turnstileToken: "tok",
  website: "",
};

const neverPost = async (): Promise<{ status: number; text: string }> => {
  throw new Error("transport should not be called");
};

test("builds a feature-request payload and keeps the honeypot", () => {
  const r = buildFeatureRequestPayload(draft, "tok");
  assert.deepEqual(r, { ok: true, payload });
});

test("rejects an empty idea, an oversized idea, and a missing age or subject", () => {
  assert.equal(buildFeatureRequestPayload({ ...draft, idea: "  " }, "tok").ok, false);
  assert.equal(
    buildFeatureRequestPayload({ ...draft, idea: "x".repeat(FEATURE_IDEA_MAX + 1) }, "tok").ok,
    false,
  );
  assert.equal(buildFeatureRequestPayload({ ...draft, ageGroup: "" }, "tok").ok, false);
  assert.equal(buildFeatureRequestPayload({ ...draft, subject: "" }, "tok").ok, false);
});

test("sendFeatureRequest maps server answers through a fake transport and never throws", async () => {
  assert.deepEqual(await sendFeatureRequest(null, payload, neverPost), { status: "not-open" });

  const cases: Array<{ status: number; text: string; want: unknown }> = [
    { status: 200, text: '{"ok":true}', want: { status: "sent" } },
    { status: 503, text: "", want: { status: "not-open" } },
    { status: 404, text: "", want: { status: "error" } },
    { status: 429, text: "", want: { status: "rate-limited" } },
    { status: 500, text: "", want: { status: "error" } },
  ];
  for (const c of cases) {
    const fake = createFakeTransport();
    fake.queue(ENDPOINT, { type: "text", text: c.text, status: c.status });
    assert.deepEqual(await sendFeatureRequest(ENDPOINT, payload, fake.port.postText), c.want);
    assert.equal(fake.calls.length, 1);
  }

  const down = createFakeTransport();
  down.queue(ENDPOINT, { type: "network" });
  assert.deepEqual(await sendFeatureRequest(ENDPOINT, payload, down.port.postText), { status: "error" });
});

test("the board form post omits credentials and referrer and sends the honeypot field", async () => {
  const fake = createFakeTransport();
  fake.queue(ENDPOINT, { type: "text", text: "{}", status: 200 });
  const honeypot = { ...payload, website: "https://bot.example" };
  await sendFeatureRequest(ENDPOINT, honeypot, fake.port.postText);
  const call = fake.calls[0];
  assert.equal(call?.method, "POST");
  assert.equal(call?.credentials, "omit");
  assert.equal(call?.referrerPolicy, "no-referrer");
  assert.equal(call?.headers["content-type"], "application/json");
  assert.equal(call?.body, JSON.stringify(honeypot));
});

test("a missing board endpoint does not touch the transport", async () => {
  let called = false;
  const post = async () => {
    called = true;
    return { status: 200, text: "{}" };
  };
  assert.deepEqual(await sendFeatureRequest(null, payload, post), { status: "not-open" });
  assert.equal(called, false);
});

test("the board page wires the form through the shared transport port, not raw fetch", () => {
  const page = readFileSync(new URL("../../routes/board.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../../board/feature-request-form.tsx", import.meta.url), "utf8");
  assert.match(page, /from "\.\.\/platform\/transport\/browser-transport\.ts"/);
  assert.match(page, /<FeatureRequestForm post=\{postText\} \/>/);
  assert.match(form, /sendFeatureRequest\(getFeatureRequestEndpoint\(\), built\.payload, post\)/);
  assert.doesNotMatch(page, /\bfetch\s*\(/);
  assert.doesNotMatch(form, /\bfetch\s*\(/);
});
