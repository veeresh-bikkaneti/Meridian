import { createFileRoute } from "@tanstack/react-router";
import { handleContactRequest, readContactEnv } from "@/lib/contact/contact-handler.server";

/**
 * POST /api/contact — server-only route on the main `meridian` worker
 * (owner decision 2026-10-21: no separate contact worker).
 *
 * All logic lives in src/lib/contact/contact-handler.server.ts; this file
 * only mounts it. Separation from crash reporting is by construction: the
 * crash pipeline is a different worker (workers/crash-report) with its own
 * DISCORD_WEBHOOK_URL; this route reads only CONTACT_DISCORD_WEBHOOK_URL.
 *
 * The static GitHub Pages build has no server, so this route only exists
 * on the Cloudflare (and preview) builds; the Pages mirror posts here
 * cross-origin via flags.json `contactEndpoint`.
 */
export const Route = createFileRoute("/api/contact")({
  server: {
    handlers: {
      POST: ({ request }) => handleContactRequest(request, readContactEnv()),
      OPTIONS: ({ request }) => handleContactRequest(request, readContactEnv()),
      GET: ({ request }) => handleContactRequest(request, readContactEnv()),
    },
  },
});
