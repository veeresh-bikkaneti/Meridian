import { useEffect, useState } from "react";

/**
 * Shared online/offline signal (Designer rec 2a: the app previously had no
 * navigator.onLine signal or online/offline listeners at all).
 *
 * SSR-safe: without `navigator` it reads as online (fail-open — a missing
 * API must never paint an offline notice). Subscribes to the window
 * online/offline events so a mid-session connectivity flip re-renders.
 *
 * Catch-time trigger code should still read `navigator.onLine` directly
 * (or via a ref mirror) rather than the render-closure value, so the
 * offline variant reflects connectivity at the moment the fetch failed.
 */

function readOnline(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.onLine !== "boolean") {
    return true;
  }
  return navigator.onLine;
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(readOnline);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Re-read here: connectivity may have flipped between render and effect.
    setOnline(readOnline());
    const update = (): void => setOnline(readOnline());
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
