/**
 * PageColumn: the ONE centred column every page sits in (Stream S
 * contract, fix/ui-shared-shell, items 11 and 20). Two named widths,
 * both token values (--page-narrow / --page-wide in styles.css, the
 * shipped max-w-3xl / max-w-7xl sizes): "narrow" (cases, text pages)
 * and "wide" (home, picker, board), with prod's px-5 gutters. The
 * width was named "read" until PR 3 Step 2 aligned it with the
 * PageShell vocabulary (narrow | wide).
 *
 * Width is `w-full`, never `100vw` (UX seat): 100vw includes the
 * scrollbar and re-creates item 11's 1280px horizontal scrollbar
 * inside the new component. No screen sets its own max-width or
 * lifts the cap — `max-w-none` on a screen root fails lint:nav.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PageColumnProps = {
  width?: "narrow" | "wide";
  className?: string;
  testId?: string;
  children?: ReactNode;
};

export function PageColumn({ width = "wide", className, testId, children }: PageColumnProps) {
  return (
    <div
      data-testid={testId}
      className={cn("mx-auto w-full px-5", width === "wide" ? "max-w-(--page-wide)" : "max-w-(--page-narrow)", className)}
    >
      {children}
    </div>
  );
}
