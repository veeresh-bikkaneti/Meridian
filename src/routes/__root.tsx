import { BRAND } from "@/game/brand";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { registerServiceWorker, type PwaUpdateHandle } from "@/lib/pwa";
import { useEffect, useState } from "react";
import appCss from "../styles.css?url";

const APP_NAME = BRAND.name;

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
      <p role="status">A new version of Meridian is available.</p>
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
