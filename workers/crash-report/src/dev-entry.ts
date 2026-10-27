/**
 * Local-dev entry point for `wrangler dev` ONLY (#234).
 *
 * Why this file exists: workerd validates every named export of the
 * entry module as if it were a handler, and `src/index.ts` exports
 * plain constants (for example `ANOMALY_MIN_COUNT = 3`) alongside the
 * handler for its unit tests — so pointing wrangler at `index.ts`
 * fails to boot with "Incorrect type for map entry
 * 'ANOMALY_MIN_COUNT': the provided value is not of type 'function
 * or ExportedHandler'". This wrapper re-exports only the default
 * handler, which is all workerd needs.
 *
 * Production never uses this file: a release bundles `src/index.ts`
 * directly (see README, "The release, step by step") and uploads it
 * through the API. `wrangler.toml` points `main` here purely so the
 * documented `npx wrangler dev -c wrangler.toml` command boots.
 */
import handler from "./index.ts";

export default handler;
