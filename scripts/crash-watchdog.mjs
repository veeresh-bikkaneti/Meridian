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
 * boot late) with a "Try again" path. The report then auto-sends: the
 * endpoint is resolved at runtime (never baked in) and the crash note
 * goes automatically when the generic fallback shows, with an honest
 * on-screen confirmation. One overlay is the exception: when a fresh
 * chunk-reload notice survives (next note), the overlay is the recovery
 * card and no report sends. The report reuses the existing observability contract:
 * same ObservabilityEvent shape with type "boot_failure", same
 * flags.json `observabilityEndpoint` validation as src/lib/flags.ts, same
 * sessionStorage keys — no parallel pipeline.
 *
 * One case deserves its own note. When a chunk fails mid-session,
 * chunk-recovery (src/lib/chunk-recovery.ts) reloads the page once, and
 * MapErrorBoundary's manual "Try again" does the same; both first write
 * a timestamp under sessionStorage key `meridian.chunkReloadNotice`,
 * and in practice both run inside an app that already booted and
 * reached home. If that recovery reload itself stalls (assets still
 * failing), this watchdog's timer would otherwise show the generic
 * boot-failure overlay and file a false `boot_failure` for a session
 * that had already booted fine. So when a fresh notice (age <=
 * 900_000 ms, mirroring CHUNK_RELOAD_NOTICE_MAX_AGE_MS in
 * chunk-recovery.ts) survives to fire time with readiness unset, the
 * report and the generic card stand down — that combination is, in
 * practice, a stalled recovery reload (in practice, not by
 * construction: the notice's removal when the next boot consumes it
 * is best-effort, so a surviving flag is strong evidence, not proof).
 * But standing the player down too would leave a child on a blank
 * shell — possibly in the standalone PWA, which has no browser reload
 * button — so the overlay still shows, as the recovery card: same
 * surface and actions, a heading that says the reload didn't finish,
 * and no report. A notice that is absent, malformed, or stale changes
 * nothing — the generic fallback shows, and reports, exactly as before.
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
 * try/catch and the rendered output must stay <= 6,600 bytes
 * (6,144 until issue #345 added the read-only boot-health stamp
 * and PR #349 added the chunk-recovery stand-down + recovery card;
 * see the RENAME comment for the measured figures), so the
 * embedded code is written terse and renderCrashWatchdogScript() runs it
 * through minifyEmbedded() (comment/whitespace removal plus renaming of
 * a fixed safe-list of long locals — token-based, so strings, regexes,
 * property accesses and object-literal keys are untouched).
 */

/**
 * Hosts allowed to receive the boot-failure report (review S3,
 * 2026-10-21). This MUST equal OBSERVABILITY_INGEST_HOSTS in
 * src/lib/flags.ts. The inline script cannot import that module, so
 * scripts/crash-watchdog.test.mjs fails on drift.
 */
export const OBSERVABILITY_INGEST_HOSTS = Object.freeze([
  "meridian-crash-report.knowledgetest.workers.dev",
]);

/**
 * Endpoint validation mirroring isValidObservabilityEndpoint in
 * src/lib/flags.ts, written ES5-only so it can ship inline: a string of
 * <= 2048 chars with no whitespace/control chars or backslashes that is
 * either a root-relative single-slash path or an https: URL whose
 * hostname is one of `hosts`. Backslashes are rejected because WHATWG
 * URL parsing treats "\" as "/" in special schemes, so "/\host" is a
 * protocol-relative URL in disguise. Without `hosts`, every absolute
 * URL is rejected (fail closed).
 */
export function isValidWatchdogEndpoint(value, hosts) {
  // Loose != / == below compare strings with strings only, so they behave
  // exactly like !== / ===. They each save a byte of the inline budget.
  // eslint-disable-next-line eqeqeq
  if (typeof value != "string") return false;
  var v = value.replace(/^\s+|\s+$/g, "");
  // eslint-disable-next-line no-control-regex -- intentional: control chars are rejected
  if (v.length > 2048 || /[\s\u0000-\u001f\\]/.test(v)) return false;
  if (v[0] === "/") return v[1] !== "/";
  try {
    // "" throws here, and so does a missing `hosts` list (no .indexOf), so
    // both fail closed through the catch.
    var u = new URL(v);
    // eslint-disable-next-line eqeqeq
    return u.protocol == "https:" && hosts.indexOf(u.hostname) >= 0;
  } catch (e) {
    return false;
  }
}

/**
 * Exported for the node --test harness (scripts/crash-watchdog.test.mjs),
 * which drives the real orchestration against fake browser globals. The
 * inline script embeds this same function by source via
 * renderCrashWatchdogScript(). Everything in here is ES5-only (see the
 * module docstring) and deliberately terse to hold the 6600-byte budget.
 */
export function crashWatchdogMain(host, buildId, isValidEndpointFn, ingestHosts) {
  var ASKED = "meridian.crashwatchdogAsked",
    CRUMB = "meridian.breadcrumb",
    CLEAN = "meridian.cleanExit",
    BHK = "meridian:boot-health",
    READY = "__meridian_ready",
    STALE = "A new version of Meridian is available.",
    CAP = 8192;
  var win = host,
    doc = win.document;
  // §4.4 parity: false iff any guarded storage access threw during
  // this run — stamped on the boot_failure event as storageOk.
  var sok = true;
  // sessionStorage is resolved lazily: on old Safari even touching it can
  // throw, and every access is guarded here anyway.
  function ss(k, v) {
    try {
      var st = win.sessionStorage;
      return v === void 0 ? st.getItem(k) : st.setItem(k, v);
    } catch (e) {
      sok = false;
      return null;
    }
  }
  // §4.3: guarded READ-ONLY access to the durable store (localStorage),
  // where init() keeps the boot-health counter. The watchdog only ever
  // reads it — never a second writer (§4.4). A missing store reads as
  // absent; a throwing one flips storageOk, same as sessionStorage.
  function ds(k) {
    try {
      var d = win.localStorage;
      return d ? d.getItem(k) : null;
    } catch (e) {
      sok = false;
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
  // WebGL probe: webgl2 on one canvas, webgl1 on a SECOND canvas —
  // a canvas that has produced (or attempted) one context mode can
  // refuse the other, so reusing the webgl2 canvas made webgl1 read
  // false on devices that have it (DESIGN-FINAL §1.2 row 20). A
  // device with WebGL2 also does WebGL1, so g2 implies g1. Booleans
  // only — the GPU renderer string (UNMASKED_RENDERER_WEBGL) is
  // deliberately never read: it fingerprints the device (COPPA).
  var g1 = false,
    g2 = false;
  try {
    var cv = doc.createElement("canvas");
    g2 = !!cv.getContext("webgl2");
    if (g2) g1 = true;
    else {
      var cv2 = doc.createElement("canvas");
      g1 = !!cv2.getContext("webgl");
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
    shown = false,
    // Set by onTimer when this load is, in practice, a stalled
    // chunk-recovery reload (fresh chunkReloadNotice, ready unset).
    // show() reads it: recovery copy in the heading, and no send().
    rcv = false;
  function xhr(m, u, b, cb) {
    try {
      var x = new win.XMLHttpRequest();
      x.open(m, u, true);
      if (cb)
        x.onreadystatechange = function () {
          if (x.readyState === 4) cb(x.status, x.responseText);
        };
      // POSTs always carry a body; GETs pass null — the header rides on
      // body presence, not the method string.
      if (b) x.setRequestHeader("Content-Type", "application/json");
      x.send(b);
    } catch (e) {
      if (cb) cb(0, null);
    }
  }
  // "Tell us what happened": the endpoint is resolved at RUNTIME (never
  // baked in) and cached — prefetched at init so it is usually ready by
  // fallback time. The report then goes automatically when the fallback
  // shows (same ObservabilityEvent shape as src/lib/observability.ts —
  // same contract, no parallel pipeline). The cache holds only a resolved
  // endpoint: a transient flags.json failure leaves it empty so show-time
  // retries a fresh GET instead of suppressing the report for the
  // session. Fail-closed: no endpoint, no send, and the player is never
  // told otherwise.
  var epCache;
  function getEndpoint(cb) {
    if (epCache) {
      cb(epCache);
      return;
    }
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
          if (isValidEndpointFn(c, ingestHosts)) ep = String(c).trim();
        }
      } catch (e) {
        /* best-effort */
      }
      // Cache only a resolved endpoint: a transient flags.json failure
      // must not permanently suppress the report — show-time retries.
      if (ep) epCache = ep;
      cb(ep);
    });
  }
  function send() {
    // Once per show: show() itself runs once per page (ASKED guard), so no
    // separate sent-flag is needed.
    getEndpoint(function (ep) {
      if (!ep) return;
      try {
        // COPPA: parsed/coarse facts only (never the UA or GPU
        // string), DPR clamped to 1-4, short-side screen bucket.
        // §4.4 parity, as cut by the §7.5 ladder: the device
        // carries the manifest keys this path can stamp. The subset
        // parser below (rule IDs mirror src/lib/ua-parse.ts:
        // O1/O2/O3/O4 osVersion, B7/B8 Safari name/version, the
        // §2.3 frozen-token denylist) computes what it can; every
        // other stamped new key is the literal "unknown" (§2.1:
        // unknown is a value). engine and deviceClass are dropped
        // entirely (ladder steps 2–3, below): engine is filled
        // worker-side for boot_failure, deviceClass stays
        // "unknown". Memory and cores are never READ here — the
        // host may expose numbers, they still stamp "unknown".
        var r,
          n = win.navigator || {},
          w = win.screen || {},
          uaS = String(n.userAgent).toLowerCase(),
          os = /android/.test(uaS)
            ? "android"
            : /iphone|ipad|ipod/.test(uaS)
              ? "ios"
              : /windows/.test(uaS)
                ? "windows"
                : /mac/.test(uaS)
                  ? "mac"
                  : /linux/.test(uaS)
                    ? "linux"
                    : "other",
          ss = Math.min(w.width, w.height),
          un = "unknown",
          vm = /version\/([0-9]+)\.([0-9]+)/.exec(uaS),
          br = un,
          bv = un,
          ov = un,
          im,
          am;
        // B7/B8 subset, order-guarded: Chromium UAs also carry a
        // Safari/ compat token, so Safari is claimed only when no
        // Chrome/ token is present (B6 outranks B7 in the full rules).
        if (/safari\//.test(uaS) && !/chrome\//.test(uaS)) {
          br = "safari";
          // §7.5 ladder step 1: watchdog browserVersion is MAJOR ONLY.
          if (vm) bv = vm[1];
        }
        if ((im = /(?:cpu(?: iphone)? os|mac os x) ([0-9_]+)/.exec(uaS))) {
          ov = im[1].replace(/_/g, ".");
          // §2.3: the Mac token is frozen — never stamped as a version.
          if (ov === "10.15.7" || ov === "10.15") ov = un;
        } else if (os === "android" && (am = /android ([0-9]+(?:\.[0-9]+)?)/.exec(uaS))) {
          ov = am[1];
          // §2.3: Android 10 + a UA-Reduction tell = frozen, not real.
          if (ov === "10" && (/chrome\/[0-9]+\.0\.0\.0/.test(uaS) || /; k\)/.test(uaS))) ov = un;
        } else if (os === "windows" && (am = /windows nt ([0-9.]+)/.exec(uaS))) {
          ov = am[1];
        }
        // §2.3: iOS 18_6/18_7 freeze only with the Version/ >= 26 witness.
        if (os === "ios" && (ov === "18.6" || ov === "18.7") && vm && +vm[1] >= 26) ov = un;
        // §7.5 ladder step 3: deviceClass is NOT stamped on this path
        // and is NOT recovered worker-side — it stays "unknown" on
        // watchdog boot_failure events. (The P2/P3 subset rules live
        // in src/lib/ua-parse.ts; the watchdog's byte budget cannot
        // carry them — see BRANCH_STATUS.)
        // msSinceBootStart from the recovered trail only (§4.4).
        var ms = un,
          hh = prev && prev.history,
          la = hh && hh[hh.length - 1];
        if (la && typeof la.at === "number" && la.at >= prev.startedAt) ms = la.at - prev.startedAt;
        // §4.3 watchdog stamp (#345): borrow the durable unfinished
        // streak so a boot_failure grades on the same count the app
        // path stamps. Read at send time (freshest — a late-loading
        // bundle's init() may have updated the record since parse).
        // Absent, malformed, or blocked → no stamp: the worker then
        // grades its fallback and says the streak was not stamped.
        // The v:1 shape check mirrors readBootHealth in
        // src/lib/observability.ts; the 0..99 clamp is the manifest's
        // declared range for unfinishedBoots.
        var ub = null;
        try {
          var hp = JSON.parse(ds(BHK) || "");
          // Strict === on purpose: hp.v comes from parsed JSON, so it
          // can be a string ("1") or boolean (true) that loose == would
          // accept — readBootHealth discards those records, and so do
          // we, or the stamp would inflate the worker's severity grade.
          if (hp && hp.v === 1 && typeof hp.unfinished == "number" && isFinite(hp.unfinished))
            ub = Math.min(99, Math.max(0, Math.floor(hp.unfinished)));
        } catch (e) {
          /* absent-safe: ub stays null, nothing is stamped */
        }
        // §7.5 ladder step 2: engine is NOT stamped on this path —
        // for boot_failure events only, the worker fills it from the
        // event's parsed fields via the §3.4 E-rules.
        var dv = {
          browser: br,
          browserVersion: bv,
          os: os,
          osVersion: ov,
          hardwareConcurrency: un,
          deviceMemory: un,
          form: os === "android" || os === "ios" ? "mobile" : "desktop",
          // Same bucket as dprBucket() in src/lib/observability.ts: an
          // integer clamped to 1-4, or undefined when the value is missing
          // or bogus. Rounding alone let odd zoom values such as 7 through.
          dpr: (r = win.devicePixelRatio) > 0 ? Math.min(4, Math.round(r)) || 1 : void 0,
          screen: ss < 480 ? "sm" : ss < 768 ? "md" : ss < 1080 ? "lg" : ss ? "xl" : void 0,
          touchPoints: un,
          displayMode: un,
          connection: un,
          locale: un,
          webgl1: g1,
          // (No device.buildId: the top-level event already carries it,
          // and dropping the copy keeps the script within its byte budget.)
          webgl2: g2
        };
          var ev = {
            type: "boot_failure",
            ts: Date.now(),
            buildId: buildId,
            device: dv,
            // §4.4 parity: same envelope stamps as the app path.
            // unfinishedBoots is stamped below, read-only, when the
            // durable record was readable — the watchdog borrows the
            // streak; it never writes meridian:boot-health.
            lcV: "2",
            storageOk: sok,
            mapMode: prev && (prev.mapMode === "full" || prev.mapMode === "scout") ? prev.mapMode : un,
            msSinceBootStart: ms,
            error: err0 || { name: "Error", message: "boot timeout" }
          };
          // §4.3: stamp the borrowed streak only when one was read —
          // an absent stamp is the honest "not stamped" signal.
          if (ub !== null) ev.unfinishedBoots = ub;
          if (prev) {
            ev.sessionId = prev.sessionId;
            if (prev.lastMilestone) ev.lastMilestone = prev.lastMilestone;
            if (unclean) {
              // Strip the breadcrumb's device sub-object: legacy
              // trails may carry the raw UA string there (device.ua);
              // current builds store the parsed snapshot only, not
              // the raw UA. This watchdog never sends UA either way —
              // the coarse facts already ride on ev.device.
              // Mutating prev is safe: sessionId /
              // lastMilestone were extracted above, prev is never written
              // back to storage and never read again below.
              delete prev.device;
              ev.breadcrumb = prev;
            }
          }
          // Hard cap: serialize small; over the cap drops the breadcrumb.
          // Never throws. (The breadcrumb is the only unbounded field —
          // error text is capped at 300 chars at capture — so one drop
          // step is sufficient.)
          var s = js(ev);
          if (s.length > CAP) {
            delete ev.breadcrumb;
            s = js(ev);
          }
          xhr("POST", ep, s, function (st) {
            // Only claim the send on a 2xx: these are flaky-network
            // devices, and a failed POST must stay silent (fail-closed).
            // insertAdjacentHTML (not innerHTML +=) leaves the existing
            // "Try again" button node — and its focus — intact. The copy
            // asserts what was excluded (never "anonymous": sessionId +
            // device facts are near-unique) and restores the why.
            if (st < 200 || st >= 300) return;
            try {
              var ma = doc.getElementById("ma");
              if (ma)
                ma.insertAdjacentHTML(
                  "beforeend",
                  '<p role="status">Crash note sent, no personal info - helps fix this.</p>'
                );
            } catch (e) {
              /* best-effort */
            }
          });
        } catch (x) {
          /* best-effort */
        }
    });
  }
  var CSS =
    "#mv{position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;" +
    "display:flex;background:rgba(8,12,20,.72);" +
    // Fallback first: browsers without max()/env() (old Safari) ignore the
    // enhanced declaration and keep 16px instead of dropping to 0.
    "padding:16px;" +
    "padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) " +
    "max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}" +
    "#mc{margin:auto;max-width:22rem;width:100%;background:#fff;color:#1b2a3d;border-radius:12px;padding:20px;" +
    "font:16px/1.5 system-ui,sans-serif}" +
    "#mc h2{font-size:18px;margin:0 0 8px}" +
    "#mc p{margin:0 0 12px}" +
    "#ma button{display:block;width:100%;font:inherit;padding:11px;" +
    "margin:0 0 8px;border:2px solid #0b5fff;border-radius:8px;cursor:pointer;" +
    "background:#0b5fff;color:#fff;font-weight:700}" +
    "#ma button:focus-visible,#mc a:focus-visible{" +
    "outline:3px solid #0b5fff;outline-offset:2px}" +
    "#mc a{color:#0b5fff;display:inline-block;min-height:44px;line-height:44px}" +
    "#ma p{font-weight:600}";
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
        // The recovery card's heading says what actually happened —
        // a reload stalled — and blames neither the game's start nor
        // the phone. The WebGL-less variant does not apply here: the
        // load failure is the proximate cause either way. The body
        // line below is shared: it is true for both cards.
        (rcv
          ? "The reload didn't finish loading."
          : g1 || g2
            ? "The game couldn't start on this phone."
            : "This phone can't run the 3D map.") +
        "</h2><p>The game didn't finish loading.</p>" +
        '<div id="ma"><button id="ag">Try again</button></div>' +
        '<a id="mr">Reload</a> · <a id="mn">?nosw=1</a></div>';
      doc.body.appendChild(v);
      v.onclick = function (e) {
        var t = (e && e.target) || {};
        if (t.id === "ag") {
          try {
            win.location.reload();
          } catch (x) {
            /* best-effort */
          }
        }
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
      // Auto-send: no tap needed. Fail-closed and once per session.
      // The recovery card never sends: this session already booted
      // once, so a boot_failure here would be a false report.
      if (!rcv) send();
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
      // Chunk-recovery case: a fresh meridian.chunkReloadNotice
      // (age <= 9e5 ms = CHUNK_RELOAD_NOTICE_MAX_AGE_MS in
      // src/lib/chunk-recovery.ts; keep in sync) was, in practice,
      // written by an app that already booted — chunk-recovery's
      // auto-reload, or MapErrorBoundary's manual "Try again" — just
      // before reloading. In practice, not by construction: the
      // notice's removal when the next boot consumes it is
      // best-effort, so a surviving fresh flag is strong evidence,
      // not proof. If it survived to this timer with ready unset,
      // this load is in practice that recovery reload, stalled: a
      // mid-session chunk failure, not a fresh boot failure. The
      // boot_failure report therefore stands down — but the player
      // does not stand down with it: show() reads rcv and swaps in
      // the recovery card (same overlay, same Try again path,
      // reload-true copy, no send), so a child — possibly in the
      // standalone PWA, which has no browser reload button — is
      // never left on a blank shell. A malformed value reads as NaN
      // and a stale one falls below the cutoff, so both keep the
      // generic fallback, report included.
      rcv = +ss("meridian.chunkReloadNotice") >= Date.now() - 9e5;
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
      if (t.indexOf(STALE) < 0) show();
    } catch (e2) {
      /* best-effort */
    }
  }
  // Prefetch the endpoint at init so it is cached by fallback time.
  // One tiny same-origin GET per page load; the app fetches flags.json
  // itself on boot, so this is the same class of cost.
  getEndpoint(function () {});
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
  // #223: crashWatchdogMain and CSS are renamed too — production build
  // ids are 12 chars (14 for the timestamp fallback), which pushed the
  // rendered script 2–4 bytes over its then budget while the 10-char
  // test fixture still passed. These two renames free 20 bytes.
  // Current figures (§7.5 gated decision): the budget was 6,144
  // bytes with the worst case (14-char build id) at 6,104 bytes.
  // Two features then landed on parallel branches. Issue #345
  // (PR #347) added the read-only boot-health stamp (the ds()
  // reader, the send-time parse, the BHK rename): +338 bytes at
  // the worst case including the strict-`===` shape-check cure,
  // measuring 6,442, budget 6,656 on that branch. PR #349 added
  // the chunk-recovery stand-down in onTimer (+51 bytes, 6,155)
  // and then the recovery card (panel round 1: the report stands
  // down, the player does not — recovery heading + rcv flag + the
  // send() skip; +58 more, 6,213), budget 6,250 on that branch.
  // Merged (PR #349 merge-up over main 70e1be6): both features
  // survive; the rendered worst case MEASURES 6,551 bytes on the
  // merged tree, so the budget is now 6,600 bytes — the smallest
  // round fit keeping the established ~40-byte headroom pattern
  // (49 bytes of margin). Neither name is an
  // object-literal key or a property, so the rename is safe here.
  crashWatchdogMain: "M",
  CSS: "G",
  isValidEndpointFn: "ok",
  ingestHosts: "ih",
  hosts: "hs",
  value: "a",
  host: "H",
  text: "tx",
  isValidWatchdogEndpoint: "vv",
  getEndpoint: "ge",
  epCache: "ec",
  ASKED: "A",
  CRUMB: "B",
  CLEAN: "C",
  BHK: "J",
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
  err0: "e0",
  uaS: "u",
  ma: "q",
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
  let prev2 = null; // the one before it
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
    // Fold `"a" + "b"` into `"ab"` (double-quoted literals only). String
    // concatenation is associative, and the embedded sources never apply
    // a member access or a higher-precedence operator to the right-hand
    // literal, so the value is unchanged. It saves 3 bytes per join in the
    // multi-line CSS string.
    if (
      kind === "str" &&
      v[0] === '"' &&
      prev && prev[0] === "punc" && prev[1] === "+" &&
      prev2 && prev2[0] === "str" && prev2[1][0] === '"'
    ) {
      out = out.slice(0, -2) + v.slice(1); // drop the closing quote and "+"
      prev2 = null;
      prev = ["str", '"' + v.slice(1)];
      pendingSpace = false;
      continue;
    }
    if (pendingSpace) {
      pendingSpace = false;
      // A space survives only between two word characters (renames such
      // as "!1" start with punctuation, so "return !1" becomes "return!1").
      if (prev && _isWordCh(out[out.length - 1]) && _isWordCh(v[0])) out += " ";
    }
    out += v;
    prev2 = prev;
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
    "," +
    JSON.stringify(OBSERVABILITY_INGEST_HOSTS) +
    ");";
  return "<script>/*meridian-crash-watchdog*/try{" + body + "}catch(e){}</script>";
}
