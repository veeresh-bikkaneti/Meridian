/**
 * Chunk-reload notice — a leaf state owner extracted from game-app.tsx
 * (game-app-map step 3, TD-06.5). Owns the post-reload notice flag:
 * the boot path consumes the chunk-recovery notice once (at the point
 * readiness is signalled, so a page that stalls before ready keeps its
 * notice for the crash watchdog), and the notice's close button
 * dismisses it. There is deliberately no auto-dismiss timer.
 */
import { useCallback, useState } from "react";
import { consumeChunkReloadNotice } from "../lib/chunk-recovery.ts";

export function useChunkReloadNotice(): {
  chunkReloadNotice: boolean;
  consumeChunkReloadNoticeOnce: () => void;
  dismissChunkReloadNotice: () => void;
} {
  const [chunkReloadNotice, setChunkReloadNotice] = useState(false);
  const consumeChunkReloadNoticeOnce = useCallback(() => {
    if (consumeChunkReloadNotice()) setChunkReloadNotice(true);
  }, []);
  const dismissChunkReloadNotice = useCallback(
    () => setChunkReloadNotice(false),
    [],
  );
  return {
    chunkReloadNotice,
    consumeChunkReloadNoticeOnce,
    dismissChunkReloadNotice,
  };
}
