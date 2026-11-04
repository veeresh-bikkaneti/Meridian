/**
 * Dev-only `/__app-env` endpoint: the client env the running Vite server
 * resolved, as JSON.
 *
 * Dev tooling reads it to see the app env the live dev server resolved.
 * The config is loaded even when Vite is started outside
 * `scripts/with-app-env.mjs`. These are the same values Vite inlines
 * into the client bundle, and `apply: "serve"` keeps the route out of deployed
 * apps.
 */
export const APP_ENV_ROUTE = "/__app-env";

export function appEnvPlugin() {
  return {
    name: "app-builder:app-env",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathOnly = (req.url ?? "").split("?", 1)[0];
        if (pathOnly !== APP_ENV_ROUTE || (req.method ?? "GET").toUpperCase() !== "GET") {
          next();
          return;
        }
        const body = Buffer.from(JSON.stringify(server.config.env), "utf8");
        res.statusCode = 200;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.setHeader("cache-control", "no-cache");
        res.setHeader("content-length", String(body.byteLength));
        res.end(body);
      });
    },
  };
}
