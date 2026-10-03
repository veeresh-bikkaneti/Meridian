/**
 * The `?nosw=1` escape hatch (P0 Safari launch fix).
 *
 * iOS service-worker interception of navigation/boot assets is ranked
 * suspect #2 for the Safari launch outage — the one place the in-page
 * crash-loop breaker can't reach. This module is the hatch logic; it is
 * injected as a tiny dependency-free inline <script> into the SPA shell
 * (_shell.html) by scripts/nosw-hatch-plugin.mjs, and runs before any app
 * bundle code.
 *
 * Behavior: when `location.search` contains `nosw=1`, unregister every
 * service-worker registration scoped under this app's base (NOT the whole
 * origin — sibling projects share veeresh-bikkaneti.github.io), delete
 * every `meridian-*` cache, strip the param with history.replaceState,
 * record what was cleaned in sessionStorage (`meridian.noswHatch`, so the
 * cleanup is observable and E2E-verifiable even though the app re-registers
 * its worker on the clean reload), then reload exactly once. Everything is
 * guarded: any throw anywhere fails open to "strip the param and reload
 * anyway", and the strip is loop-proof — if replaceState threw, the hatch
 * navigates to the stripped URL instead of reloading with `?nosw=1` intact
 * (which would re-run the hatch forever).
 *
 * Operator note (phone support): to clear a stuck client, send the user a
 * link ending in `?nosw=1`; it unregisters Meridian-scoped SWs, purges
 * `meridian-*` caches, strips the param, reloads once, and records
 * `sessionStorage['meridian.noswHatch']`.
 *
 * The logic is written against an injected `host` (location/history/
 * navigator/caches/sessionStorage/setTimeout) so node --test can exercise
 * the real orchestration with fakes; the inline script passes `window`.
 * `renderNoswHatchScript()` builds the self-contained inline script from
 * these functions' own source, so the shipped bytes and the tested code
 * cannot drift apart.
 */

export function isNoswRequest(search) {
  if (typeof search !== "string") return false;
  return /(?:^|[?&])nosw=1(?:[&#]|$)/.test(search);
}

export function stripNoswParam(href) {
  const url = new URL(href);
  url.searchParams.delete("nosw");
  return url.pathname + url.search + url.hash;
}

/**
 * Exported for the node --test harness (scripts/nosw-hatch.test.mjs), which
 * drives the real orchestration against fake browser globals. The inline
 * script embeds this same function by source via renderNoswHatchScript().
 */
export function noswHatchMain(isNoswRequestFn, stripNoswParamFn, host) {  var loc;
  var hist;
  try {
    loc = host.location;
    hist = host.history;
    if (!isNoswRequestFn(loc.search)) return;

    var finished = false;
    var reloaded = false;
    var paramStripped = false;
    var swUnregistered = 0;
    var cachesDeleted = [];

    // The app registers its worker with scope = BASE_URL (see src/lib/pwa.ts);
    // the shell's own directory is that base. Only registrations scoped
    // under it are ours — getRegistrations() is origin-wide, and sibling
    // projects share this origin on GitHub Pages.
    var basePath = (loc.pathname || "/").replace(/[^/]*$/, "") || "/";

    function scopePathOf(reg) {
      var scope = reg && reg.scope;
      if (typeof scope !== "string" || scope === "") return null;
      try {
        return new URL(scope, loc.href).pathname;
      } catch (e) {
        return null;
      }
    }

    function underAppBase(reg) {
      var scopePath = scopePathOf(reg);
      if (scopePath === null) return false;
      return (
        scopePath.indexOf(basePath) === 0 || scopePath + "/" === basePath
      );
    }

    function record(result) {
      try {
        host.sessionStorage.setItem("meridian.noswHatch", JSON.stringify(result));
      } catch (e) {
        /* the marker is best-effort diagnostics, never load-bearing */
      }
    }

    function stripParam() {
      try {
        hist.replaceState(null, "", stripNoswParamFn(loc.href));
        paramStripped = true;
      } catch (e) {
        /* reloadOnce() below navigates to the stripped URL instead */
      }
    }

    // Airtight fail-open: at most one navigation, and it can never carry
    // ?nosw=1. If replaceState threw, a bare reload() would fire with the
    // param intact and the hatch would re-run forever — navigate to the
    // stripped URL instead, where the param is gone by construction.
    function reloadOnce() {
      if (reloaded) return;
      reloaded = true;
      if (!paramStripped && isNoswRequestFn(loc.search)) {
        try {
          loc.replace(stripNoswParamFn(loc.href));
          return;
        } catch (e) {
          /* fall through: reload anyway rather than strand the page */
        }
      }
      loc.reload();
    }

    // Fail-open: strip the param and reload even if cleanup throws.
    function failOpen() {
      stripParam();
      reloadOnce();
    }

    function finish() {
      if (finished) return;
      finished = true;
      stripParam();
      record({
        ran: true,
        at: Date.now(),
        swUnregistered: swUnregistered,
        cachesDeleted: cachesDeleted,
      });
      reloadOnce();
    }

    var nav = host.navigator;
    var cachesApi = host.caches;
    var jobs = [];
    try {
      if (nav && nav.serviceWorker && nav.serviceWorker.getRegistrations) {
        jobs.push(
          nav.serviceWorker
            .getRegistrations()
            .then(function (regs) {
              return Promise.all(
                regs
                  .filter(underAppBase)
                  .map(function (reg) {
                    return reg
                      .unregister()
                      .then(function (ok) {
                        if (ok) swUnregistered += 1;
                      })
                      .catch(function () {});
                  }),
              );
            })
            .catch(function () {}),
        );
      }
      if (cachesApi && cachesApi.keys) {
        jobs.push(
          cachesApi
            .keys()
            .then(function (keys) {
              return Promise.all(
                keys
                  .filter(function (k) {
                    return k.indexOf("meridian-") === 0;
                  })
                  .map(function (k) {
                    return cachesApi
                      .delete(k)
                      .then(function (ok) {
                        if (ok) cachesDeleted.push(k);
                      })
                      .catch(function () {});
                  }),
              );
            })
            .catch(function () {}),
        );
      }
    } catch (e) {
      failOpen();
      return;
    }

    // Backstop: never hang the hatch on a stalled promise — reload anyway.
    var timer = null;
    if (host.setTimeout) {
      timer = host.setTimeout(finish, 8000);
    }
    Promise.all(jobs).then(
      function () {
        if (timer !== null && host.clearTimeout) host.clearTimeout(timer);
        finish();
      },
      function () {
        failOpen();
      },
    );
  } catch (e) {
    // Fail-open for anything unexpected above (e.g. host.location missing).
    // Strip via navigation rather than replaceState+reload: replaceState may
    // be the thing that threw, and a reload with ?nosw=1 intact would loop.
    try {
      host.location.replace(stripNoswParamFn(host.location.href));
    } catch (e2) {
      try {
        host.location.reload();
      } catch (e3) {
        /* nothing left to try */
      }
    }
  }
}

/**
 * Render the dependency-free inline <script> for the SPA shell. The
 * orchestration function is embedded by source, with its two pure helpers
 * passed as arguments — no imports, no globals beyond standard browser APIs.
 */
export function renderNoswHatchScript() {
  const body =
    "(" +
    noswHatchMain.toString() +
    ")(" +
    isNoswRequest.toString() +
    "," +
    stripNoswParam.toString() +
    ",window);";
  return '<script>/*meridian-nosw-hatch*/try{' + body + "}catch(e){}</script>";
}
