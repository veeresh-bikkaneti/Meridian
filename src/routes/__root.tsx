import { BRAND } from "@/game/brand";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { registerServiceWorker, unregisterServiceWorker, type PwaUpdateHandle } from "@/lib/pwa";
import { isEnabled, loadFlags } from "@/lib/flags";
import { useEffect, useState } from "react";
import appCss from "../styles.css?url";

const APP_NAME = BRAND.name;

// Feature-flag overrides load network-first in parallel with boot. The
// production load is memoized, so this kickoff and the PwaUpdateToast
// effect below share one fetch — it never blocks first paint and never
// rejects. The effect awaits the shared promise before reading the flag,
// so a remote kill decision wins the boot-time race deterministically.
void loadFlags();

/**
 * Non-blocking "update available" toast. Appears only after the player has
 * been offered the update — tapping it activates the waiting service worker
 * and reloads once. Dismissing leaves the current game untouched; the update
 * applies on the next fresh load.
 */
function PwaUpdateToast() {
  const [handle, setHandle] = useState<PwaUpdateHandle | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    let current: PwaUpdateHandle | null = null;
    // Kill-switch: await the shared flags load BEFORE reading the flag, so
    // a remote off wins the boot-time race deterministically (a synchronous
    // read here would always see the baked-in default while the fetch is in
    // flight). The ~1.5s timeout bounds the delay; first paint is
    // unaffected — the effect runs post-commit and only SW registration
    // defers on a hanging network.
    loadFlags().then(() => {
      if (!active) return;
      if (!isEnabled("pwaUpdateToast")) {
        // Make the kill-switch real: unregister any live registration so
        // the app actually becomes SW-free. No reload — the current page
        // keeps its controller until the next navigation (no-forced-reload
        // policy); subsequent boots have no service worker at all.
        void unregisterServiceWorker();
        return;
      }
      registerServiceWorker().then((result) => {
        if (!active) {
          result?.handle.dispose();
          return;
        }
        if (result) {
          current = result.handle;
          setHandle(result.handle);
        }
      });
    });
    return () => {
      active = false;
      current?.dispose();
    };
  }, []);

  if (!handle || dismissed) return null;
  const dismiss = () => {
    setDismissed(true);
    // The toast unmounts, which would drop a keyboard user's focus to
    // <body>. Hand focus to the main landmark instead (no-op if absent).
    requestAnimationFrame(() => {
      const main = document.querySelector("main");
      if (main instanceof HTMLElement) {
        if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
        main.focus({ preventScroll: true });
      }
    });
  };
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-fg shadow-lg">
      <p role="status">A new version is ready to install.</p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="rounded-full px-3 py-1.5 text-sm text-muted hover:text-fg"
          onClick={dismiss}
        >
          Later
        </button>
        <button
          type="button"
          className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg"
          onClick={() => handle.applyUpdate()}
        >
          Update now
        </button>
      </div>
    </div>
  );
}

/**
 * Analytics tags, fail-closed on missing build env.
 *
 * Veeresh 2026-10-07: no hardcoded key details in source. IDs come from
 * build-time env (GitHub Secrets → Actions → VITE_*). When an ID is
 * unset/empty, its tag does not render at all — no broken script tags.
 * Local dev builds fine without any of these set.
 */
function AnalyticsTags() {
  const ga4Id = import.meta.env.VITE_GA4_MEASUREMENT_ID?.trim() || undefined;
  const clarityId = import.meta.env.VITE_CLARITY_PROJECT_ID?.trim() || undefined;
  return (
    <>
      {ga4Id ? (
        <>
          {/* Google Analytics 4 — COPPA-safe: IP anonymized, no ad personalization, no Google signals */}
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} />
          <script
            dangerouslySetInnerHTML={{
              __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', ${JSON.stringify(ga4Id)}, {
                'anonymize_ip': true,
                'allow_google_signals': false,
                'allow_ad_personalization_signals': false
              });
            `,
            }}
          />
        </>
      ) : null}
      {clarityId ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", ${JSON.stringify(clarityId)});
            `,
          }}
        />
      ) : null}
    </>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: "Pin the place. The run lasts until the pin misses.",
      },
      { name: "theme-color", content: "#101211" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: `${import.meta.env.BASE_URL}favicon.svg` },
      { rel: "stylesheet", href: appCss },
      // Static PWA manifest (public/manifest.webmanifest). The dev-only
      // /__grok/manifest.webmanifest is middleware-served and 404s on the
      // static Pages build — never point at it here.
      { rel: "manifest", href: `${import.meta.env.BASE_URL}manifest.webmanifest` },
      { rel: "apple-touch-icon", href: `${import.meta.env.BASE_URL}icons/icon-192.png` },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <AnalyticsTags />
      </head>
      <body>
        <PreviewHostBridge />
        <PwaUpdateToast />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
