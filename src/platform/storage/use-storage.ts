/**
 * One saved value, live, for one screen.
 *
 * The hook reads the value once, then subscribes to its key:
 * whenever the port announces a change — this tab's write,
 * another tab's write, a removal — the screen re-reads and
 * re-renders with the fresh value.
 *
 * Building the hook touches no storage and no window, so it is
 * safe on the server and during render: the first read simply
 * falls back where storage is absent. Only the subscription,
 * inside the effect, can attach the cross-tab listener.
 */

import { useEffect, useState } from "react";

import { getStorageItem, subscribeStorage } from "./browser-storage.ts";
import type { StorageKeyDef } from "./storage.ts";

/** The current value of one registered key, kept up to date. */
export function useStorageValue<T>(def: StorageKeyDef<T>): T {
  const [value, setValue] = useState<T>(() => getStorageItem(def));

  useEffect(() => {
    // Re-read on mount: the render above may have run where
    // storage was absent, or the value may have moved since.
    setValue(getStorageItem(def));
    return subscribeStorage(def.key, () => {
      setValue(getStorageItem(def));
    });
  }, [def]);

  return value;
}
