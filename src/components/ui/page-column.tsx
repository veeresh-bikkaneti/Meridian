/**
 * PageColumn: the ONE centred column every page sits in (Stream S
 * contract, fix/ui-shared-shell, items 11 and 20). Two named widths,
 * both already shipped by ScreenShell / home: "wide" (max-w-7xl —
 * home, picker, board) and "read" (max-w-3xl — cases, text pages),
 * with prod's px-5 gutters.
 *
 * Width is `w-full`, never `100vw` (UX seat): 100vw includes the
 * scrollbar and re-creates item 11's 1280px horizontal scrollbar
 * inside the new component. No screen sets its own max-width or
 * lifts the cap — `max-w-none` on a screen root fails lint:nav.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PageColumnProps = {
  width?: "wide" | "read";
  className?: string;
  testId?: string;
  children?: ReactNode;
};

export function PageColumn({ width = "wide", className, testId, children }: PageColumnProps) {
  return (
    <div
      data-testid={testId}
      className={cn("mx-auto w-full px-5", width === "wide" ? "max-w-7xl" : "max-w-3xl", className)}
    >
      {children}
    </div>
  );
}
