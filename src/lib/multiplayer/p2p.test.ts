import assert from "node:assert/strict";
import test from "node:test";
import { P2PRoom } from "./p2p.ts";

const SELF = "peer-a";

function pollBody() {
  return { peers: [{ id: SELF, name: "A" }], signals: [] };
}

test("poll uses the injected fetchFn seam, not the global fetch", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let connected = false;
  const room = new P2PRoom({
    room: "r1",
    selfId: SELF,
    fetchFn: (async (input: unknown) => {
      calls.push({ url: String(input) });
      return { ok: true, json: async () => pollBody() };
    }) as unknown as typeof fetch,
    onConnected: () => {
      connected = true;
    },
  });
  try {
    await room.join();
    assert.equal(connected, true, "first successful poll registers the peer");
    assert.equal(calls.length, 1);
    assert.match(calls[0]?.url ?? "", /\/api\/rtc\?/);
    assert.match(calls[0]?.url ?? "", /room=r1/);
  } finally {
    room.close();
  }
});

test("close() leave beacon uses the injected fetchFn with keepalive", () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const room = new P2PRoom({
    room: "r1",
    selfId: SELF,
    fetchFn: (async (input: unknown, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return { ok: true };
    }) as unknown as typeof fetch,
  });
  room.close();
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "/api/rtc");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.keepalive, true);
  assert.match(String(calls[0]?.init?.body), /"op":"leave"/);
});

test("no injected fetchFn: the runtime fetch is resolved lazily per call", () => {
  const realFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return { ok: true };
  }) as unknown as typeof fetch;
  try {
    new P2PRoom({ room: "r1", selfId: SELF }).close();
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.init?.keepalive, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});
