/**
 * ?nosw escape-hatch tests (P0 Safari launch fix).
 *
 * The pure helpers (isNoswRequest, stripNoswParam) are tested directly; the
 * orchestration (noswHatchMain) is driven against fake browser globals so
 * the exact code that ships inline in _shell.html is what gets exercised.
 * renderNoswHatchScript() is checked for the marker + a no-drift assertion
 * that the shipped script still embeds the tested functions' logic.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  isNoswRequest,
  noswHatchMain,
  renderNoswHatchScript,
  stripNoswParam,
} from "./nosw-hatch.mjs";

test("isNoswRequest matches only a real nosw=1 param", () => {
  assert.equal(isNoswRequest("?nosw=1"), true);
  assert.equal(isNoswRequest("?a=1&nosw=1"), true);
  assert.equal(isNoswRequest("?nosw=1&x=2"), true);
  assert.equal(isNoswRequest("?x=2&nosw=1&y=3"), true);
  assert.equal(isNoswRequest("?nosw=10"), false);
  assert.equal(isNoswRequest("?nosw=0"), false);
  assert.equal(isNoswRequest("?xnosw=1"), false);
  assert.equal(isNoswRequest("?nosw="), false);
  assert.equal(isNoswRequest(""), false);
  assert.equal(isNoswRequest("?a=1"), false);
  assert.equal(isNoswRequest(null), false);
  assert.equal(isNoswRequest(undefined), false);
});

test("stripNoswParam removes the param and keeps everything else", () => {
  assert.equal(
    stripNoswParam("https://x.test/Meridian/?nosw=1"),
    "/Meridian/",
  );
  assert.equal(
    stripNoswParam("https://x.test/Meridian/?a=1&nosw=1&b=2#frag"),
    "/Meridian/?a=1&b=2#frag",
  );
  assert.equal(
    stripNoswParam("https://x.test/Meridian/?a=1"),
    "/Meridian/?a=1",
  );
});

/** Minimal fake browser host for the orchestration harness. */
function fakeHost({ search = "?nosw=1", regs = 2, cacheKeys = ["meridian-v1", "other", "meridian-assets"] } = {}) {
  const calls = {
    unregistered: 0,
    deletedCaches: [],
    replaceState: [],
    reloads: 0,
    stored: {},
  };
  const host = {
    location: {
      search,
      href: `https://x.test/Meridian/${search}`,
      reload() {
        calls.reloads += 1;
      },
    },
    history: {
      replaceState(_state, _title, url) {
        calls.replaceState.push(url);
      },
    },
    navigator: {
      serviceWorker: {
        getRegistrations() {
          return Promise.resolve(
            Array.from({ length: regs }, () => ({
              unregister() {
                calls.unregistered += 1;
                return Promise.resolve(true);
              },
            })),
          );
        },
      },
    },
    caches: {
      keys() {
        return Promise.resolve([...cacheKeys]);
      },
      delete(key) {
        calls.deletedCaches.push(key);
        return Promise.resolve(true);
      },
    },
    sessionStorage: {
      setItem(k, v) {
        calls.stored[k] = v;
      },
      getItem(k) {
        return calls.stored[k] ?? null;
      },
    },
    setTimeout: (fn) => {
      calls.timer = fn;
      return 1;
    },
    clearTimeout: () => {
      calls.timer = null;
    },
  };
  return { host, calls };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("hatch unregisters SWs, deletes meridian-* caches, strips param, reloads once", async () => {
  const { host, calls } = fakeHost();
  noswHatchMain(isNoswRequest, stripNoswParam, host);
  await flush();
  await flush();
  assert.equal(calls.unregistered, 2);
  assert.deepEqual(calls.deletedCaches, ["meridian-v1", "meridian-assets"]);
  assert.deepEqual(calls.replaceState, ["/Meridian/"]);
  assert.equal(calls.reloads, 1);
  const marker = JSON.parse(calls.stored["meridian.noswHatch"]);
  assert.equal(marker.ran, true);
  assert.equal(marker.swUnregistered, 2);
  assert.deepEqual(marker.cachesDeleted, ["meridian-v1", "meridian-assets"]);
});

test("hatch is inert without the param", async () => {
  const { host, calls } = fakeHost({ search: "?a=1" });
  noswHatchMain(isNoswRequest, stripNoswParam, host);
  await flush();
  assert.equal(calls.unregistered, 0);
  assert.deepEqual(calls.deletedCaches, []);
  assert.deepEqual(calls.replaceState, []);
  assert.equal(calls.reloads, 0);
});

test("hatch degrades when service workers are unsupported", async () => {
  const { host, calls } = fakeHost();
  delete host.navigator.serviceWorker;
  delete host.caches;
  noswHatchMain(isNoswRequest, stripNoswParam, host);
  await flush();
  await flush();
  // No SW/caches APIs: nothing to clean, but the param is still stripped
  // and the page still reloads exactly once.
  assert.deepEqual(calls.replaceState, ["/Meridian/"]);
  assert.equal(calls.reloads, 1);
  const marker = JSON.parse(calls.stored["meridian.noswHatch"]);
  assert.equal(marker.swUnregistered, 0);
  assert.deepEqual(marker.cachesDeleted, []);
});

test("synchronous cleanup throw fails open to strip + reload", async () => {
  const { host, calls } = fakeHost();
  host.navigator.serviceWorker.getRegistrations = () => {
    throw new Error("boom");
  };
  noswHatchMain(isNoswRequest, stripNoswParam, host);
  await flush();
  assert.deepEqual(calls.replaceState, ["/Meridian/"]);
  assert.equal(calls.reloads, 1);
});

test("stalled cleanup still reloads via the backstop timer", async () => {
  const { host, calls } = fakeHost();
  host.navigator.serviceWorker.getRegistrations = () => new Promise(() => {});
  noswHatchMain(isNoswRequest, stripNoswParam, host);
  await flush();
  assert.equal(calls.reloads, 0, "no reload before the backstop fires");
  assert.ok(typeof calls.timer === "function", "backstop timer armed");
  calls.timer();
  assert.equal(calls.reloads, 1);
  assert.deepEqual(calls.replaceState, ["/Meridian/"]);
});

test("renderNoswHatchScript emits a single self-contained inline script", () => {
  const script = renderNoswHatchScript();
  assert.ok(script.startsWith("<script>/*meridian-nosw-hatch*/"));
  assert.ok(script.endsWith("</script>"));
  assert.equal((script.match(/<script/g) || []).length, 1);
  // No imports, no module syntax: must run as a classic script. The embedded
  // functions' source contains no import/export statements (they live in
  // module scope, outside the embedded functions).
  assert.ok(!script.includes("import "));
  assert.ok(!script.includes("export "));
  // The shipped bytes embed the tested logic (no-drift): the trigger regex
  // and the cleanup primitives travel with the script.
  assert.ok(script.includes("nosw=1"));
  assert.ok(script.includes("getRegistrations"));
  assert.ok(script.includes("meridian-"));
  assert.ok(script.includes("meridian.noswHatch"));
  assert.ok(script.includes("replaceState"));
});
