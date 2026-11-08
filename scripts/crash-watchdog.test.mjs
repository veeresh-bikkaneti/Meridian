/**
 * Crash-watchdog tests.
 *
 * The pure helper (isValidWatchdogEndpoint) is tested directly; the
 * orchestration (crashWatchdogMain) is driven against fake browser globals
 * so the exact code that ships inline in _shell.html is what gets
 * exercised. renderCrashWatchdogScript() is checked for the marker, the
 * 6600-byte budget, ES5-only output, and a no-drift assertion that the
 * shipped script still embeds the tested functions' logic.
 */
import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import {
  OBSERVABILITY_INGEST_HOSTS,
  crashWatchdogMain,
  isValidWatchdogEndpoint,
  minifyEmbedded,
  renderCrashWatchdogScript,
} from "./crash-watchdog.mjs";

/** The pinned crash-report ingest URL (review S3). */
const INGEST = "https://meridian-crash-report.knowledgetest.workers.dev/ingest";

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
      style: {},
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
    // Minimal shim: the watchdog only uses "beforeend".
    n.insertAdjacentHTML = (position, html) => {
      if (position !== "beforeend") throw new Error("fake: only beforeend supported");
      n.innerHTML = n.innerHTML + String(html);
    };
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

function fakeXhr({ flagsStatus = 200, flagsText = "{}", postStatus = 200, deferGet = false } = {}) {
  const posts = [];
  const gets = [];
  const pendingGets = [];
  function completeGet(x) {
    x.readyState = 4;
    x.status = flagsStatus;
    x.responseText = flagsText;
    if (x.onreadystatechange) x.onreadystatechange();
  }
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
          if (deferGet) pendingGets.push(x);
          else completeGet(x);
        } else {
          posts.push({ url: x.url, body, headers: { ...x.headers } });
          x.readyState = 4;
          x.status = postStatus;
          x.responseText = "";
          if (x.onreadystatechange) x.onreadystatechange();
        }
      },
    };
    return x;
  }
  return {
    XMLHttpRequest,
    posts,
    gets,
    flushGets() {
      while (pendingGets.length) completeGet(pendingGets.shift());
    },
    // Lets a test change the flags.json response mid-scenario (e.g.
    // prefetch fails, endpoint recovers before show-time).
    setFlags(status, text) {
      flagsStatus = status;
      flagsText = text;
    },
  };
}

function fakeHost({
  docOpts = {},
  xhrOpts = {},
  store: presetStore = {},
  durable: presetDurable = {},
  durableThrows = false,
  ready = false,
  ua = null,
} = {}) {
  const { doc, nodes, body } = fakeDocument(docOpts);
  const xhr = fakeXhr(xhrOpts);
  const store = { ...presetStore };
  // The durable store (localStorage) is a SEPARATE store from the
  // session store, exactly as in a real browser — the boot-health
  // record lives there (§4.3). Writes are counted so tests can prove
  // the watchdog never writes it.
  const durableStore = { ...presetDurable };
  const durableWrites = { set: 0, remove: 0 };
  const listeners = {};
  const calls = { timers: [], reloads: 0 };
  const host = {
    document: doc,
    navigator: {
      userAgent:
        ua ??
        "Mozilla/5.0 (Linux; Android 13; Test Phone) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
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
    localStorage: {
      getItem: (k) => {
        if (durableThrows) throw new Error("localStorage blocked");
        return k in durableStore ? durableStore[k] : null;
      },
      setItem: (k, v) => {
        durableWrites.set += 1;
        durableStore[k] = String(v);
      },
      removeItem: (k) => {
        durableWrites.remove += 1;
        delete durableStore[k];
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
  return { host, calls, store, durableStore, durableWrites, listeners, xhr, doc, nodes, body };
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

test("rendered script stays within the 6600-byte budget", () => {
  // #223: check the build-id shapes production actually uses, not just
  // the old 10-char fixture — a 12-char CI id (GITHUB_SHA slice) and the
  // 14-char timestamp fallback rendered 5122/5124 bytes and silently
  // broke the budget while this test still passed at exactly 5120.
  // Budget history: 5120 → 6144 (§7.5 ladder, worst case 6,104) →
  // two parallel branches: 6656 via #345/#347 (the read-only
  // boot-health stamp, +338 at the worst case incl. the strict
  // shape-check cure; worst case 6,442) and 6250 via PR #349 (the
  // chunk-recovery stand-down, worst case 6,155 → the recovery
  // card, worst case 6,213). Merged on the PR #349 merge-up over
  // main 70e1be6, both features survive and the worst case
  // (14-char build id) measures 6,551 bytes, so the budget is
  // 6,600 — the smallest round fit keeping the established
  // ~40-byte headroom pattern (49 bytes of margin).
  for (const buildId of ["abcdef0", "test-build", "abcdef012345", "local-mvpr1hgb"]) {
    const script = renderCrashWatchdogScript(buildId);
    const bytes = Buffer.byteLength(script, "utf8");
    assert.ok(bytes <= 6600, `rendered script for a ${buildId.length}-char build id is ${bytes} bytes, over budget`);
  }
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
    "The reload didn't finish loading.",
    "Try again",
    "Crash note sent, no personal info - helps fix this.",
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
  const H = OBSERVABILITY_INGEST_HOSTS;
  const OK = "https://meridian-crash-report.knowledgetest.workers.dev/ingest";
  assert.equal(isValidWatchdogEndpoint("/api/obs", H), true);
  assert.equal(isValidWatchdogEndpoint("/", H), true);
  assert.equal(isValidWatchdogEndpoint(OK, H), true);
  assert.equal(isValidWatchdogEndpoint(`  ${OK}  `, H), true, "surrounding whitespace is trimmed");
  assert.equal(isValidWatchdogEndpoint("//evil.com/x", H), false);
  assert.equal(isValidWatchdogEndpoint(OK.replace("https:", "http:"), H), false);
  assert.equal(isValidWatchdogEndpoint(`${OK}/a b`, H), false);
  assert.equal(isValidWatchdogEndpoint("javascript:alert(1)", H), false);
  assert.equal(isValidWatchdogEndpoint("", H), false);
  assert.equal(isValidWatchdogEndpoint("   ", H), false);
  assert.equal(isValidWatchdogEndpoint(null, H), false);
  assert.equal(isValidWatchdogEndpoint(undefined, H), false);
  assert.equal(isValidWatchdogEndpoint(42, H), false);
  assert.equal(isValidWatchdogEndpoint(`${OK}/${"x".repeat(2030)}`, H), false, "over 2048 chars rejected");
  assert.equal(isValidWatchdogEndpoint(`${OK}/\u0000x`, H), false, "control chars rejected");
});

test("isValidWatchdogEndpoint rejects backslash endpoints (WHATWG treats \\ as / in special schemes)", () => {
  const H = OBSERVABILITY_INGEST_HOSTS;
  for (const bad of [
    "/\\evil.com",
    "/\\/evil.com",
    "/\\\\evil.com",
    "https://meridian-crash-report.knowledgetest.workers.dev/\\evil",
  ]) {
    assert.equal(isValidWatchdogEndpoint(bad, H), false, bad);
  }
});

test("S3: isValidWatchdogEndpoint pins absolute endpoints to the ingest hosts", () => {
  const H = OBSERVABILITY_INGEST_HOSTS;
  for (const bad of [
    "https://example.com/hook",
    "https://meridian-crash-report.knowledgetest.workers.dev.evil.example/ingest",
    "https://evil-meridian-crash-report.knowledgetest.workers.dev/ingest",
  ]) {
    assert.equal(isValidWatchdogEndpoint(bad, H), false, bad);
  }
  // No host list → every absolute URL fails closed; same-origin paths still pass.
  assert.equal(isValidWatchdogEndpoint("https://meridian-crash-report.knowledgetest.workers.dev/ingest"), false);
  assert.equal(isValidWatchdogEndpoint("/ingest"), true);
});

test("S3: the watchdog's ingest-host list equals OBSERVABILITY_INGEST_HOSTS in src/lib/flags.ts", () => {
  const src = readFileSync(new URL("../src/lib/flags.ts", import.meta.url), "utf8");
  const m = /OBSERVABILITY_INGEST_HOSTS[^=]*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/.exec(src);
  assert.ok(m, "OBSERVABILITY_INGEST_HOSTS not found in src/lib/flags.ts");
  const fromTs = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  assert.deepEqual([...OBSERVABILITY_INGEST_HOSTS], fromTs);
  // The rendered script carries the list.
  assert.ok(renderCrashWatchdogScript("abcdef0").includes(JSON.stringify(OBSERVABILITY_INGEST_HOSTS)));
});

test("minifyEmbedded folds adjacent double-quoted literals without changing the value", () => {
  const out = minifyEmbedded('function f(){var a="x"+"y"+"z";var b=1+"q"+"r";var c=\'s\'+"t";return a+b+c}');
  assert.match(out, /"xyz"/);
  assert.match(out, /1\+"qr"/);
  // eslint-disable-next-line no-new-func
  assert.equal(new Function(`return (${out})()`)(), "xyz1qrst");
});

// ---------------------------------------------------------------------------
// Timer gating
// ---------------------------------------------------------------------------

test("timer fires → fallback UI inserted, asked flag set", () => {
  const { host, calls, store, body } = fakeHost();
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
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
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  assert.equal(veilOf({ body }), undefined);
});

test("fresh chunk-reload notice: recovery card shows, no boot_failure POST (stalled recovery reload)", () => {
  // The notice key is written ONLY just before a chunk-recovery reload
  // (chunk-recovery's auto-reload, or MapErrorBoundary's manual
  // "Try again") — in practice, both inside an app that already
  // booted. A fresh notice at timer-fire time with ready unset
  // therefore means this page load is a stalled recovery reload, not
  // a fresh boot failure. The report stands down (no boot_failure
  // POST, no "Crash note sent" line), but the player is NOT left on a
  // blank shell: the overlay still shows, with recovery-true copy —
  // panel round 1 on PR #349 (UX BLOCK): suppressing the only
  // recovery surface strands a child, possibly in the standalone PWA
  // with no browser reload button.
  const { host, calls, body, xhr } = fakeHost({
    store: { "meridian.chunkReloadNotice": String(Date.now()) },
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: INGEST,
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  const veil = veilOf({ body });
  assert.ok(veil, "the recovery overlay IS inserted on a stalled recovery reload");
  assert.equal(veil.attrs.role, "alert");
  assert.ok(
    veil.innerHTML.includes("The reload didn't finish loading."),
    "recovery heading, not a boot-failure claim",
  );
  assert.ok(
    !veil.innerHTML.includes("The game couldn't start on this phone."),
    "the generic boot-failure heading must NOT appear",
  );
  assert.ok(
    !veil.innerHTML.includes("This phone can't run the 3D map."),
    "the WebGL-less heading variant does not apply to the recovery card",
  );
  assert.equal(xhr.posts.length, 0, "no boot_failure POST on a stalled recovery reload");
  const ma = host.document.getElementById("ma");
  assert.ok(
    !ma.innerHTML.includes("Crash note sent, no personal info - helps fix this."),
    "no 'Crash note sent' line when nothing was sent",
  );
});

test("recovery card: Try again reloads the page, still no report", () => {
  const { host, calls, xhr } = fakeHost({
    store: { "meridian.chunkReloadNotice": String(Date.now()) },
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: INGEST,
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  const veil = veilOf(host);
  assert.ok(veil, "recovery overlay inserted");
  veil.onclick({ target: { id: "ag" } });
  assert.equal(calls.reloads, 1, "Try again reloads, exactly like the generic card");
  assert.equal(xhr.posts.length, 0, "the tap sends no boot_failure either");
});

test("stale chunk-reload notice does not stand the watchdog down (control)", () => {
  const { host, calls, body, xhr } = fakeHost({
    store: { "meridian.chunkReloadNotice": String(Date.now() - 900_001) },
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: INGEST,
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  assert.ok(veilOf({ body }), "fallback UI still appears for a stale notice");
  assert.equal(xhr.posts.length, 1, "boot_failure still sends for a stale notice");
  assert.equal(JSON.parse(xhr.posts[0].body).type, "boot_failure");
});

test("malformed chunk-reload notice does not stand the watchdog down (control)", () => {
  const { host, calls, body, xhr } = fakeHost({
    store: { "meridian.chunkReloadNotice": "not-a-timestamp" },
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: INGEST,
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  assert.ok(veilOf({ body }), "fallback UI still appears for a malformed notice");
  assert.equal(xhr.posts.length, 1, "boot_failure still sends for a malformed notice");
  assert.equal(JSON.parse(xhr.posts[0].body).type, "boot_failure");
});

test("no UI when the document is hidden", () => {
  const { host, calls, body } = fakeHost({
    docOpts: { hidden: true },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  assert.equal(veilOf({ body }), undefined);
});

test("no UI when the document has not settled", () => {
  const { host, calls, body } = fakeHost({
    docOpts: { readyState: "loading" },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  assert.equal(veilOf({ body }), undefined);
});

test("no UI when the build-staleness refresh prompt is showing", () => {
  const { host, calls, body } = fakeHost({
    docOpts: { bodyText: "… A new version of Meridian is available. …" },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
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
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
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
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  assert.ok(veilOf({ body }), "fallback UI must appear");
});

test("no UI twice in one session (asked flag)", () => {
  const { host, calls, body, store } = fakeHost({
    store: { "meridian.crashwatchdogAsked": "1" },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  assert.equal(veilOf({ body }), undefined);
  assert.equal(store["meridian.crashwatchdogAsked"], "1");
});

test("second timer fire does not duplicate the UI", () => {
  const { host, calls, body } = fakeHost();
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  assert.equal(calls.timers.length, 1);
  calls.timers[0].fn();
  calls.timers[0].fn();
  const veils = body.children.filter((c) => (c.innerHTML || "").includes('id="mc"'));
  assert.equal(veils.length, 1);
});

// ---------------------------------------------------------------------------
// UI content and wiring
// ---------------------------------------------------------------------------

test("fallback copy: default heading, Try again, focus on heading", () => {
  const { host, calls, nodes } = fakeHost();
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  const veil = veilOf(host);
  const html = veil.innerHTML;
  assert.ok(html.includes("The game couldn't start on this phone."), "default heading");
  assert.ok(html.includes('id="ag"'), "Try again button present");
  assert.ok(!html.includes('id="tl"'), "no manual report button (auto-send)");
  assert.ok(html.includes(">Try again<"));
  assert.ok(!html.includes('id="ms"'), "no status line until the report lands");
  const heading = nodes.find((n) => n.attrs.id === "mt");
  assert.ok(heading.focused, "focus moved to the heading");
});

test("fallback copy: WebGL-unavailable variant", () => {
  const { host, calls } = fakeHost({ docOpts: { webgl: false } });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  const veil = veilOf(host);
  assert.ok(veil.innerHTML.includes("This phone can't run the 3D map."), "tailored WebGL heading");
});

test("Try again reloads the page", () => {
  const { host, calls } = fakeHost();
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  const veil = veilOf(host);
  veil.onclick({ target: { id: "ag" } });
  assert.equal(calls.reloads, 1);
});

test("extra links: Reload points at the current URL, ?nosw=1 link built", () => {
  const { host, calls } = fakeHost();
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  const veil = veilOf(host);
  const links = veil.getElementsByTagName("a");
  assert.equal(links.length, 2);
  assert.equal(links[0].href, "https://x.test/Meridian/");
  assert.ok(links[1].href.includes("nosw=1"), `nosw link is ${links[1].href}`);
});

// ---------------------------------------------------------------------------
// Report flow (auto-send: the POST fires when the fallback shows, no tap)
// ---------------------------------------------------------------------------

test("endpoint is prefetched at init, before the timer fires", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: INGEST,
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  // NOTE: timer NOT fired.
  assert.equal(xhr.gets.length, 1, "flags.json fetched at init");
  assert.equal(xhr.posts.length, 0, "nothing sent before the fallback shows");
  assert.equal(calls.timers.length, 1, "timer still armed");
});

test("no confirmation when the POST itself fails (fail-closed)", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: INGEST,
      }),
      postStatus: 500,
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  assert.equal(xhr.posts.length, 1, "the attempt is still made");
  const ma = host.document.getElementById("ma");
  assert.ok(
    !ma.innerHTML.includes("Crash note sent, no personal info - helps fix this."),
    "no false 'sent' claim on HTTP 500",
  );
});

test("prefetch race: GET still in flight at show time → exactly one POST", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: INGEST,
      }),
      deferGet: true,
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  assert.equal(xhr.gets.length, 1, "prefetch GET issued at init");
  fireTimer(calls);
  assert.equal(xhr.gets.length, 2, "send() issues its own GET while prefetch is in flight");
  assert.equal(xhr.posts.length, 0, "nothing POSTed before the endpoint resolves");
  xhr.flushGets();
  assert.equal(xhr.posts.length, 1, "exactly one POST after both GETs resolve");
});

test("report auto-sends when the fallback shows, no tap needed", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: INGEST,
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  assert.equal(xhr.posts.length, 1, "POST fired automatically on show");
  const ma = host.document.getElementById("ma");
  assert.ok(
    ma.innerHTML.includes("Crash note sent, no personal info - helps fix this."),
    "confirmation appended once the report lands",
  );
  assert.ok(
    ma.innerHTML.includes('<p role="status">Crash note sent,'),
    "confirmation wrapped in <p role=status> so it is announced + the #ma p style applies",
  );
});

test("send flow: flags.json fetched with cache-bust, event POSTed", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: INGEST,
      }),
    },
  });
  crashWatchdogMain(host, "build-9", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  assert.equal(xhr.gets.length, 1);
  assert.ok(xhr.gets[0].includes("flags.json"), "fetches flags.json");
  assert.ok(xhr.gets[0].includes("?t="), "cache-busting query");
  assert.equal(xhr.posts.length, 1);
  const post = xhr.posts[0];
  assert.equal(post.url, INGEST);
  assert.equal(post.headers["Content-Type"], "application/json");
  const body = JSON.parse(post.body);
  assert.equal(body.type, "boot_failure");
  assert.equal(body.buildId, "build-9");
  assert.equal(typeof body.ts, "number");
  assert.equal(body.device.webgl2, true);
  assert.equal(body.device.os, "android");
  assert.equal(body.device.form, "mobile");
  assert.ok(!("ua" in body.device), "full UA string is never sent (COPPA)");
  assert.ok(!("gpu" in body.device), "GPU renderer string is never sent (COPPA)");
  // §4.4 parity (supersedes the 2026-10-21 absence assertion): the
  // keys are present but stamp the literal "unknown" — this path never
  // READs memory/cores, even though the fake host's navigator exposes
  // numbers for both (deviceMemory 4, hardwareConcurrency 8 above).
  assert.equal(body.device.deviceMemory, "unknown", "deviceMemory stamps unknown, never a read value");
  assert.equal(body.device.hardwareConcurrency, "unknown", "hardwareConcurrency stamps unknown, never a read value");
  assert.ok(!("screenW" in body.device) && !("screenH" in body.device), "exact screen size is never sent");
  assert.equal(body.device.screen, "sm");
  assert.equal(body.device.dpr, 3);
  assert.equal(body.error.name, "Error");
  assert.ok(Buffer.byteLength(post.body, "utf8") <= 8192, "payload within the 8192-byte cap");
  // Confirmation appended under the button once the report lands.
  const ma = host.document.getElementById("ma");
  assert.ok(ma.innerHTML.includes("Crash note sent, no personal info - helps fix this."));
});

test("send flow: no fingerprinting material leaves the device (COPPA)", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: INGEST,
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  const body = JSON.parse(xhr.posts[0].body);
  const raw = xhr.posts[0].body;
  assert.ok(!("gpu" in body.device), "no GPU renderer string");
  assert.ok(!("ua" in body.device), "no full UA string");
  assert.ok(!raw.includes("UNMASKED"), "no fingerprint extension name in payload");
  assert.equal(body.device.os, "android");
  assert.equal(body.device.form, "mobile");
});

test("send flow: fail-closed with no endpoint configured", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: { flagsText: JSON.stringify({}) },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  assert.equal(xhr.gets.length, 2, "prefetch + one show-time retry (no suppression)");
  assert.equal(xhr.posts.length, 0, "nothing POSTed without an endpoint");
  assert.equal(
    host.document.getElementById("ms"),
    null,
    "no confirmation shown, player never misled",
  );
});

test("send flow: invalid endpoint is rejected, stays silent", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: {
      flagsText: JSON.stringify({ observabilityEndpoint: "//evil.test/x" }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  assert.equal(xhr.posts.length, 0);
  assert.equal(host.document.getElementById("ms"), null);
});

test("send flow: flags.json network failure is fail-closed", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: { flagsStatus: 500, flagsText: "oops" },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  assert.equal(xhr.gets.length, 2, "prefetch + one show-time retry, then gives up");
  assert.equal(xhr.posts.length, 0);
  assert.equal(host.document.getElementById("ms"), null);
});

test("prefetch failure does not suppress the report: show-time retries", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: { flagsStatus: 500, flagsText: "oops" },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  assert.equal(xhr.gets.length, 1, "prefetch GET issued at init");
  // The endpoint recovers before the fallback shows.
  xhr.setFlags(
    200,
    JSON.stringify({ observabilityEndpoint: INGEST }),
  );
  fireTimer(calls);
  assert.equal(xhr.gets.length, 2, "show-time retries a fresh GET after prefetch failure");
  assert.equal(xhr.posts.length, 1, "report sends once the endpoint resolves");
  const ma = host.document.getElementById("ma");
  assert.ok(
    ma.innerHTML.includes("Crash note sent, no personal info - helps fix this."),
    "honest confirmation shown",
  );
});

// ---------------------------------------------------------------------------
// Error capture and previous-boot context
// ---------------------------------------------------------------------------

test("first window error is captured and truncated in the report", () => {
  const { host, calls, listeners, xhr } = fakeHost({
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: INGEST,
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  listeners.error({ error: { name: "TypeError", message: "x".repeat(500) } });
  listeners.error({ error: { name: "Later", message: "ignored" } });
  fireTimer(calls);
  const body = JSON.parse(xhr.posts[0].body);
  assert.equal(body.error.name, "TypeError");
  assert.equal(body.error.message.length, 300, "message truncated to 300");
  assert.ok(!JSON.stringify(body).includes("Later"), "first error wins");
});

test("unhandledrejection reason is captured", () => {
  const { host, calls, listeners, xhr } = fakeHost({
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: INGEST,
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  listeners.unhandledrejection({ reason: "promise blew up" });
  fireTimer(calls);
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
        observabilityEndpoint: INGEST,
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  const body = JSON.parse(xhr.posts[0].body);
  assert.equal(body.sessionId, "prev-session-1");
  assert.equal(body.lastMilestone, "map_ready");
  assert.deepEqual(body.breadcrumb.sessionId, "prev-session-1");
});

test("breadcrumb device sub-object (raw UA) is stripped before auto-send", () => {
  const crumb = {
    sessionId: "prev-session-ua",
    buildId: "b0",
    startedAt: 1,
    lastMilestone: "map_ready",
    history: [],
    // The app bundle writes the raw UA string here (device.ua) — the
    // watchdog must never let it leave the phone.
    device: {
      ua: "Mozilla/5.0 (Linux; Android 13; SECRET-PHONE-BUILD) AppleWebKit/537.36",
      os: "android",
    },
  };
  const { host, calls, xhr } = fakeHost({
    store: {
      "meridian.breadcrumb": JSON.stringify(crumb),
      "meridian.cleanExit": "0",
    },
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: INGEST,
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  assert.equal(xhr.posts.length, 1);
  const raw = xhr.posts[0].body;
  const body = JSON.parse(raw);
  assert.ok(body.breadcrumb, "breadcrumb still attached");
  assert.equal(body.breadcrumb.device, undefined, "breadcrumb device stripped");
  assert.ok(!raw.includes("SECRET-PHONE-BUILD"), "raw UA never in POST body");
  assert.ok(!raw.includes("Mozilla/5.0"), "no UA fragment in POST body");
  // The coarse facts still ride on the top-level event device object.
  assert.equal(body.device.os, "android");
  assert.equal(body.device.form, "mobile");
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
        observabilityEndpoint: INGEST,
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  const body = JSON.parse(xhr.posts[0].body);
  assert.equal(body.sessionId, "prev-session-2");
  assert.equal(body.breadcrumb, undefined);
});

test("corrupt breadcrumb is ignored defensively", () => {
  const { host, calls, xhr } = fakeHost({
    store: { "meridian.breadcrumb": "{not json" },
    xhrOpts: {
      flagsText: JSON.stringify({
        observabilityEndpoint: INGEST,
      }),
    },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
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

test("send flow: dpr is clamped like dprBucket() (1-4, undefined when bogus)", () => {
  for (const [raw, want] of [
    [7, 4],
    [0.4, 1],
    [2.6, 3],
    [0, undefined],
    [undefined, undefined],
  ]) {
    const { host, calls, xhr } = fakeHost({
      xhrOpts: { flagsText: JSON.stringify({ observabilityEndpoint: INGEST }) },
    });
    host.devicePixelRatio = raw;
    crashWatchdogMain(host, "b-dpr", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
    fireTimer(calls);
    const body = JSON.parse(xhr.posts[0].body);
    assert.equal(body.device.dpr, want, `devicePixelRatio ${raw}`);
  }
});

test("S3: an off-allowlist endpoint in flags.json sends nothing (fail closed)", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: { flagsText: JSON.stringify({ observabilityEndpoint: "https://obs.example.test/hook" }) },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  calls.timers[0].fn();
  assert.equal(xhr.posts.length, 0, "no report leaves for a host that is not pinned");
});

// ---------------------------------------------------------------------------
// §4.4 parity (DESIGN-FINAL): lcV / storageOk / mapMode /
// msSinceBootStart, the ES5 subset parser, the second-canvas WebGL1
// fix, and the §7.5 ladder state (steps 1-3 applied: browserVersion
// major-only, engine dropped, deviceClass dropped — the worker fills
// both from the parsed fields / os for this type).
// ---------------------------------------------------------------------------

test("parity: boot_failure carries lcV, storageOk, the trail's mapMode + span, and NO unfinishedBoots when no boot-health record exists", () => {
  const crumb = {
    sessionId: "prev-session-wd",
    buildId: "b0",
    startedAt: 1000,
    lastMilestone: "map_ready",
    mapMode: "scout",
    history: [
      { name: "boot_start", at: 1000 },
      { name: "map_ready", at: 4210 },
    ],
  };
  const { host, calls, xhr } = fakeHost({
    store: {
      "meridian.breadcrumb": JSON.stringify(crumb),
      "meridian.cleanExit": "0",
    },
    xhrOpts: { flagsText: JSON.stringify({ observabilityEndpoint: INGEST }) },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  assert.equal(xhr.posts.length, 1);
  const body = JSON.parse(xhr.posts[0].body);
  assert.equal(body.lcV, "2");
  assert.equal(body.storageOk, true);
  assert.equal(body.mapMode, "scout", "the crashed session's persisted mode, not a default");
  assert.equal(body.msSinceBootStart, 3210, "last history entry (4210) minus startedAt (1000)");
  assert.ok(
    !("unfinishedBoots" in body),
    "no durable boot-health record → no stamp; the worker grades its fallback (§4.4/#345)",
  );
  // Subset parser on the default fake UA (Android 13 Chrome): the
  // subset covers Safari only for browser, so both stamp "unknown";
  // osVersion comes from the O1 token.
  assert.equal(body.device.browser, "unknown");
  assert.equal(body.device.browserVersion, "unknown");
  assert.equal(body.device.osVersion, "13");
  assert.equal(body.device.os, "android");
  // All remaining new keys stamp the literal "unknown" (§4.4).
  for (const k of ["hardwareConcurrency", "deviceMemory", "touchPoints", "displayMode", "connection", "locale"]) {
    assert.equal(body.device[k], "unknown", `${k} stamps literal unknown`);
  }
  // §7.5 ladder steps 2+3: engine and deviceClass are absent on this
  // path (the worker derives them), NOT stamped.
  assert.ok(!("engine" in body.device), "ladder step 2: engine dropped");
  assert.ok(!("deviceClass" in body.device), "ladder step 3: deviceClass dropped");
});

// ---------------------------------------------------------------------------
// §4.3 watchdog stamp (#345): the boot_failure event borrows the durable
// unfinished-boot streak (meridian:boot-health) READ-ONLY, so the worker
// can grade the report S1 when it qualifies. Absent, malformed, or
// blocked storage stamps nothing — the honest "not stamped" signal.
// ---------------------------------------------------------------------------

function bootFailureBody({ durable, durableThrows = false } = {}) {
  const h = fakeHost({
    durable,
    durableThrows,
    xhrOpts: { flagsText: JSON.stringify({ observabilityEndpoint: INGEST }) },
  });
  crashWatchdogMain(h.host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(h.calls);
  assert.equal(h.xhr.posts.length, 1, "exactly one report leaves");
  // NB: the parsed event goes LAST — fakeHost's own `body` is the fake
  // DOM body element and must not overwrite it.
  return { ...h, body: JSON.parse(h.xhr.posts[0].body) };
}

test("stamp: a readable boot-health record stamps its streak, and the store is never written", () => {
  const record = JSON.stringify({ v: 1, unfinished: 5, lastUnfinishedAt: 123456 });
  const { body, durableStore, durableWrites } = bootFailureBody({
    durable: { "meridian:boot-health": record },
  });
  assert.equal(body.unfinishedBoots, 5, "the durable streak rides the report");
  assert.equal(durableWrites.set, 0, "the watchdog never writes the durable store");
  assert.equal(durableWrites.remove, 0, "the watchdog never removes from the durable store");
  assert.equal(durableStore["meridian:boot-health"], record, "the record is byte-identical afterwards");
});

test("stamp: a zero streak is a real stamp (field present, value 0)", () => {
  const { body } = bootFailureBody({
    durable: { "meridian:boot-health": JSON.stringify({ v: 1, unfinished: 0 }) },
  });
  assert.ok("unfinishedBoots" in body, "stamped zero is evidence, not absence");
  assert.equal(body.unfinishedBoots, 0);
});

test("stamp: malformed JSON in the durable record stamps nothing", () => {
  const { body } = bootFailureBody({ durable: { "meridian:boot-health": "not json{" } });
  assert.ok(!("unfinishedBoots" in body));
});

test("stamp: a future record version (v:2) stamps nothing — the v:1 shape is required", () => {
  const { body } = bootFailureBody({
    durable: { "meridian:boot-health": JSON.stringify({ v: 2, unfinished: 9 }) },
  });
  assert.ok(!("unfinishedBoots" in body));
});

test("stamp: a string record version (v:\"1\") stamps nothing — the v:1 shape check is strict", () => {
  // Regression (#347 cure): the shape check must mirror readBootHealth's
  // strict `p.v !== 1` discard. A loose check stamped this record's
  // streak 5 even though the app reads the same record as streak 0,
  // inflating the worker's grade to a false S1.
  const { body } = bootFailureBody({
    durable: { "meridian:boot-health": JSON.stringify({ v: "1", unfinished: 5 }) },
  });
  assert.ok(!("unfinishedBoots" in body));
});

test("stamp: a boolean record version (v:true) stamps nothing — the v:1 shape check is strict", () => {
  const { body } = bootFailureBody({
    durable: { "meridian:boot-health": JSON.stringify({ v: true, unfinished: 5 }) },
  });
  assert.ok(!("unfinishedBoots" in body));
});

test("stamp: a non-number streak stamps nothing", () => {
  const { body } = bootFailureBody({
    durable: { "meridian:boot-health": JSON.stringify({ v: 1, unfinished: "3" }) },
  });
  assert.ok(!("unfinishedBoots" in body));
});

test("stamp: a fractional streak floors to the manifest's integer", () => {
  const { body } = bootFailureBody({
    durable: { "meridian:boot-health": JSON.stringify({ v: 1, unfinished: 3.9 }) },
  });
  assert.equal(body.unfinishedBoots, 3);
});

test("stamp: an out-of-range streak clamps to the manifest's 0..99 range", () => {
  const { body } = bootFailureBody({
    durable: { "meridian:boot-health": JSON.stringify({ v: 1, unfinished: 250 }) },
  });
  assert.equal(body.unfinishedBoots, 99);
});

test("stamp: blocked durable storage stamps nothing and reports storageOk false", () => {
  const { body } = bootFailureBody({ durableThrows: true });
  assert.ok(!("unfinishedBoots" in body), "a throwing store reads as absent");
  assert.equal(body.storageOk, false, "the throw is honestly reported, same as sessionStorage");
});

test("parity: no previous trail → mapMode and msSinceBootStart stamp unknown", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: { flagsText: JSON.stringify({ observabilityEndpoint: INGEST }) },
  });
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  const body = JSON.parse(xhr.posts[0].body);
  assert.equal(body.mapMode, "unknown");
  assert.equal(body.msSinceBootStart, "unknown");
  assert.equal(body.storageOk, true);
});

test("parity: storageOk=false when sessionStorage access throws", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: { flagsText: JSON.stringify({ observabilityEndpoint: INGEST }) },
  });
  host.sessionStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  assert.equal(xhr.posts.length, 1, "report still sends — storage failure is stamped, not fatal");
  const body = JSON.parse(xhr.posts[0].body);
  assert.equal(body.storageOk, false, "any guarded storage throw flips storageOk (§4.4)");
});

test("webgl: the WebGL1 probe uses a SECOND canvas (a mode-locked first canvas cannot refuse it)", () => {
  const { host, calls, xhr } = fakeHost({
    xhrOpts: { flagsText: JSON.stringify({ observabilityEndpoint: INGEST }) },
  });
  const origCreate = host.document.createElement.bind(host.document);
  let canvasCount = 0;
  host.document.createElement = (tag) => {
    if (tag !== "canvas") return origCreate(tag);
    canvasCount += 1;
    const mine = canvasCount;
    return {
      getContext: (kind) => {
        if (kind === "webgl2") return null;
        // First canvas is mode-locked by the failed webgl2 attempt;
        // only a fresh canvas can produce a webgl1 context.
        if (kind === "webgl") return mine >= 2 ? { getExtension: () => null } : null;
        return null;
      },
    };
  };
  crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
  fireTimer(calls);
  assert.ok(canvasCount >= 2, "two canvases created for the two probes");
  const body = JSON.parse(xhr.posts[0].body);
  assert.equal(body.device.webgl2, false);
  assert.equal(body.device.webgl1, true, "webgl1 read from the second canvas");
});

test("corpus: watchdog subset parser agrees with ua-corpus.json on every watchdog row", () => {
  const corpus = JSON.parse(
    readFileSync(new URL("../src/lib/ua-corpus.json", import.meta.url), "utf8"),
  );
  const rows = corpus.filter((r) => r.watchdog);
  assert.ok(rows.length >= 4, `expected several watchdog corpus rows, got ${rows.length}`);
  for (const row of rows) {
    const { host, calls, xhr } = fakeHost({
      ua: row.ua,
      xhrOpts: { flagsText: JSON.stringify({ observabilityEndpoint: INGEST }) },
    });
    crashWatchdogMain(host, "b1", isValidWatchdogEndpoint, OBSERVABILITY_INGEST_HOSTS);
    fireTimer(calls);
    assert.equal(xhr.posts.length, 1, `${row.id}: one report`);
    const body = JSON.parse(xhr.posts[0].body);
    assert.equal(body.device.browser, row.expect.browser, `${row.id}: browser`);
    assert.equal(body.device.osVersion, row.expect.osVersion, `${row.id}: osVersion`);
    // §7.5 ladder step 1: the watchdog stamps browserVersion major-only.
    const wantMajor =
      row.expect.browserVersion === "unknown" ? "unknown" : row.expect.browserVersion.split(".")[0];
    assert.equal(body.device.browserVersion, wantMajor, `${row.id}: browserVersion (major-only, ladder step 1)`);
    assert.equal(body.device.os, row.expect.os, `${row.id}: os`);
  }
});
