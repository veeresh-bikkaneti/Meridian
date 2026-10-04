import assert from "node:assert/strict";
import test from "node:test";
import { handleRequest, iosVersionFromUA, validateEvent } from "./worker.js";

const silent = () => {};
const BASE = "https://obs.example.com";

function post(body, path = "/ingest", headers = {}) {
  return new Request(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID = {
  type: "suspected_crash",
  ts: 1728000000000,
  buildId: "650065e95f01",
  sessionId: "sess-1",
  edition: "globe",
  regionId: "globe",
  lastMilestone: "data_chunk_load_start",
  device: { ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4_1 like Mac OS X) AppleWebKit/605.1.15" },
};

test("valid POST → 204 and one structured log line", async () => {
  const lines = [];
  const res = await handleRequest(post(VALID), (l) => lines.push(l));
  assert.equal(res.status, 204);
  assert.equal(lines.length, 1);
  const logged = JSON.parse(lines[0]);
  assert.equal(logged.type, "suspected_crash");
  assert.equal(logged.buildId, "650065e95f01");
  assert.equal(logged.edition, "globe");
  assert.equal(logged.iosVersion, "16.4.1");
});

test("valid POST to / also accepted", async () => {
  const res = await handleRequest(post(VALID, "/"), silent);
  assert.equal(res.status, 204);
});

test("oversized body → 413", async () => {
  const big = { ...VALID, breadcrumb: { pad: "x".repeat(9000) } };
  const res = await handleRequest(post(big), silent);
  assert.equal(res.status, 413);
});

test("invalid schema → 400 (bad type, missing buildId, oversized string, long error message)", async () => {
  for (const bad of [
    { ...VALID, type: "not_a_type" },
    { ...VALID, buildId: undefined },
    { ...VALID, edition: "e".repeat(129) },
    { ...VALID, error: { name: "Error", message: "m".repeat(301) } },
    { ts: 1, buildId: "b" },
  ]) {
    const res = await handleRequest(post(JSON.stringify(bad)), silent);
    assert.equal(res.status, 400, JSON.stringify(bad).slice(0, 80));
  }
  assert.ok(validateEvent(VALID).length === 0);
});

test("invalid JSON → 400", async () => {
  const res = await handleRequest(post("{nope"), silent);
  assert.equal(res.status, 400);
});

test("GET on ingest path → 405; PUT → 405", async () => {
  assert.equal((await handleRequest(new Request(`${BASE}/ingest`), silent)).status, 405);
  assert.equal(
    (await handleRequest(new Request(`${BASE}/ingest`, { method: "PUT", body: "{}" }), silent)).status,
    405,
  );
});

test("GET /health → 200 ok", async () => {
  const res = await handleRequest(new Request(`${BASE}/health`), silent);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test("unknown path → 404", async () => {
  const res = await handleRequest(post(VALID, "/nope"), silent);
  assert.equal(res.status, 404);
});

test("iosVersionFromUA parses iOS UAs and ignores others", () => {
  assert.equal(iosVersionFromUA("Mozilla/5.0 (iPhone; CPU iPhone OS 16_4_1 like Mac OS X)"), "16.4.1");
  assert.equal(iosVersionFromUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), null);
  assert.equal(iosVersionFromUA(undefined), null);
});
