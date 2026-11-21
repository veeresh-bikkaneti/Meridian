import assert from "node:assert/strict";
import test from "node:test";
import { runSmoke } from "./crash-smoke.mjs";

const WORKER = "https://worker.test";
const GAME = "https://game.test";

/**
 * @param {{ bindings: string[], triggers: string[] } | null} deployBody
 * @param {{ deployThrows?: boolean, deployStatus?: number }} [opts]
 */
function stubFetch(deployBody, opts = {}) {
  return async (url, init) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    if (u === `${WORKER}/health` && method === "GET") {
      return jsonRes(200, { ok: true });
    }
    if (u === `${WORKER}/ingest` && method === "POST") {
      return jsonRes(400, { problems: ["expected tile_failed"] });
    }
    if (u === `${GAME}/flags.json` && method === "GET") {
      return jsonRes(200, { observabilityEndpoint: "/ingest" });
    }
    if (u === `${GAME}/` && method === "GET") {
      return {
        status: 200,
        json: async () => ({}),
        text: async () => "<html>meridian-crash-watchdog</html>",
      };
    }
    if (u === `${WORKER}/deploy-check` && method === "GET") {
      if (opts.deployThrows) throw new Error("deploy-check down");
      return jsonRes(opts.deployStatus ?? 200, deployBody);
    }
    throw new Error(`unexpected ${method} ${u}`);
  };
}

function jsonRes(status, body) {
  return {
    status,
    json: async () => body,
    text: async () => (body == null ? "" : JSON.stringify(body)),
  };
}

async function withLogs(fn) {
  const lines = [];
  const orig = console.log;
  console.log = (...args) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    const code = await fn();
    return { code, lines, output: lines.join("\n") };
  } finally {
    console.log = orig;
  }
}

test("runSmoke fails when deploy-check omits TELEMETRY_COUNTS", async () => {
  const { code, output } = await withLogs(() =>
    runSmoke(
      WORKER,
      GAME,
      stubFetch({
        ok: true,
        bindings: ["CRASH_RATE_LIMITER"],
        triggers: ["15 * * * *", "*/15 * * * *"],
      }),
    ),
  );
  assert.notEqual(code, 0);
  assert.match(output, /binding missing: TELEMETRY_COUNTS/);
});

test("runSmoke fails when deploy-check omits the health cron", async () => {
  const { code, output } = await withLogs(() =>
    runSmoke(
      WORKER,
      GAME,
      stubFetch({
        ok: true,
        bindings: ["CRASH_RATE_LIMITER", "TELEMETRY_COUNTS"],
        triggers: ["15 * * * *"],
      }),
    ),
  );
  assert.notEqual(code, 0);
  assert.match(output, /trigger missing: \*\/15 \* \* \* \*/);
});

test("runSmoke fails when deploy-check is unreachable", async () => {
  const { code, output } = await withLogs(() =>
    runSmoke(WORKER, GAME, stubFetch(null, { deployThrows: true })),
  );
  assert.notEqual(code, 0);
  assert.match(output, /deploy-check unreachable/);
});

test("runSmoke deploy-check lines are PASS when every declared name is present", async () => {
  const { code, lines } = await withLogs(() =>
    runSmoke(
      WORKER,
      GAME,
      stubFetch({
        ok: true,
        bindings: ["TELEMETRY_COUNTS", "CRASH_RATE_LIMITER"],
        triggers: ["15 * * * *", "*/15 * * * *"],
      }),
    ),
  );
  const deployLines = lines.filter((line) => line.includes("deploy-check"));
  assert.ok(deployLines.length > 0, "expected deploy-check lines");
  for (const line of deployLines) {
    assert.match(line, /^PASS\s/, line);
  }
  assert.equal(code, 0);
});
