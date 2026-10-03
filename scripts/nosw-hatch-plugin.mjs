/**
 * Build plugin for the `?nosw=1` escape hatch (P0 Safari launch fix).
 *
 * Injects the dependency-free inline script from scripts/nosw-hatch.mjs
 * into the SPA shell (_shell.html) just before </head>, so it runs before
 * any app bundle code — even when the bundle itself cannot load.
 *
 * Ordering matters: TanStack Start's SPA shell is written by its prerender
 * step, which runs in a `buildApp: { order: "post" }` builder hook AFTER
 * every environment bundle is written. So this plugin patches the file in
 * its own `buildApp` post hook and MUST be registered after tanstackStart()
 * in vite.config.ts (same order, later plugin wins). The generateBundle /
 * writeBundle fallbacks below stay as belt-and-braces for any emission
 * path that puts the shell through the Rollup graph instead. All three are
 * idempotent via the `meridian-nosw-hatch` marker.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderNoswHatchScript } from "./nosw-hatch.mjs";

const MARKER = "meridian-nosw-hatch";
const SHELL = "_shell.html";

function inject(html) {
  if (html.includes(MARKER)) return html;
  const script = renderNoswHatchScript();
  if (!html.includes("</head>")) return html;
  return html.replace("</head>", `${script}</head>`);
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
    // Never fail the build over the hatch: the app ships without it
    // rather than not shipping at all.
    console.warn("[meridian:nosw-hatch] injection skipped:", err);
    return false;
  }
}

export function noswHatchPlugin() {
  // Candidate shell locations, resolved from the vite config (client env
  // first). Filled in configResolved; the buildApp post hook runs after
  // TanStack's prerender wrote the shell.
  let outDirs = [];
  return {
    name: "meridian:nosw-hatch",
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
          if (patchShellFile(dir)) return;
        }
        console.warn("[meridian:nosw-hatch] _shell.html not found post-build");
      },
    },
  };
}
