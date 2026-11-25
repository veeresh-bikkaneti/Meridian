/**
 * ContentNav: the ONE owner of a content <nav> landmark (TD-05.3).
 * SiteHeader owns the site nav; a screen whose content carries its
 * own navigation (the grown-ups doors, the board's view switcher)
 * renders it through this component instead of a page-local <nav>,
 * so lint:nav keeps banning hand-built navs everywhere else.
 *
 * It is markup only: the host keeps its own class, label, items and
 * behaviour. Every content nav needs an accessible name, so `label`
 * is required (it becomes aria-label).
 */
import type { ReactNode, Ref } from "react";

export type ContentNavProps = {
  /** Accessible name of the landmark (aria-label). */
  label: string;
  className?: string;
  ref?: Ref<HTMLElement>;
  children?: ReactNode;
};

export function ContentNav({ label, className, ref, children }: ContentNavProps) {
  return (
    <nav className={className} aria-label={label} ref={ref}>
      {children}
    </nav>
  );
}
