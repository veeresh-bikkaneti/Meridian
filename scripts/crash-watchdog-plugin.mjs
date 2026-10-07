/**
 * Build plugin for the inline crash watchdog (boot_failure reporter).
 *
 * Injects the dependency-free inline script from scripts/crash-watchdog.mjs
 * into the SPA shell (_shell.html) just before </body>, so it runs before
 * any app bundle code — even when the bundle itself cannot load. It also
 * injects window.__MERIDIAN_BUILD_ID__ immediately before the watchdog so
 * the build identity is available to inline scripts at runtime.
 *
 * Ordering matters: TanStack Start's SPA shell is written by its prerender
 * step, which runs in a `buildApp: { order: "post" }` builder hook AFTER
 * every environment bundle is written. So this plugin patches the file in
 * its own `buildApp` post hook and MUST be registered after tanstackStart()
 * in vite.config.ts (same order, later plugin wins). The generateBundle /
 * writeBundle fallbacks below stay as belt-and-braces for any emission
 * path that puts the shell through the Rollup graph instead. All three are
 * idempotent via the `meridian-crash-watchdog` marker.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderCrashWatchdogScript } from "./crash-watchdog.mjs";

const MARKER = "meridian-crash-watchdog";
const SHELL = "_shell.html";

/** True for the GitHub Pages production build (`npm run build:pages`). */
function isPagesBuild() {
  return process.env.GITHUB_PAGES === "1";
}

/**
 * Build id for the watchdog, read from public/build-meta.json at build
 * time (same try/catch pattern as buildIdForBundle() in vite.config.ts).
 * Falls back to "unknown" when the prebuild has not run (dev).
 */
function buildIdForWatchdog() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const meta = JSON.parse(readFileSync(join(here, "..", "public", "build-meta.json"), "utf8"));
    if (meta && typeof meta.buildId === "string" && meta.buildId.length > 0) {
      return meta.buildId;
    }
  } catch {
    // Not written yet (dev) — fall through to "unknown".
  }
  return "unknown";
}

/** Escape a string for safe embedding inside a <script> element. */
function scriptSafe(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function inject(html) {
  if (html.includes(MARKER)) return html;
  if (!html.includes("</body>")) return html;
  const buildId = buildIdForWatchdog();
  const idScript = `<script>window.__MERIDIAN_BUILD_ID__=${scriptSafe(buildId)};</script>`;
  const watchdog = renderCrashWatchdogScript(buildId);
  return html.replace("</body>", `${idScript}${watchdog}</body>`);
}

/** Patch the emitted shell file on disk; no-op when absent or unpatched. */
function patchShellFile(dir) {
  try {
    if (!dir) return false;
    const file = join(dir, SHELL);
    if (!existsSync(file)) return false;
    const html = readFileSync(file, "utf8");
    const patched = inject(html);
    if (patched === html) return false;
    writeFileSync(file, patched);
    return true;
  } catch (err) {
    // Never fail the build over the watchdog: the app ships without it
    // rather than not shipping at all.
    console.warn("[meridian:crash-watchdog] injection skipped:", err);
    return false;
  }
}

/** Does this out dir hold an emitted shell file at all? */
function shellExists(dir) {
  try {
    return !!dir && existsSync(join(dir, SHELL));
  } catch {
    return false;
  }
}

/**
 * Fail closed on Pages builds: the watchdog marker must be present in the
 * emitted shell. A silent skip here (TanStack changes hook order, renames
 * the shell, or the </body> anchor moves) would otherwise ship the crash
 * reporter as a no-op. Non-Pages builds (dev/preview/Vercel) keep the old
 * non-fatal behavior — the watchdog is Pages-specific.
 */
function assertWatchdogPresent(dir) {
  if (!isPagesBuild()) return;
  let html = "";
  try {
    html = readFileSync(join(dir, SHELL), "utf8");
  } catch {
    /* fall through to the throw below */
  }
  if (!html.includes(MARKER)) {
    throw new Error(
      "[meridian:crash-watchdog] marker absent from the emitted _shell.html — " +
        "the crash watchdog did not land in the Pages build; refusing " +
        "to ship the artifact without it.",
    );
  }
}

export function crashWatchdogPlugin() {
  // Candidate shell locations, resolved from the vite config (client env
  // first). Filled in configResolved; the buildApp post hook runs after
  // TanStack's prerender wrote the shell.
  let outDirs = [];
  return {
    name: "meridian:crash-watchdog",
    // Post, like TanStack's own post-build plugin: within the post group,
    // registration order decides, and this plugin is registered AFTER
    // tanstackStart() in vite.config.ts — so its buildApp post hook runs
    // after the prerender wrote _shell.html.
    enforce: "post",
    apply: "build",
    configResolved(config) {
      const dirs = [];
      try {
        const envs = config.environments ?? {};
        for (const name of Object.keys(envs)) {
          const outDir = envs[name]?.build?.outDir;
          if (typeof outDir === "string" && outDir) dirs.push(outDir);
        }
      } catch {
        /* fall through to the default below */
      }
      if (typeof config.build?.outDir === "string" && config.build.outDir) {
        dirs.push(config.build.outDir);
      }
      // De-dupe, client env first (its name contains "client" by convention).
      dirs.sort((a, b) => Number(!/client/i.test(a)) - Number(!/client/i.test(b)));
      outDirs = [...new Set(dirs)];
    },
    generateBundle(_options, bundle) {
      const asset = bundle[SHELL];
      if (asset && asset.type === "asset" && typeof asset.source === "string") {
        const patched = inject(asset.source);
        if (patched !== asset.source) asset.source = patched;
      }
    },
    writeBundle(options) {
      patchShellFile(options.dir);
    },
    buildApp: {
      // Runs after TanStack's own post-build (same order, later plugin in
      // vite.config.ts wins) — i.e. after the prerender wrote _shell.html.
      order: "post",
      async handler() {
        for (const dir of outDirs) {
          patchShellFile(dir); // idempotent; no-op when absent or already patched
          if (shellExists(dir)) {
            // The shell was emitted: the watchdog must be in it (Pages builds
            // fail the build outright rather than shipping without it).
            assertWatchdogPresent(dir);
            return;
          }
        }
        if (isPagesBuild()) {
          throw new Error(
            "[meridian:crash-watchdog] _shell.html not found post-build — the " +
              "crash watchdog has nowhere to land; refusing to ship the " +
              "Pages artifact without it.",
          );
        }
        console.warn("[meridian:crash-watchdog] _shell.html not found post-build");
      },
    },
  };
}
