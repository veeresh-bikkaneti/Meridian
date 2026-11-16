/**
 * Deployed-app (Nitro) half of the platform PWA chrome. Auto-registered as
 * global h3 middleware because vite.config.ts sets `serverDir: "./server"` —
 * without that option Nitro v3 never scans this directory.
 *
 * - `?install=1&platform=ios` on a document path → the Home Screen tutorial,
 *   bundled into the server build via `?raw` (the public/ directory is CDN
 *   static output on Vercel and not readable from the function).
 * - `/__grok/manifest.webmanifest` → per-app-named manifest (kept out of
 *   public/ so this dynamic response is the only one).
 * - Other HTML documents → stream-inject PWA + OG head tags at `</head>`,
 *   plus the app's boot-rescue scripts for parity with the Pages build:
 *   the `?nosw=1` escape hatch before `</head>` and the crash watchdog
 *   before `</body>` (QA/UI-UX council, 2026-11-16: the Workers SSR
 *   shell carried neither, so a wedged service worker on this deploy
 *   had no self-rescue and boot failures left no report).
 *   OG identity is baked via `virtual:grok-og-identity` at `vite build`
 *   (this function cannot read `src/lib/og/site.json` or `public/og.jpg`).
 *   This must be a middleware transforming `next()`: h3 discards the `response`
 *   runtime hook's return value, and `render:html` does not exist in Nitro v3.
 */
import installPageTemplate from "../../scripts/install-page.html?raw";
import { grokBuildId, grokOgIdentity } from "virtual:grok-og-identity";
import {
  acceptsHtml,
  createCloseTagInjector,
  createHeadInjector,
  isDocumentPath,
  isInstallQuery,
  renderCrashWatchdogScript,
  renderInstallPageHtml,
  renderNoswHatchScript,
  renderWebManifest,
} from "../../scripts/grok-pwa-shared.mjs";

interface GrokPwaEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

function requestHost(event: GrokPwaEvent): string {
  return (
    event.req.headers.get("x-forwarded-host") ?? event.req.headers.get("host") ?? event.url.host
  );
}

interface PushFlushInjector {
  push(chunk: Uint8Array | string): Uint8Array[];
  flush(): Uint8Array[];
}

function injectorStream(injector: PushFlushInjector): TransformStream<Uint8Array, Uint8Array> {
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      for (const out of injector.push(chunk)) controller.enqueue(out);
    },
    flush(controller) {
      for (const out of injector.flush()) controller.enqueue(out);
    },
  });
}

function injectHeadStreaming(response: Response, host: string): Response {
  const head = createHeadInjector({
    host,
    site: grokOgIdentity.site,
  });
  // Pages parity (QA/UI-UX council, 2026-11-16): the static build gets
  // these from its shell plugins; the SSR shell gets them here. The
  // hatch must sit in the head so it runs before any bundle code; the
  // watchdog only needs to be inline before the bundles execute, and
  // the end of the body is where the Pages shell carries it too.
  const hatch = createCloseTagInjector({
    closeTag: "head",
    marker: "meridian-nosw-hatch",
    render: () => renderNoswHatchScript(),
  });
  const watchdog = createCloseTagInjector({
    closeTag: "body",
    marker: "meridian-crash-watchdog",
    render: () => renderCrashWatchdogScript(grokBuildId),
  });
  const transformed = response
    .body!.pipeThrough(injectorStream(head))
    .pipeThrough(injectorStream(hatch))
    .pipeThrough(injectorStream(watchdog));
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(transformed, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default async function grokPwaMiddleware(
  event: GrokPwaEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const method = (event.req.method ?? "GET").toUpperCase();
  if (method !== "GET") return next();

  const path = event.url.pathname;
  const urlWithQuery = path + event.url.search;

  if (path === "/__grok/manifest.webmanifest" || path === "/__grok/manifest.json") {
    return new Response(renderWebManifest(requestHost(event)), {
      headers: {
        "content-type": "application/manifest+json; charset=utf-8",
        "cache-control": "no-cache",
      },
    });
  }

  if (
    isInstallQuery(urlWithQuery) &&
    isDocumentPath(path) &&
    acceptsHtml(event.req.headers.get("accept"))
  ) {
    const html = renderInstallPageHtml(installPageTemplate, {
      host: requestHost(event),
      url: urlWithQuery,
    });
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-cache",
      },
    });
  }

  if (!isDocumentPath(path)) return next();

  const result = await next();
  if (
    result instanceof Response &&
    result.body &&
    String(result.headers.get("content-type") ?? "").includes("text/html") &&
    !result.headers.get("content-encoding")
  ) {
    return injectHeadStreaming(result, requestHost(event));
  }
  return result;
}
