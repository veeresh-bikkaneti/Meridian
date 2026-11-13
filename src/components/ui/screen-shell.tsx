/**
 * ScreenShell: the shared full-screen frame for in-app screens that are
 * not a game board (nav-home council, 2026-11-13). It applies the
 * `.mode-screen` atlas look (gradient + Fraunces/Karla, styles.css) that
 * GeoDetective and Cold Trail already use, puts the one HomeButton
 * top-left (first in the header row, an optional sound toggle beside it)
 * and the Cold Trail header pattern under it: eyebrow → title → sub.
 *
 * Screens that adopted it: the Why Learn picker and the subject case,
 * the Country / State lists. Text stays `text-fg` on the theme's own
 * background so ink and page always come from the same theme.
 */
import type { ReactNode, Ref } from "react";
import { Button } from "./button";
import { HomeButton } from "./home-button";
import { cn } from "@/lib/cn";

export function ScreenShell({
  onHome,
  onBack,
  sound,
  eyebrow,
  title,
  titleRef,
  sub,
  children,
  className,
  testId,
  data,
}: (
  | { onHome: () => void; onBack?: never }
  /** A one-step back inside a drill-down (not home): labelled "Back". */
  | { onBack: () => void; onHome?: never }
) & {
  /** A SoundToggle, only when the screen plays sound. */
  sound?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  titleRef?: Ref<HTMLHeadingElement>;
  sub?: ReactNode;
  children?: ReactNode;
  className?: string;
  testId?: string;
  /** Extra data-* attributes for the <main> (e.g. { "data-band": "7-10" }). */
  data?: Record<`data-${string}`, string>;
}) {
  return (
    <main
      className={cn("mode-screen mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8", className)}
      data-testid={testId}
      {...data}
    >
      <header>
        <div className="flex items-center gap-2">
          {onHome ? (
            <HomeButton onHome={onHome} className="-ml-3" />
          ) : (
            <Button variant="ghost" className="-ml-3 px-3" onClick={onBack} data-testid="back-button">
              Back
            </Button>
          )}
          {sound}
        </div>
        {eyebrow ? <p className="name-eyebrow mt-4">{eyebrow}</p> : null}
        <h1 ref={titleRef} tabIndex={-1} className={cn("mode-title text-3xl text-fg", eyebrow ? "mt-1" : "mt-4")}>
          {title}
        </h1>
        {sub ? <p className="mt-2 text-fg">{sub}</p> : null}
      </header>
      {children}
    </main>
  );
}
