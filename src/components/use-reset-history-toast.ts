/**
 * Reset-history toast — a leaf state owner extracted from game-app.tsx
 * (game-app-map step 3, TD-06.5). Owns the "Start over" reset's success
 * toast and the historyResetEpoch refresh pin (D14): showing the toast
 * bumps the epoch, which remounts <Choose> (re-reading the mount-only
 * home surfaces) and re-runs useDeckStatus in place. The toast reuses
 * the age-toast lifetime: it auto-dismisses after 3500 ms.
 */
import { useCallback, useEffect, useState } from "react";

/** The reset success toast (manifest 2026-10-28 §4, locked). */
export const RESET_HISTORY_SUCCESS_TOAST = "All cleared. You are starting fresh.";

export function useResetHistoryToast(): {
  resetToast: string | null;
  historyResetEpoch: number;
  showResetSuccess: () => void;
} {
  const [resetToast, setResetToast] = useState<string | null>(null);
  const [historyResetEpoch, setHistoryResetEpoch] = useState(0);
  useEffect(() => {
    if (resetToast === null) return;
    const id = window.setTimeout(() => setResetToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [resetToast]);
  const showResetSuccess = useCallback(() => {
    setHistoryResetEpoch((n) => n + 1);
    setResetToast(RESET_HISTORY_SUCCESS_TOAST);
  }, []);
  return { resetToast, historyResetEpoch, showResetSuccess };
}
