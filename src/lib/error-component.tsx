import { useEffect } from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { emitEvent, sanitizeError } from "./observability";
import { isChunkLoadError, shouldReportChunkFailure } from "./chunk-recovery";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
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
        report = shouldReportChunkFailure(window.sessionStorage, Date.now());
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
  return (
    <main
      className={
        "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center " +
        "bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
      }
    >
      <span className="text-red-500" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400">
        {errorMessage(error)}
      </p>
      {/* F4: a router-level error page is never button-less. */}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-semibold text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        Try again
      </button>
    </main>
  );
}
