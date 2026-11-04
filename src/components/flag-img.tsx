/**
 * FlagImg — the one way a flag reaches the screen (Capitals & Flags).
 *
 * The design's one rule: a flag renders ONLY beside its land's name,
 * which is already on screen in text at every call site (a briefing's
 * given name, the Giveaway rung, a witness's region line, a reveal's
 * pairing sentence). The flag is never a hunt target and never stands
 * alone. A flagless land (no licence-verified flag) renders nothing.
 *
 * The image lazy-loads through the flag registry; until it arrives —
 * and on any load failure — the layout simply has no flag, so text is
 * never blocked on artwork. Alt text is the registry's kid-safe visual
 * description of the flag, never just the land's name.
 */
import { useEffect, useState } from "react";

import { flagEntry, loadFlagUrl } from "@/lib/flag-registry";

export function FlagImg({
  flagKey,
  className = "h-5",
}: {
  flagKey: string | undefined;
  className?: string;
}) {
  const entry = flagEntry(flagKey);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!entry || !flagKey) return;
    let live = true;
    loadFlagUrl(flagKey)
      .then((loaded) => {
        if (live) setUrl(loaded);
      })
      .catch(() => {
        // A failed flag load is invisible by design: no broken-image
        // box, no layout shift beyond the flag's own slot.
      });
    return () => {
      live = false;
    };
  }, [entry, flagKey]);

  if (!entry || !url) return null;
  return (
    <img
      src={url}
      alt={entry.altText}
      data-testid="flag-img"
      data-flag-key={flagKey}
      className={`inline-block w-auto shrink-0 rounded-[3px] shadow-sm ring-1 ring-black/15 ${className}`}
      loading="lazy"
    />
  );
}
