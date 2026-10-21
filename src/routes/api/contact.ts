import { createFileRoute } from "@tanstack/react-router";
import { handleContactRequest, readContactRuntimeEnv } from "@/lib/contact/contact-handler.server";

/**
 * POST /api/contact — server-only route on the main `meridian` worker
 * (team rationale, no owner words on record: no separate contact worker).
 *
 * All logic lives in src/lib/contact/contact-handler.server.ts; this file
 * only mounts it. Separation from crash reporting is by construction: the
 * crash pipeline is a different worker (workers/crash-report) with its own
 * DISCORD_WEBHOOK_URL; this route reads only CONTACT_DISCORD_WEBHOOK_URL.
 *
 * readContactRuntimeEnv() adds the optional Workers Rate Limiting bindings
 * (CONTACT_RATE_LIMITER / CONTACT_GLOBAL_RATE_LIMITER) to the string config.
 * If they are missing, the in-memory limiter still applies.
 *
 * The static GitHub Pages build has no server, so this route only exists
 * on the Cloudflare (and preview) builds; the Pages mirror posts here
 * cross-origin via flags.json `contactEndpoint`.
 */
export const Route = createFileRoute("/api/contact")({
  server: {
    handlers: {
      POST: async ({ request }) => handleContactRequest(request, await readContactRuntimeEnv()),
      OPTIONS: async ({ request }) => handleContactRequest(request, await readContactRuntimeEnv()),
      GET: async ({ request }) => handleContactRequest(request, await readContactRuntimeEnv()),
    },
  },
});
