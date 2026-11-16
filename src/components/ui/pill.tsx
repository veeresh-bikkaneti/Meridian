/**
 * Pill: the ONE count readout (Stream S contract, fix/ui-shared-shell,
 * items 14 and 32). Every deck pill and case-count badge in the app
 * reads the same way: "{n} cases" (singular "1 case"), set at 14px on
 * the pre-measured AA token pair (--atlas-brass-text-sm on
 * --atlas-card, 7.08:1 on light) — never the tiny low-contrast mono
 * chip item 14 bans.
 *
 * A Pill is a readout, not a control (UX seat): no hover or active
 * state, no pointer cursor, so this band does not tap a pill-shaped
 * thing that does nothing. A host that needs a tappable count uses
 * Button and keeps the same text format.
 *
 * Counts come from one source per screen (Stream G wires the deck
 * counts), so a subset count can never exceed its total.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PillProps = {
  /** Renders "{count} cases" / "1 case" when children are absent. */
  count?: number;
  children?: ReactNode;
  className?: string;
};

export function Pill({ count, children, className }: PillProps) {
  const text = children ?? (count === undefined ? null : `${count} ${count === 1 ? "case" : "cases"}`);
  return <span className={cn("site-pill", className)}>{text}</span>;
}
