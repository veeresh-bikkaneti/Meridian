/**
 * Badge: the ONE status badge (Stream S contract, fix/ui-shared-shell,
 * items 14 and 40). One vocabulary everywhere: "New" for unplayed,
 * "Done" for finished — "Open" is retired. Both variants are set at
 * 14px (the item-14 floor) on token pairs whose contrast is proven by
 * the ratio test in shared-shell.test.ts, computed from the actual
 * token values in styles.css: New = --atlas-brass-text-sm on
 * --atlas-card; Done = --fg on --surface-2. Both hold AA (≥4.5:1) on
 * the light and dark themes, and neither pair uses a --map-* token,
 * so the high-contrast palette cannot move them.
 *
 * Static by design: no hover, no focus, no motion.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeProps = {
  variant: "new" | "done";
  /** Defaults to the variant's word ("New" / "Done"). */
  children?: ReactNode;
  className?: string;
};

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span className={cn("site-badge", variant === "new" ? "site-badge--new" : "site-badge--done", className)}>
      {children ?? (variant === "new" ? "New" : "Done")}
    </span>
  );
}
