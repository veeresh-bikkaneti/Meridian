import { useCallback, useState } from "react";
import { consumeChunkReloadNotice } from "../lib/chunk-recovery.ts";

/**
 * Post-reload notice (chunk-recovery): set once at boot when the
 * previous page's reload left a notice flag. Deliberately NO
 * auto-dismiss timer (unlike the age toast): a timed status can be
 * deleted before a screen reader reaches it. Close button only.
 */
export function useChunkReloadNotice(): {
  chunkReloadNotice: boolean;
  consumeAtReady: () => void;
  dismiss: () => void;
} {
  const [chunkReloadNotice, setChunkReloadNotice] = useState(false);
  // F7d: the post-reload notice is consumed at the point readiness is
  // signalled — not in a mount effect. A page that mounts then stalls
  // before ready must still hold its notice at the crash watchdog's 28 s
  // check, where a surviving fresh notice is the recovery evidence that
  // stands the watchdog's boot_failure report down.
  const consumeAtReady = useCallback(() => {
    if (consumeChunkReloadNotice()) setChunkReloadNotice(true);
  }, []);
  const dismiss = useCallback(() => setChunkReloadNotice(false), []);
  return { chunkReloadNotice, consumeAtReady, dismiss };
}
