import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
// @ts-expect-error JS plugin alongside the TS vite config
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { noswHatchPlugin } from "./scripts/nosw-hatch-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { crashWatchdogPlugin } from "./scripts/crash-watchdog-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { fingerprintSwPlugin } from "./scripts/fingerprint-sw-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";
// @ts-expect-error JS module alongside the TS vite config
import { resolveBuildId } from "./scripts/build-id.mjs";

/**
 * Build ID baked into the bundle (see src/game/build-staleness.ts). Prefers
 * the prebuild-written public/build-meta.json so the baked ID and the served
 * meta can never disagree; falls back to resolveBuildId() when prebuild has
 * not run (dev server). This matters in the timestamp-fallback path (no git,
 * e.g. tarball builds), where two independent resolutions would diverge and
 * every chunk error would falsely offer a refresh.
 */
function buildIdForBundle(): string {
  try {
    const meta = JSON.parse(
      readFileSync(new URL("./public/build-meta.json", import.meta.url), "utf8"),
    ) as { buildId?: unknown };
    if (typeof meta.buildId === "string" && meta.buildId.length > 0) return meta.buildId;
  } catch {
    // Not written yet (dev) — fall through to a fresh resolution.
  }
  return resolveBuildId();
}
import { isMigrationFile } from "./scripts/migration-plan.mjs";

/** The files `src/lib/db.ts` globs — same directory, same non-recursive scope. */
function hasGlobbedMigrations(root: string): boolean {
  try {
    return readdirSync(join(root, "migrations")).some(isMigrationFile);
  } catch {
    return false;
  }
}

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic). Vite awaits
 * async `configureServer` hooks. Production: `src/lib/db` kicks `ensureDbReady`
 * on import.
 *
 * Vite awaiting the hook puts this on time-to-first-render, so an app with no
 * migrations — no schema to apply — skips it entirely rather than paying for a
 * PGLite instance it never queries.
 */
function maplibreWorkerPlugin(): Plugin {
  return {
    name: "maplibre-worker-files",
    apply: "build",
    generateBundle() {
      const environment = (this as { environment?: { name?: string } }).environment?.name;
      if (environment && environment !== "client") return;
      const dir = join("node_modules", "maplibre-gl", "dist");
      for (const name of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
        this.emitFile({
          type: "asset",
          fileName: `assets/${name}`,
          source: readFileSync(join(dir, name)),
        });
      }
    },
  };
}

/**
 * Keep the canonical `chunks/globe.json` out of the bundles.
 *
 * The Globe runtime loads the derived per-tier files in
 * `data/geonames/tiers/` (scripts/globe-tiers.mjs). The generic region
 * loader's `import(\`./data/geonames/chunks/${regionId}.json\`)` makes Vite
 * glob-bundle every file in `chunks/`, which would also ship the 13.7 MB
 * canonical Globe chunk as a lazy asset nothing ever fetches. Stubbing it
 * here keeps dist (and the deploy) free of that dead weight. Nothing imports
 * it at runtime — if that ever regressed, the empty stub fails the loader's
 * meta check (fail closed) rather than dealing a partial pool.
 */
function omitCanonicalGlobeChunkPlugin(): Plugin {
  const STUB_ID = "\0meridian:omitted-globe-chunk";
  return {
    name: "meridian:omit-canonical-globe-chunk",
    apply: "build",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!source.endsWith("globe.json")) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved && resolved.id.replace(/\\/g, "/").endsWith("/data/geonames/chunks/globe.json")) {
        return STUB_ID;
      }
      return null;
    },
    load(id) {
      return id === STUB_ID ? "export default {};" : null;
    },
  };
}

function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app-builder:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      if (!hasGlobbedMigrations(server.config.root)) return;
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app-builder] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

/**
 * Live-preview OAuth popup — handled HERE so the agent never has to create a
 * `/auth/popup` route (and cannot break it by scaffolding a React page that
 * paints the full app shell in the popup).
 *
 * `signIn` (client.ts) opens `/auth/popup?providerId=…` in a top-level window.
 * This middleware runs before TanStack Start, calls `handleAuthPopupRequest`,
 * and returns the 302 / completion HTML. Deployed apps do not use the popup
 * (full-page OAuth redirect), so `apply: "serve"` is enough.
 */
function authPopupPlugin(): Plugin {
  return {
    name: "app-builder:auth-popup",
    apply: "serve",
    configureServer(server) {
      // Register immediately (not in a returned post-hook) so we run BEFORE
      // TanStack Start / the SPA HTML fallback. A model-authored
      // `src/routes/auth/popup.tsx` React page must never win this path.
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";
          if (pathOnly !== "/auth/popup") {
            next();
            return;
          }
          if ((req.method ?? "GET").toUpperCase() !== "GET") {
            res.statusCode = 405;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("Method Not Allowed");
            return;
          }

          const host = String(
            req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080",
          );
          const proto = String(
            req.headers["x-forwarded-proto"] ??
              ((req.socket as { encrypted?: boolean } | undefined)?.encrypted ? "https" : "http"),
          );
          const requestHeaders = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              for (const v of value) requestHeaders.append(key, v);
            } else {
              requestHeaders.set(key, value);
            }
          }
          // Ensure Host is the public preview host so Better Auth's dynamic
          // baseURL / redirect_uri match the popup origin.
          if (!requestHeaders.has("host")) requestHeaders.set("host", host);

          const request = new Request(`${proto}://${host}${rawUrl}`, {
            method: "GET",
            headers: requestHeaders,
          });

          const mod = (await server.ssrLoadModule("/src/lib/auth/popup.server.ts")) as {
            handleAuthPopupRequest: (req: Request) => Promise<Response>;
          };
          const response = await mod.handleAuthPopupRequest(request);

          res.statusCode = response.status;
          // Preserve multiple Set-Cookie headers (OAuth state + session).
          const setCookies =
            typeof response.headers.getSetCookie === "function"
              ? response.headers.getSetCookie()
              : [];
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") return;
            res.setHeader(key, value);
          });
          for (const cookie of setCookies) {
            res.appendHeader("set-cookie", cookie);
          }
          const body = Buffer.from(await response.arrayBuffer());
          res.end(body);
        } catch (err) {
          console.error("[app-builder] /auth/popup handler failed:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("auth popup failed");
          }
        }
      });
    },
  };
}

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// The dev server starts once `src/router.tsx` and `src/routes/` exist — see
// AGENTS.md § "First scaffold".
// GitHub Pages is a second, static build. The preview and the Vercel build
// stay on `/` with the Nitro server.
const githubPages = process.env.GITHUB_PAGES === "1";

export default defineConfig(({ command, isPreview }) => ({
  base: githubPages ? "/Meridian/" : "/",
  define: {
    // Baked-in build identity for deploy-awareness (see src/game/build-staleness.ts).
    __MERIDIAN_BUILD_ID__: JSON.stringify(buildIdForBundle()),
  },
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    pgliteBootstrapPlugin(),
    // Before tanstackStart so /auth/popup never falls through to the SPA.
    authPopupPlugin(),
    // Dev-only /__app-env, read by scripts/check-auth-invariant.mjs.
    appEnvPlugin(),
    // PWA head + ?install=1 tutorial page; runs before Start/Nitro.
    grokPwaPlugin(),
    tailwindcss(),
    // Cloudflare deploy shape for the production Worker: builds the
    // "ssr" environment into the bundle `wrangler deploy` uploads (the
    // entry is src/server.ts — see the root wrangler.jsonc) and writes
    // the config that deploy follows. Scoped to the ssr environment
    // only, so the client build and the GitHub Pages build are
    // untouched. Must be registered before tanstackStart.
    // Why: docs/reviews/2026-10-22-wrangler-config-entry.md (WI-19b).
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart(githubPages ? { spa: { enabled: true } } : undefined),
    // ?nosw=1 escape hatch AFTER tanstackStart: its buildApp post hook must
    // run after TanStack's prerender wrote _shell.html (same post order +
    // post enforce → later registration wins). See scripts/nosw-hatch-plugin.mjs.
    noswHatchPlugin(),
    // Inline crash watchdog AFTER tanstackStart (same post-order reason as
    // the nosw hatch): reports boot_failure when the bundle never loads.
    // See scripts/crash-watchdog-plugin.mjs.
    crashWatchdogPlugin(),
    // Fingerprint the service worker with the build ID. Runs inside the
    // build so it works even when vite is invoked directly (bypassing npm
    // lifecycle hooks). Idempotent — safe alongside postbuild hooks.
    // See scripts/fingerprint-sw-plugin.mjs.
    fingerprintSwPlugin(),
    ...(githubPages
      ? []
      : command === "build" || isPreview
        ? [
            nitro({
              preset: "vercel",
              // Auto-registers server/middleware/* (the PWA install page +
              // manifest + head-tag middleware). Nitro v3 defaults serverDir to
              // false, so removing this silently unwires /?install=1 on deploys.
              serverDir: "./server",
            }),
          ]
        : []),
    viteReact(),
    maplibreWorkerPlugin(),
    omitCanonicalGlobeChunkPlugin(),
  ],
}));
