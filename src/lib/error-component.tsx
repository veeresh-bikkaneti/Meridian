import { useEffect } from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { ErrorScreen } from "../components/ui/error-screen.tsx";
import { emitEvent, sanitizeError } from "./observability";
import {
  CHUNK_RELOAD_KEY,
  CHUNK_RELOAD_SURFACE_KEY,
  isChunkLoadError,
  shouldReportChunkFailure,
} from "./chunk-recovery";
import { readSessionItem } from "../platform/storage/browser-storage.ts";
import { STORAGE_KEYS } from "../platform/storage/keys.ts";

/**
 * The slice shouldReportChunkFailure reads. Values come from the
 * session port: a missing stamp is the port's 0 fallback, which
 * this adapter reports as absent so a first failure stays silent.
 */
function chunkReportStorage(): { getItem(key: string): string | null } {
  return {
    getItem(key: string): string | null {
      if (key === CHUNK_RELOAD_KEY) {
        const stamp = readSessionItem(STORAGE_KEYS.chunkReloadAt);
        return stamp === 0 ? null : String(stamp);
      }
      if (key === CHUNK_RELOAD_SURFACE_KEY) {
        const surface = readSessionItem(STORAGE_KEYS.chunkReloadSurface);
        return surface === "unknown" ? null : surface;
      }
      return null;
    },
  };
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  // Telemetry: route-level errors caught by the boundary never reach the
  // global error listener — emit once per distinct error.
  useEffect(() => {
    // F3: chunk-shaped route errors follow the shared discipline —
    // a first failure stays silent; only the post-reload repeat (or
    // unreadable storage) reports. Other route errors report as before.
    if (isChunkLoadError(error)) {
      let report = true;
      try {
        report = shouldReportChunkFailure(chunkReportStorage(), Date.now());
      } catch {
        report = true;
      }
      if (!report) return;
    }
    emitEvent({
      type: "js_error",
      ts: Date.now(),
      buildId: "",
      error: sanitizeError(error),
    });
  }, [error]);
  // TD-05.3: the router error page is the shared ErrorScreen, the
  // only error surface. Its pinned blameless copy replaces the raw
  // error message (no error text on screen; telemetry above keeps
  // it). F4 holds: Try again reloads, so the page is never
  // button-less. Home is a truthful exit here — this page is outside
  // any run, and a full load of "/" lands on Home.
  return (
    <ErrorScreen
      onRetry={() => window.location.reload()}
      onHome={() => window.location.assign("/")}
    />
  );
}
