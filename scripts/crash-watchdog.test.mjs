/**
 * Crash-watchdog tests.
 *
 * The pure helper (isValidWatchdogEndpoint) is tested directly; the
 * orchestration (crashWatchdogMain) is driven against fake browser globals
 * so the exact code that ships inline in _shell.html is what gets
 * exercised. renderCrashWatchdogScript() is checked for the marker, the
 * 5120-byte budget, ES5-only output, and a no-drift assertion that the
 * shipped script still embeds the tested functions' logic.
 */
import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {
  crashWatchdogMain,
  isValidWatchdogEndpoint,
  renderCrashWatchdogScript,
} from "./crash-watchdog.mjs";

// ---------------------------------------------------------------------------
// Fake browser host
// ---------------------------------------------------------------------------

/**
 * Minimal fake DOM. createElement returns stub nodes; setting innerHTML
 * registers stub children for every id="..." it contains so getElementById
 * keeps working; getElementsByTagName on an element scans its innerHTML.
 */
function fakeDocument({
  readyState = "complete",
  hidden = false,
  bodyText = "",
  bodyInnerText = null,
  webgl = true,
  gpu = null,
} = {}) {
  const nodes = [];
  function mk(tag) {
    const n = {
      tag,
      children: [],
      attrs: {},
      textContent: "",
      onclick: null,
      focused: false,
      setAttribute(k, v) {
        n.attrs[k] = v;
      },
      appendChild(c) {
        n.children.push(c);
        return c;
      },
      focus() {
        n.focused = true;
      },
      getElementsByTagName(t) {
        n._tagCache = n._tagCache || {};
        if (!n._tagCache[t]) {
          const out = [];
          const re = new RegExp("<" + t + "(\\s|>)", "g");
          while (re.exec(n._html || "")) {
            const c = mk(t);
            n.children.push(c);
            out.push(c);
          }
          n._tagCache[t] = out;
        }
        return n._tagCache[t];
      },
    };
    let _html = "";
    Object.defineProperty(n, "_html", { get: () => _html });
    Object.defineProperty(n, "innerHTML", {
      get: () => _html,
      set(h) {
        _html = String(h);
        const re = /id="([^"]+)"/g;
        let m;
        while ((m = re.exec(_html))) {
          const c = mk("div");
          c.attrs.id = m[1];
          n.children.push(c);
        }
      },
    });
    nodes.push(n);
    return n;
  }
  const body = mk("body");
  body.textContent = bodyText;
  // innerText excludes <script>/<style> contents (textContent includes
  // them); only set when the test passes it, so the default path still
  // exercises the textContent fallback.
  if (bodyInnerText !== null) body.innerText = bodyInnerText;
  const head = mk("head");
  const doc = {
    readyState,
    hidden,
    baseURI: "https://x.test/Meridian/",
    body,
    documentElement: mk("html"),
    createElement: (tag) => {
      if (tag === "canvas") {
        return {
          getContext: (kind) => {
            if (!webgl) return null;
            if (gpu && kind === "webgl2") {
              return {
                getExtension: (name) =>
                  name === "WEBGL_debug_renderer_info" ? { UNMASKED_RENDERER_WEBGL: 37446 } : null,
                getParameter: () => gpu,
              };
            }
            return { getExtension: () => null };
          },
        };
      }
      return mk(tag);
    },
    createTextNode: (t) => ({ textContent: t }),
    getElementsByTagName: (t) => (t === "head" ? [head] : []),
    getElementById: (id) => nodes.find((n) => n.attrs.id === id) || null,
  };
  return { doc, nodes, body, head };
}

function fakeXhr({ flagsStatus = 200, flagsText = "{}" } = {}) {
  const posts = [];
  const gets = [];
  function XMLHttpRequest() {
    const x = {
      readyState: 0,
      status: 0,
      responseText: "",
      headers: {},
      open(method, url) {
        x.method = method;
        x.url = url;
      },
      setRequestHeader(k, v) {
        x.headers[k] = v;
      },
      send(body) {
        if (x.method === "GET") {
          gets.push(x.url);
          x.readyState = 4;
          x.status = flagsStatus;
          x.responseText = flagsText;
          if (x.onreadystatechange) x.onreadystatechange();
        } else {
          posts.push({ url: x.url, body, headers: { ...x.headers } });
        }
      },
    };
    return x;
  }
  return { XMLHttpRequest, posts, gets };
}

function fakeHost({ docOpts = {}, xhrOpts = {}, store: presetStore = {}, ready = false } = {}) {
  const { doc, nodes, body } = fakeDocument(docOpts);
  const xhr = fakeXhr(xhrOpts);
  const store = { ...presetStore };
  const listeners = {};
  const calls = { timers: [], reloads: 0 };
  const host = {
    document: doc,
    navigator: {
      userAgent: "FakeBrowser/1.0 (Test Phone)",
      deviceMemory: 4,
      hardwareConcurrency: 8,
    },
    screen: { width: 390, height: 844 },
    devicePixelRatio: 3,
    location: {
      href: "https://x.test/Meridian/",
      reload() {
        calls.reloads += 1;
      },
    },
    sessionStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      },
    },
    setTimeout: (fn, ms) => {
      calls.timers.push({ fn, ms });
      return calls.timers.length;
    },
    addEventListener: (type, fn) => {
      listeners[type] = fn;
    },
    XMLHttpRequest: xhr.XMLHttpRequest,
    __meridian_ready: ready,
  };
  return { host, calls, store, listeners, xhr, doc, nodes, body };
}

function veilOf(h) {
  const body = h.body || (h.document && h.document.body);
  return body.children.find((c) => (c.innerHTML || "").includes('id="mc"'));
}

function fireTimer(calls) {
  assert.equal(calls.timers.length, 1, "exactly one timer armed");
  assert.equal(calls.timers[0].ms, 28000, "timer is 28s");
  calls.timers[0].fn();
}

// ---------------------------------------------------------------------------
// Render assertions
// ---------------------------------------------------------------------------

test("renderCrashWatchdogScript emits a single self-contained inline script", () => {
  const script = renderCrashWatchdogScript("test-build");
  assert.ok(script.startsWith("<script>/*meridian-crash-watchdog*/try{"));
  assert.ok(script.endsWith("}</script>"));
  assert.equal((script.match(/<script/g) || []).length, 1);
  // The build id is baked in.
  assert.ok(script.includes('"test-build"'));
});

test("rendered script stays within the 5120-byte budget", () => {
  const script = renderCrashWatchdogScript("test-build");
  const bytes = Buffer.byteLength(script, "utf8");
  assert.ok(bytes <= 5120, `rendered script is ${bytes} bytes, over budget`);
});

test("rendered script is ES5-only", () => {
  const script = renderCrashWatchdogScript("test-build");
  assert.ok(!script.includes("?."), "no optional chaining");
  assert.ok(!script.includes("??"), "no nullish coalescing");
  assert.ok(!script.includes("=>"), "no arrow functions");
  assert.ok(!script.includes("`"), "no template literals");
  assert.ok(!/\b(const|let|class)\b/.test(script), "no const/let/class");
  assert.ok(!script.includes("fetch("), "no fetch");
  assert.ok(!script.includes("Promise"), "no Promise");
  assert.ok(!script.includes("import "), "no import");
  assert.ok(!script.includes("export "), "no export");
});

test("rendered script embeds the tested logic (no-drift)", () => {
  const script = renderCrashWatchdogScript("test-build");
  for (const needle of [
    "meridian.crashwatchdogAsked",
    "__meridian_ready",
    "observabilityEndpoint",
    "meridian.breadcrumb",
    "meridian.cleanExit",
    "boot_failure",
    "flags.json",
    "A new version of Meridian is available.",
    "Try again",
    "Tell us what happened",
    "Thanks —",
    "device:",
  ]) {
    assert.ok(script.includes(needle), `shipped script must contain ${JSON.stringify(needle)}`);
  }
});

test("minified output still parses as valid JavaScript", () => {
  const script = renderCrashWatchdogScript("test-build");
  const body = script
    .replace(/^<script>\/\*meridian-crash-watchdog\*\/try\{/, "")
    .replace(/\}catch\(e\)\{\}<\/script>$/, "");
  assert.doesNotThrow(() => {
    new Function(body);
  });
});

// ---------------------------------------------------------------------------
// isValidWatchdogEndpoint
// ---------------------------------------------------------------------------

test("isValidWatchdogEndpoint mirrors flags.ts validation", () => {
  assert.equal(isValidWatchdogEndpoint("/api/obs"), true);
  assert.equal(isValidWatchdogEndpoint("/"), true);
  assert.equal(isValidWatchdogEndpoint("https://example.com/hook"), true);
  assert.equal(
    isValidWatchdogEndpoint("  https://example.com/hook  "),
    true,
    "surrounding whitespace is trimmed",
  );
  assert.equal(isValidWatchdogEndpoint("//evil.com/x"), false);
  assert.equal(isValidWatchdogEndpoint("http://example.com/hook"), false);
  assert.equal(isValidWatchdogEndpoint("https://example.com/a b"), false);
  assert.equal(isValidWatchdogEndpoint("javascript:alert(1)"), false);
  assert.equal(isValidWatchdogEndpoint(""), false);
  assert.equal(isValidWatchdogEndpoint("   "), false);
  assert.equal(isValidWatchdogEndpoint(null), false);
  assert.equal(isValidWatchdogEndpoint(undefined), false);
  assert.equal(isValidWatchdogEndpoint(42), false);
  assert.equal(
    isValidWatchdogEndpoint("https://example.com/" + "x".repeat(2030)),
    false,
    "over 2048 chars rejected",
  );
  assert.equal(
    isValidWatchdogEndpoint("https://example.com/\u0000x"),
    false,
    "control chars rejected",
  );
});

// ---------------------------------------------------------------------------
// Timer gating
// ---------------------------------------------------------------------------

test("timer fires → fallback UI inserted, asked flag set", () => {
  const { host, calls, store, body } = fakeHost();
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  const veil = veilOf({ body });
  assert.ok(veil, "overlay inserted into body");
  assert.equal(veil.attrs.role, "alert");
  assert.equal(store["meridian.crashwatchdogAsked"], "1");
  // document.body is not destroyed: the veil is appended, not replacing.
  assert.ok(body.children.includes(veil));
});

test("no UI when the app signalled ready before the timer fires", () => {
  const { host, calls, body } = fakeHost({ ready: true });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  assert.equal(veilOf({ body }), undefined);
});

test("no UI when the document is hidden", () => {
  const { host, calls, body } = fakeHost({
    docOpts: { hidden: true },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  assert.equal(veilOf({ body }), undefined);
});

test("no UI when the document has not settled", () => {
  const { host, calls, body } = fakeHost({
    docOpts: { readyState: "loading" },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  assert.equal(veilOf({ body }), undefined);
});

test("no UI when the build-staleness refresh prompt is showing", () => {
  const { host, calls, body } = fakeHost({
    docOpts: { bodyText: "… A new version of Meridian is available. …" },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  assert.equal(veilOf({ body }), undefined);
});

test("the watchdog's own inline source does not stand it down", () => {
  // Regression: the STALE stand-down scan must read innerText, not
  // textContent — the shipped inline script's own source contains the
  // STALE string, and textContent includes <script> contents, so the old
  // scan matched itself and the fallback UI never appeared on a real
  // blocked-boot page (caught by tests/e2e/crash-watchdog.spec.ts).
  const { host, calls, body } = fakeHost({
    docOpts: {
      bodyText: "… A new version of Meridian is available. … (the watchdog's own inline source)",
      bodyInnerText: "… rendered page text with no stale-build prompt …",
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  assert.ok(veilOf({ body }), "fallback UI must appear");
});

test("empty innerText (blocked boot: body holds only scripts) still shows the UI", () => {
  // The exact shape of a real blocked boot: textContent is the inline
  // scripts' source (including the STALE string), innerText is "" because
  // nothing is rendered. The fallback must show — an empty innerText is
  // a defined "nothing rendered" signal, not a missing API.
  const { host, calls, body } = fakeHost({
    docOpts: {
      bodyText:
        "(the watchdog's own inline source, incl. 'A new version of Meridian is available.')",
      bodyInnerText: "",
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  assert.ok(veilOf({ body }), "fallback UI must appear");
});

test("no UI twice in one session (asked flag)", () => {
  const { host, calls, body, store } = fakeHost({
    store: { "meridian.crashwatchdogAsked": "1" },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  assert.equal(veilOf({ body }), undefined);
  assert.equal(store["meridian.crashwatchdogAsked"], "1");
});

test("second timer fire does not duplicate the UI", () => {
  const { host, calls, body } = fakeHost();
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  assert.equal(calls.timers.length, 1);
  calls.timers[0].fn();
  calls.timers[0].fn();
  const veils = body.children.filter((c) => (c.innerHTML || "").includes('id="mc"'));
  assert.equal(veils.length, 1);
});

// ---------------------------------------------------------------------------
// UI content and wiring
// ---------------------------------------------------------------------------

test("fallback copy: default heading, Try again first, focus on heading", () => {
  const { host, calls, nodes } = fakeHost();
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  const veil = veilOf(host);
  const html = veil.innerHTML;
  assert.ok(html.includes("The game couldn't start on this phone."), "default heading");
  assert.ok(html.indexOf('id="ag"') < html.indexOf('id="tl"'), "Try again is the first button");
  assert.ok(html.includes(">Try again<"));
  assert.ok(html.includes("Tell us what happened — it helps fix phones like yours."));
  const heading = nodes.find((n) => n.attrs.id === "mt");
  assert.ok(heading.focused, "focus moved to the heading");
});

test("fallback copy: WebGL-unavailable variant", () => {
  const { host, calls } = fakeHost({ docOpts: { webgl: false } });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  const veil = veilOf(host);
  assert.ok(veil.innerHTML.includes("This phone can't run the 3D map."), "tailored WebGL heading");
});

test("Try again reloads the page", () => {
  const { host, calls } = fakeHost();
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  const veil = veilOf(host);
  veil.onclick({ target: { id: "ag" } });
  assert.equal(calls.reloads, 1);
});

test("extra links: Reload points at the current URL, ?nosw=1 link built", () => {
  const { host, calls } = fakeHost();
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  const veil = veilOf(host);
  const links = veil.getElementsByTagName("a");
  assert.equal(links.length, 2);
  assert.equal(links[0].href, "https://x.test/Meridian/");
  assert.ok(links[1].href.includes("nosw=1"), `nosw link is ${links[1].href}`);
});

// ---------------------------------------------------------------------------
// Report flow
// ---------------------------------------------------------------------------

function clickTell(host) {
  const veil = veilOf(host);
  veil.onclick({ target: { id: "tl" } });
}

test("send flow: flags.json fetched with cache-bust, event POSTed", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: "https://obs.test/hook",
      }),
    },
  });
  crashWatchdogMain(host, "build-9", isValidWatchdogEndpoint);
  fireTimer(calls);
  clickTell(host);
  assert.equal(xhr.gets.length, 1);
  assert.ok(xhr.gets[0].includes("flags.json"), "fetches flags.json");
  assert.ok(xhr.gets[0].includes("?t="), "cache-busting query");
  assert.equal(xhr.posts.length, 1);
  const post = xhr.posts[0];
  assert.equal(post.url, "https://obs.test/hook");
  assert.equal(post.headers["Content-Type"], "application/json");
  const body = JSON.parse(post.body);
  assert.equal(body.type, "boot_failure");
  assert.equal(body.buildId, "build-9");
  assert.equal(typeof body.ts, "number");
  assert.equal(body.device.webgl2, true);
  assert.equal(body.device.ua, "FakeBrowser/1.0 (Test Phone)");
  assert.equal(body.device.deviceMemory, 4);
  assert.equal(body.device.hardwareConcurrency, 8);
  assert.equal(body.device.screenW, 390);
  assert.equal(body.device.dpr, 3);
  assert.equal(body.error.name, "Error");
  assert.ok(Buffer.byteLength(post.body, "utf8") <= 8192, "payload within the 8192-byte cap");
  // Thanks state replaces the buttons either way.
  const ma = host.document.getElementById("ma");
  assert.ok(ma.innerHTML.includes("Thanks — we're on it."));
});

test("send flow: GPU renderer string is captured when available", () => {
  const { host, calls, xhr } = fakeHost({
    docOpts: { gpu: "Fake GPU 9000" },
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: "https://obs.test/hook",
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  clickTell(host);
  const body = JSON.parse(xhr.posts[0].body);
  assert.equal(body.device.gpu, "Fake GPU 9000");
});

test("send flow: fail-closed with no endpoint configured", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: { flagsText: JSON.stringify({}) },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  clickTell(host);
  assert.equal(xhr.gets.length, 1, "flags.json still fetched");
  assert.equal(xhr.posts.length, 0, "nothing POSTed without an endpoint");
  const ma = host.document.getElementById("ma");
  assert.ok(
    ma.innerHTML.includes("Thanks — we're on it. Try loading again?"),
    "thanks shown fail-closed",
  );
});

test("send flow: invalid endpoint is rejected, thanks still shown", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: {
      flagsText: JSON.stringify({ observabilityEndpoint: "//evil.test/x" }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  clickTell(host);
  assert.equal(xhr.posts.length, 0);
  const ma = host.document.getElementById("ma");
  assert.ok(ma.innerHTML.includes("Thanks —"));
});

test("send flow: flags.json network failure is fail-closed", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: { flagsStatus: 500, flagsText: "oops" },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  clickTell(host);
  assert.equal(xhr.posts.length, 0);
  const ma = host.document.getElementById("ma");
  assert.ok(ma.innerHTML.includes("Thanks —"));
});

// ---------------------------------------------------------------------------
// Error capture and previous-boot context
// ---------------------------------------------------------------------------

test("first window error is captured and truncated in the report", () => {
  const { host, calls, listeners, xhr } = fakeHost({
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: "https://obs.test/hook",
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  listeners.error({ error: { name: "TypeError", message: "x".repeat(500) } });
  listeners.error({ error: { name: "Later", message: "ignored" } });
  fireTimer(calls);
  clickTell(host);
  const body = JSON.parse(xhr.posts[0].body);
  assert.equal(body.error.name, "TypeError");
  assert.equal(body.error.message.length, 300, "message truncated to 300");
  assert.ok(!JSON.stringify(body).includes("Later"), "first error wins");
});

test("unhandledrejection reason is captured", () => {
  const { host, calls, listeners, xhr } = fakeHost({
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: "https://obs.test/hook",
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  listeners.unhandledrejection({ reason: "promise blew up" });
  fireTimer(calls);
  clickTell(host);
  const body = JSON.parse(xhr.posts[0].body);
  assert.equal(body.error.message, "promise blew up");
});

test("unclean previous boot attaches sessionId, breadcrumb and lastMilestone", () => {
  const crumb = {
    sessionId: "prev-session-1",
    buildId: "b0",
    startedAt: 1,
    lastMilestone: "map_ready",
    history: [],
  };
  const { host, calls, xhr } = fakeHost({
    store: {
      "meridian.breadcrumb": JSON.stringify(crumb),
      "meridian.cleanExit": "0",
    },
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: "https://obs.test/hook",
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  clickTell(host);
  const body = JSON.parse(xhr.posts[0].body);
  assert.equal(body.sessionId, "prev-session-1");
  assert.equal(body.lastMilestone, "map_ready");
  assert.deepEqual(body.breadcrumb.sessionId, "prev-session-1");
});

test("clean previous boot: no breadcrumb attached", () => {
  const crumb = {
    sessionId: "prev-session-2",
    buildId: "b0",
    startedAt: 1,
    lastMilestone: "boot_ready",
    history: [],
  };
  const { host, calls, xhr } = fakeHost({
    store: {
      "meridian.breadcrumb": JSON.stringify(crumb),
      "meridian.cleanExit": "1",
    },
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: "https://obs.test/hook",
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  clickTell(host);
  const body = JSON.parse(xhr.posts[0].body);
  assert.equal(body.sessionId, "prev-session-2");
  assert.equal(body.breadcrumb, undefined);
});

test("corrupt breadcrumb is ignored defensively", () => {
  const { host, calls, xhr } = fakeHost({
    store: { "meridian.breadcrumb": "{not json" },
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: "https://obs.test/hook",
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint);
  fireTimer(calls);
  clickTell(host);
  const body = JSON.parse(xhr.posts[0].body);
  assert.equal(body.sessionId, undefined);
  assert.equal(body.breadcrumb, undefined);
});

// ---------------------------------------------------------------------------
// The shipped bytes behave like the tested code (minifier smoke test)
// ---------------------------------------------------------------------------

test("shipped script runs the watchdog end-to-end in a vm", () => {
  const script = renderCrashWatchdogScript("vm-build");
  const inner = script
    .replace(/^<script>\/\*meridian-crash-watchdog\*\/try\{/, "")
    .replace(/\}catch\(e\)\{\}<\/script>$/, "");
  const { host, calls, store } = fakeHost();
  const sandbox = { window: host, URL, Date, JSON };
  vm.createContext(sandbox);
  vm.runInContext(`var window = this.window; ${inner}`, sandbox);
  assert.equal(calls.timers.length, 1);
  assert.equal(calls.timers[0].ms, 28000);
  calls.timers[0].fn();
  assert.ok(veilOf(host), "minified script shows the fallback UI");
  assert.equal(store["meridian.crashwatchdogAsked"], "1");
  const veil = veilOf(host);
  assert.ok(veil.innerHTML.includes("The game couldn't start on this phone."));
});
