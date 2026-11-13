import { createFileRoute } from "@tanstack/react-router";
import {
  handleFeatureRequest,
  readFeatureRequestRuntimeEnv,
} from "@/lib/feature-request/feature-request-handler.server";

/**
 * POST /api/feature-request — server-only route on the main `meridian`
 * worker. All logic lives in
 * src/lib/feature-request/feature-request-handler.server.ts, which is
 * built on the contact handler's code; this file only mounts it. The
 * route reads only FEATURE_DISCORD_WEBHOOK_URL (its own Discord channel)
 * and FEATURE_TURNSTILE_SECRET_KEY — never the contact or crash-report
 * secrets.
 *
 * The static GitHub Pages build has no server, so this route only exists
 * on the Cloudflare (and preview) builds; the Pages mirror posts here
 * cross-origin via flags.json `featureRequestEndpoint`, the same pattern
 * as the contact form.
 */
export const Route = createFileRoute("/api/feature-request")({
  server: {
    handlers: {
      POST: async ({ request }) => handleFeatureRequest(request, await readFeatureRequestRuntimeEnv()),
      OPTIONS: async ({ request }) => handleFeatureRequest(request, await readFeatureRequestRuntimeEnv()),
      GET: async ({ request }) => handleFeatureRequest(request, await readFeatureRequestRuntimeEnv()),
    },
  },
});
