/**
 * Inline crash watchdog: the fallback UI + boot_failure reporter for when
 * the JS bundle NEVER loads.
 *
 * Meridian already has a client-side observability pipeline (breadcrumb
 * trail in sessionStorage, clean-exit flag, next-boot suspected_crash —
 * see src/lib/observability.ts), but all of it lives inside the app
 * bundle. When the bundle itself fails to load or execute (the "won't even
 * load" reports on older phones), nothing in the bundle can run. This
 * module is the watchdog that covers that gap: a tiny dependency-free
 * inline <script> injected into the SPA shell (_shell.html) by
 * scripts/crash-watchdog-plugin.mjs, running before any app bundle code.
 *
 * Behavior: at parse time it captures the first window error /
 * unhandledrejection, probes WebGL, and reads the previous boot's
 * breadcrumb + clean-exit flag. It arms ONE 28s timer; when it fires, and
 * only when the app never signalled readiness (window.__meridian_ready),
 * the page is visible and settled, no build-staleness refresh prompt is
 * showing, and this session hasn't been asked yet, it shows an accessible
 * fallback overlay (never destroying document.body — the app may still
 * boot late) with "Try again" and an opt-in "Tell us what happened"
 * report path. The report reuses the existing observability contract:
 * same ObservabilityEvent shape with type "boot_failure", same
 * flags.json `observabilityEndpoint` validation as src/lib/flags.ts, same
 * sessionStorage keys — no parallel pipeline.
 *
 * Like scripts/nosw-hatch.mjs, the logic is written against an injected
 * `host` (window/document/navigator/sessionStorage/setTimeout/
 * XMLHttpRequest) so node --test can exercise the real orchestration with
 * fakes; the inline script passes `window`. renderCrashWatchdogScript()
 * builds the self-contained inline script from these functions' own
 * source, so the shipped bytes and the tested code cannot drift apart.
 *
 * ES5-ONLY inside the embedded functions (crashWatchdogMain,
 * isValidWatchdogEndpoint): var, function, no ?./??, no arrows, no
 * template literals, no const/let, no classes, no fetch/Promise (XHR +
 * callbacks only), no import/export. The whole inline body is wrapped in
 * try/catch and the rendered output must stay <= 5120 bytes, so the
 * embedded code is written terse and renderCrashWatchdogScript() runs it
 * through minifyEmbedded() (comment/whitespace removal plus renaming of
 * a fixed safe-list of long locals — token-based, so strings, regexes,
 * property accesses and object-literal keys are untouched).
 */

/**
 * Endpoint validation mirroring isValidObservabilityEndpoint in
 * src/lib/flags.ts, written ES5-only so it can ship inline: a string of
 * <= 2048 chars with no whitespace/control chars that is either a
 * root-relative single-slash path or an https: URL.
 */
export function isValidWatchdogEndpoint(value) {
  if (typeof value !== "string") return false;
  var v = value.replace(/^\s+|\s+$/g, "");
  if (v === "" || v.length > 2048) return false;
  // eslint-disable-next-line no-control-regex -- intentional: control chars are rejected
  if (/[\s\u0000-\u001f]/.test(v)) return false;
  if (v[0] === "/") return v[1] !== "/";
  try {
    return new URL(v).protocol === "https:";
  } catch (e) {
    return false;
  }
}

/**
 * Exported for the node --test harness (scripts/crash-watchdog.test.mjs),
 * which drives the real orchestration against fake browser globals. The
 * inline script embeds this same function by source via
 * renderCrashWatchdogScript(). Everything in here is ES5-only (see the
 * module docstring) and deliberately terse to hold the 5120-byte budget.
 */
export function crashWatchdogMain(host, buildId, isValidEndpointFn) {
  var ASKED = "meridian.crashwatchdogAsked",
    CRUMB = "meridian.breadcrumb",
    CLEAN = "meridian.cleanExit",
    READY = "__meridian_ready",
    STALE = "A new version of Meridian is available.",
    CAP = 8192;
  var win = host,
    doc = win.document;
  // sessionStorage is resolved lazily: on old Safari even touching it can
  // throw, and every access is guarded here anyway.
  function ss(k, v) {
    try {
      var st = win.sessionStorage;
      return v === void 0 ? st.getItem(k) : st.setItem(k, v);
    } catch (e) {
      return null;
    }
  }
  function tn(s, n) {
    s = String(s == null ? "" : s);
    return s.length > n ? s.slice(0, n) : s;
  }
  function js(v) {
    try {
      return JSON.stringify(v);
    } catch (e) {
      return "{}";
    }
  }
  // First error wins: the earliest failure is usually the boot cause.
  var err0 = null;
  function note(x) {
    if (err0) return;
    var m = "";
    try {
      m = tn(x && x.message != null ? x.message : x, 300);
    } catch (e) {
      /* best-effort */
    }
    err0 = { name: tn((x && x.name) || "Error", 80), message: m };
  }
  try {
    if (win.addEventListener) {
      win.addEventListener("error", function (e) {
        note(e && (e.error || e.message));
      });
      win.addEventListener("unhandledrejection", function (e) {
        note(e && e.reason);
      });
    }
  } catch (e) {
    /* best-effort */
  }
  // WebGL probe: webgl2, else webgl, on one canvas. A device with WebGL2
  // also does WebGL1, so g1 covers both for diagnostics.
  var g1 = false,
    g2 = false,
    gpu = "";
  try {
    var cv = doc.createElement("canvas");
    g2 = !!cv.getContext("webgl2");
    g1 = g2 || !!cv.getContext("webgl");
    var _g = cv.getContext(g2 ? "webgl2" : "webgl");
    if (_g) {
      var _d = _g.getExtension("WEBGL_debug_renderer_info");
      if (_d) gpu = tn(_g.getParameter(_d.UNMASKED_RENDERER_WEBGL), 120);
    }
  } catch (e) {
    /* best-effort */
  }
  // Previous boot context, read defensively. Trail + cleanExit "0" means
  // the last page was killed without unloading — valuable report context.
  var prev = null;
  try {
    var raw = ss(CRUMB);
    if (raw) {
      var p = JSON.parse(raw);
      if (p && typeof p === "object" && typeof p.sessionId === "string") prev = p;
    }
  } catch (e) {
    /* best-effort */
  }
  var unclean = !!prev && ss(CLEAN) === "0",
    shown = false;
  function xhr(m, u, b, cb) {
    try {
      var x = new win.XMLHttpRequest();
      x.open(m, u, true);
      if (cb)
        x.onreadystatechange = function () {
          if (x.readyState === 4) cb(x.status, x.responseText);
        };
      if (m === "POST") x.setRequestHeader("Content-Type", "application/json");
      x.send(b);
    } catch (e) {
      if (cb) cb(0, null);
    }
  }
  // "Tell us what happened": resolve flags.json at RUNTIME (never baked
  // in), validate the endpoint like src/lib/flags.ts, POST the
  // boot_failure event (same ObservabilityEvent shape as
  // src/lib/observability.ts — same contract, no parallel pipeline),
  // then thank the user either way (fail-closed).
  function send() {
    var u = "flags.json";
    try {
      u = new URL("flags.json", doc.baseURI) + "";
    } catch (e) {
      /* best-effort */
    }
    // Cache-bust. Resolving "flags.json" against baseURI drops any base
    // query, so the result never contains "?" — "?t=" is always correct.
    xhr("GET", u + "?t=" + Date.now(), null, function (st, text) {
      var ep = null;
      try {
        if (st >= 200 && st < 300 && text) {
          var c = JSON.parse(text).observabilityEndpoint;
          if (isValidEndpointFn(c)) ep = String(c).replace(/^\s+|\s+$/g, "");
        }
      } catch (e) {
        /* best-effort */
      }
      if (ep) {
        try {
          // Coarse device facts only. No coordinates, no place/guess
          // content, no PII. undefined fields are dropped by JSON.
          var n = win.navigator || {},
            w = win.screen || {};
          var dv = {
            ua: tn(n.userAgent, 300),
            deviceMemory: n.deviceMemory,
            hardwareConcurrency: n.hardwareConcurrency,
            dpr: win.devicePixelRatio,
            screenW: w.width,
            screenH: w.height,
            webgl1: g1,
            webgl2: g2,
            buildId: buildId,
          };
          if (gpu) dv.gpu = gpu;
          var ev = {
            type: "boot_failure",
            ts: Date.now(),
            buildId: buildId,
            device: dv,
            error: err0 || { name: "Error", message: "boot timeout" },
          };
          if (prev) {
            ev.sessionId = prev.sessionId;
            if (prev.lastMilestone) ev.lastMilestone = prev.lastMilestone;
            if (unclean) ev.breadcrumb = prev;
          }
          // Hard cap: serialize small; over the cap drops the breadcrumb,
          // then truncates the longest free-text fields. Never throws.
          var s = js(ev);
          if (s.length > CAP) {
            delete ev.breadcrumb;
            s = js(ev);
          }
          if (s.length > CAP) {
            if (dv.ua) dv.ua = dv.ua.slice(0, 120);
            if (ev.error.message) ev.error.message = ev.error.message.slice(0, 120);
            s = js(ev);
          }
          xhr("POST", ep, s, null);
        } catch (x) {
          /* best-effort */
        }
      }
      try {
        var b = doc.getElementById("ma");
        if (b) b.innerHTML = "<p>Thanks — we're on it. Try loading again?</p>";
      } catch (x) {
        /* best-effort */
      }
    });
  }
  var CSS =
    "#mv{position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;\n" +
    "display:flex;background:rgba(8,12,20,.72);padding:16px}\n" +
    "#mc{margin:auto;max-width:22rem;width:100%;background:#ffffff;\n" +
    "color:#1b2a3d;border-radius:12px;padding:20px;\n" +
    "font:16px/1.5 system-ui,sans-serif}\n" +
    "#mc h2{font-size:18px;margin:0 0 8px}\n" +
    "#mc p{margin:0 0 12px}\n" +
    "#ma button{display:block;width:100%;font:inherit;padding:11px;\n" +
    "margin:0 0 8px;border:2px solid #0b5fff;border-radius:8px;cursor:pointer;\n" +
    "transition:background-color .15s;background:#0b5fff;color:#ffffff;font-weight:700}\n" +
    "#ma #tl{background:#ffffff;color:#0b5fff;font-weight:600}\n" +
    "#ma button:focus-visible,#mc a:focus-visible{\n" +
    "outline:3px solid #0b5fff;outline-offset:2px}\n" +
    "#mc a{color:#0b5fff}\n" +
    "#ma p{font-weight:600}\n" +
    "@media (prefers-reduced-motion:reduce){#ma button{transition:none}}";
  function noswUrl() {
    try {
      var u = new URL(String(win.location.href));
      u.searchParams.set("nosw", "1");
      return u + "";
    } catch (e) {
      var h = String(win.location.href);
      return h + (h.indexOf("?") < 0 ? "?nosw=1" : "&nosw=1");
    }
  }
  // The overlay never destroys document.body: the app may still boot
  // late, and wiping the DOM would strand it. role=alert + focus on the
  // heading so assistive tech announces the failure immediately.
  function show() {
    if (shown) return;
    shown = true;
    ss(ASKED, "1");
    try {
      var v = doc.createElement("div");
      v.id = "mv";
      v.setAttribute("role", "alert");
      // The <style> rides inside the veil: style elements apply
      // document-wide regardless of position, so no <head> lookup.
      v.innerHTML =
        "<style>" +
        CSS +
        "</style>" +
        '<div id="mc"><h2 id="mt" tabindex="-1">' +
        (g1 || g2 ? "The game couldn't start on this phone." : "This phone can't run the 3D map.") +
        "</h2><p>The game didn't finish loading.</p>" +
        '<div id="ma"><button id="ag">Try again</button>' +
        '<button id="tl">Tell us what happened — it helps fix phones like yours.</button></div>' +
        '<a id="mr">Reload</a> · <a id="mn">?nosw=1</a></div>';
      doc.body.appendChild(v);
      v.onclick = function (e) {
        var t = (e && e.target) || {},
          i = t.id;
        if (i === "ag") {
          try {
            win.location.reload();
          } catch (x) {
            /* best-effort */
          }
        } else if (i === "tl") send();
      };
      var as = v.getElementsByTagName("a");
      if (as[0]) as[0].href = win.location.href;
      if (as[1]) as[1].href = noswUrl();
      try {
        var hd = doc.getElementById("mt");
        if (hd) hd.focus();
      } catch (e) {
        /* best-effort */
      }
    } catch (e) {
      /* best-effort */
    }
  }
  // Late-boot decision: once the fallback UI is shown it stays. The app
  // cannot notify this inline watchdog when window.__meridian_ready flips
  // true afterwards, and re-checking would need polling on an interval —
  // a cost paid on every healthy boot for an edge case the overlay
  // already handles ("Try again" reloads into a clean boot). The timer
  // checks the flag exactly once, at fire time.
  function onTimer() {
    try {
      if (shown || doc.readyState !== "complete" || doc.hidden || win[READY] || ss(ASKED) === "1")
        return;
      var t = "";
      try {
        // innerText, not textContent: <script>/<style> contents are part
        // of textContent, and this watchdog's own inline source contains
        // the STALE string — textContent would match itself and stand the
        // watchdog down on every boot. innerText is used whenever it is
        // defined, even when empty: on a blocked boot the body holds only
        // the inline scripts, so innerText is "" and the fallback must
        // show. (A missing innerText falls back to textContent; the scan
        // then errs toward standing down, never toward a spurious
        // recovery screen.)
        t = doc.body.innerText;
        if (t == null) t = doc.body.textContent || "";
      } catch (e) {
        /* best-effort */
      }
      if (t.indexOf(STALE) === -1) show();
    } catch (e2) {
      /* best-effort */
    }
  }
  win.setTimeout(function () {
    onTimer();
  }, 28000);
}

// --- Embedded-source minifier (module scope; never shipped inline) ---

// Long locals renamed for the shipped bytes. The rename is bijective over
// identifiers that are never object-literal keys, never property accesses
// (a word preceded by "." is skipped), and never appear inside strings or
// regexes — so semantics are preserved exactly.
const RENAME = {
  isValidEndpointFn: "ok",
  isValidWatchdogEndpoint: "vv",
  ASKED: "A",
  CRUMB: "B",
  CLEAN: "C",
  READY: "D",
  STALE: "E",
  CAP: "F",
  noswUrl: "nu",
  onTimer: "ot",
  send: "sd",
  show: "sh",
  note: "nt",
  unclean: "uc",
  prev: "pv",
  shown: "sn",
  gpu: "gp",
  err0: "e0",
  doc: "d",
  win: "o",
  true: "!0",
  false: "!1",
};

const _isWordCh = (c) => /[A-Za-z0-9_$]/.test(c || "");
const _isWs = (c) =>
  c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f" || c === "\v";

/**
 * Tokenize ES5 source into [kind, value] tokens. The embedded sources
 * contain no division operators, so every "/" outside a string/comment
 * starts a regex literal.
 */
function tokenizeEmbedded(src) {
  const toks = [];
  const len = src.length;
  let i = 0;
  while (i < len) {
    const c = src[i];
    const n = src[i + 1] || "";
    if (_isWs(c)) {
      let j = i + 1;
      while (j < len && _isWs(src[j])) j++;
      toks.push(["ws", " "]);
      i = j;
      continue;
    }
    if (c === "/" && n === "/") {
      while (i < len && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < len && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let s = c;
      i++;
      while (i < len) {
        const ch = src[i];
        s += ch;
        if (ch === "\\") {
          s += src[i + 1] || "";
          i += 2;
          continue;
        }
        i++;
        if (ch === c) break;
      }
      toks.push(["str", s]);
      continue;
    }
    if (c === "/") {
      let s = c;
      i++;
      let inClass = false;
      while (i < len) {
        const ch = src[i];
        s += ch;
        if (ch === "\\") {
          s += src[i + 1] || "";
          i += 2;
          continue;
        }
        if (ch === "[") inClass = true;
        if (ch === "]") inClass = false;
        i++;
        if (ch === "/" && !inClass) break;
      }
      while (i < len && /[a-z]/.test(src[i])) {
        s += src[i];
        i++;
      }
      toks.push(["re", s]);
      continue;
    }
    if (_isWordCh(c)) {
      let w = c;
      i++;
      while (i < len && _isWordCh(src[i])) {
        w += src[i];
        i++;
      }
      toks.push(["word", w]);
      continue;
    }
    toks.push(["punc", c]);
    i++;
  }
  return toks;
}

/**
 * Minify an embedded function's source: drop comments, collapse
 * whitespace (a space survives only between two word characters, e.g.
 * "var x", "return x", "} else {"), and rename the RENAME safe-list.
 */
export function minifyEmbedded(src) {
  const toks = tokenizeEmbedded(src);
  let out = "";
  let pendingSpace = false;
  let prev = null; // last significant token [kind, value]
  for (const [kind, val] of toks) {
    if (kind === "ws") {
      pendingSpace = true;
      continue;
    }
    let v = val;
    if (
      kind === "word" &&
      RENAME[val] !== undefined &&
      !(prev && prev[0] === "punc" && prev[1] === ".")
    ) {
      v = RENAME[val];
    }
    if (pendingSpace) {
      pendingSpace = false;
      if (prev && prev[0] === "word" && kind === "word") out += " ";
    }
    out += v;
    prev = [kind, v];
  }
  return out.replace(/;}/g, "}");
}

/**
 * Render the dependency-free inline <script> for the SPA shell. The
 * orchestration function is embedded by source with the build id baked in
 * and the endpoint validator passed as an argument — no imports, no
 * globals beyond standard browser APIs.
 */
export function renderCrashWatchdogScript(buildId) {
  const body =
    "(" +
    minifyEmbedded(crashWatchdogMain.toString()) +
    ")(window," +
    JSON.stringify(buildId) +
    "," +
    minifyEmbedded(isValidWatchdogEndpoint.toString()) +
    ");";
  return "<script>/*meridian-crash-watchdog*/try{" + body + "}catch(e){}</script>";
}
