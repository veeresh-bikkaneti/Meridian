import { useCallback, useEffect, useState } from "react";

/** The reset success toast (manifest 2026-10-28 §4, locked). */
export const RESET_HISTORY_SUCCESS_TOAST = "All cleared. You are starting fresh.";

/**
 * "Start over" reset (manifest 2026-10-28): the success toast reuses
 * the age-toast styling/lifetime, and historyResetEpoch is the
 * refresh pin (D14) — bumping it remounts the home surfaces (re-reading
 * the mount-only home state) and re-runs useDeckStatus in place.
 */
export function useHistoryResetToast(): {
  resetToast: string | null;
  historyResetEpoch: number;
  notifyHistoryReset: () => void;
} {
  const [resetToast, setResetToast] = useState<string | null>(null);
  const [historyResetEpoch, setHistoryResetEpoch] = useState(0);
  useEffect(() => {
    if (resetToast === null) return;
    const id = window.setTimeout(() => setResetToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [resetToast]);
  const notifyHistoryReset = useCallback(() => {
    setHistoryResetEpoch((n) => n + 1);
    setResetToast(RESET_HISTORY_SUCCESS_TOAST);
  }, []);
  return { resetToast, historyResetEpoch, notifyHistoryReset };
}
