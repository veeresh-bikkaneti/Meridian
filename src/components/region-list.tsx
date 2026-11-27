/**
 * RegionList + StartingView (TD-06.13, steps 16–17): the region
 * drill-down lists and the region-open loader, extracted from
 * game-app.tsx as pure moves.
 *
 * Both are fragments, not <main> elements: the composer (game-app)
 * renders the <main> wrapper at each call site, so this file adds
 * no pageLocalMain row. `openRun` stays in use-run-controller.ts.
 */
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/ui/site-header";
import { type Region } from "@/game/regions";

export type RegionListProps = {
  title: string;
  subtitle?: string;
  regions: Region[];
  headerAction?: { label: string; onClick: () => void };
  notice?: ReactNode;
  /** "home": the top list (its button is Home); "back": one step up a drill-down (Back). */
  kind: "home" | "back";
  onBack: () => void;
  /** The drill-down lists' way straight home (the top menu). The
   *  shared header carries the one Home control on every screen —
   *  the legacy ScreenShell showed only Back here, so the "back"
   *  lists gain Home beside Back (the picker's Step 3.3 pattern:
   *  Home first, the step control in the back slot). */
  onHome?: () => void;
  onChoose: (region: Region) => void;
};

export function RegionList({
  title,
  subtitle,
  regions,
  headerAction,
  notice,
  kind,
  onBack,
  onHome,
  onChoose,
}: RegionListProps) {
  return (
    <>
      {/* The shared shell (PR 3 Step 3.6): SiteHeader carries the
          one Home control — the legacy ScreenShell's BrandHomeButton
          lockup goes. On a drill-down list the Back button rides
          the header's back slot with its old classes and testid.
          The titles are the screen's own content block, in the
          classes ScreenShell rendered. Top padding gives back the
          ~24px the shell header row adds (32 -> 8px, Step 3.3). */}
      {kind === "home" ? (
        <SiteHeader onHome={onBack} status={null} mute={null} />
      ) : (
        <SiteHeader
          onHome={onHome ?? onBack}
          status={null}
          mute={null}
          back={
            <Button variant="ghost" className="-ml-3 px-3" onClick={onBack} data-testid="back-button">
              Back
            </Button>
          }
        />
      )}
      <h1 tabIndex={-1} className="mode-title mt-4 text-3xl text-fg">
        {title}
      </h1>
      {subtitle ? <p className="mt-2 text-fg">{subtitle}</p> : null}
      {notice}
      {headerAction ? (
        <Button variant="secondary" className="mt-6 w-full" onClick={headerAction.onClick}>
          {headerAction.label}
        </Button>
      ) : null}
      <ul className="mt-6 flex flex-col gap-2">
        {regions.map((region) => (
          <li key={region.id}>
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => onChoose(region)}
            >
              {region.name}
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}

export type StartingViewProps = {
  regionName: string;
};

/**
 * StartingView (TD-06.13, step 17): the region-open loader — the
 * region's places are being fetched. The menu is replaced (no
 * double-taps) until the load resolves or fails closed.
 */
export function StartingView({ regionName }: StartingViewProps) {
  return (
    <>
      <p className="text-sm tracking-wide text-muted uppercase">Loading places</p>
      <h1 className="mt-2 font-display text-4xl text-fg">{regionName}</h1>
      <p className="mt-4 max-w-md text-lg text-muted" role="status">
        Fetching this region&rsquo;s places&hellip;
      </p>
    </>
  );
}
