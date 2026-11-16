/**
 * ScreenShell: the shared full-screen frame for in-app screens that are
 * not a game board (nav-home council, 2026-11-13). It applies the
 * `.mode-screen` atlas look (gradient + Fraunces/Karla, styles.css) that
 * GeoDetective and Cold Trail already use, puts the brand home control
 * top-left (first in the header row, then any screen controls, then an
 * optional sound toggle beside them — the GeoDetective header cluster)
 * and the Cold Trail header pattern under it: eyebrow → title → sub.
 *
 * Header home rule (Radhae, 2026-11-16, fix/header-logo-home): the
 * header's home affordance is BrandHomeButton — the homepage's
 * compass + MERIDIAN lockup on the left, clicking it goes home —
 * matching the homepage header, which has no "Home" pill. HomeButton
 * itself is unchanged and still serves its other surfaces
 * (end-of-flow, HUD, menu, board route, home-button-end).
 *
 * Screens that adopted it: the Why Learn picker and the subject case,
 * the Country / State lists. Text stays `text-fg` on the theme's own
 * background so ink and page always come from the same theme.
 */
import type { ReactNode, Ref } from "react";
import { Button } from "./button";
import { BrandHomeButton } from "./home-button";
import { cn } from "@/lib/cn";

export function ScreenShell({
  onHome,
  onBack,
  controls,
  sound,
  hero,
  heroExtra,
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
  /** Header controls beside the brand home control (e.g. a screen's
   * End game button — the GeoDetective header cluster order: brand,
   * controls, sound). Absent on screens that carry no controls. */
  controls?: ReactNode;
  /** Trailing header item: a SoundToggle. */
  sound?: ReactNode;
  /** Optional decorative picture above the titles; the titles then sit on
   *  an opaque band under it (never text over picture pixels). */
  hero?: ReactNode;
  /** Optional content rendered inside the hero card's titles band,
   *  under the titles (fix/why-learn-picker-wide-layout: the Why Learn
   *  picker hosts its age-band control there, beside the montage
   *  film). Only rendered when a hero is present; screens that pass
   *  no heroExtra render exactly as before. */
  heroExtra?: ReactNode;
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
  const titles = (top: string) => (
    <>
      {eyebrow ? <p className={cn("name-eyebrow", top)}>{eyebrow}</p> : null}
      <h1 ref={titleRef} tabIndex={-1} className={cn("mode-title text-3xl text-fg", eyebrow ? "mt-1" : top)}>
        {title}
      </h1>
      {sub ? <p className="mt-2 text-fg">{sub}</p> : null}
    </>
  );
  return (
    <main
      className={cn("mode-screen mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8", className)}
      data-testid={testId}
      {...data}
    >
      <header>
        <div className="screen-home-bar -mx-5 flex flex-wrap items-center gap-2 px-5 py-2">
          {onHome ? (
            <BrandHomeButton onHome={onHome} className="-ml-3" />
          ) : (
            <Button variant="ghost" className="-ml-3 px-3" onClick={onBack} data-testid="back-button">
              Back
            </Button>
          )}
          {controls}
          {sound}
        </div>
        {hero ? (
          <div className="screen-hero mode-card mt-4 overflow-hidden">
            {hero}
            <div className="screen-hero-band px-5 pt-1 pb-5">
              {titles("mt-4")}
              {heroExtra}
            </div>
          </div>
        ) : (
          titles("mt-4")
        )}
      </header>
      {children}
    </main>
  );
}
