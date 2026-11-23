import {
  createElement,
  useEffect,
  useRef,
  type ComponentPropsWithRef,
  type ReactNode,
} from "react";

/**
 * BoundedText — the wrapping contract as a component (WRAPPING_SPEC §2).
 *
 * Every text element rendered through BoundedText gets the containment
 * guarantee by construction: it can never spill past its box. The parent
 * owns *where the box sits*; this component owns *text never leaves it*.
 *
 * Deliberately NO `nowrap`, `truncate`, `ellipsis`, or `whiteSpace`
 * escape hatches: opting into the component = opting into the guarantee.
 * If single-line is genuinely wanted (grade chip), don't use this
 * component. `className` is TYPOGRAPHY ONLY (font, size, color) —
 * containment props are refused (the lint-cards Tier 3 gate fails the
 * build on `whitespace-nowrap`/`truncate`/`whiteSpace`/`textOverflow`
 * at a BoundedText call site).
 *
 * The CSS lives in `bounded-text.css`, pulled into the bundle via
 * `@import` at the top of `src/styles.css` (not imported here) so this
 * module stays importable from the node --test unit suite, which cannot
 * resolve CSS imports.
 */

export type BoundedTextAs =
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "span"
  | "div"
  | "dd"
  | "dt"
  | "pre"
  | "a";

export type BoundedTextVariant =
  | "headline"
  | "place"
  | "body"
  | "url"
  | "banner";

export type BoundedTextWrap = "word" | "anywhere";

/** The ref type follows `as` (React 19 ref-as-prop — no forwardRef). */
export type BoundedTextProps<T extends BoundedTextAs = "p"> = {
  as?: T;
  /**
   * MANDATORY in spirit (no silent default in the spec's API table), but
   * the code defaults to "body" — the safest tier — so a missing variant
   * degrades to readable prose, never to an unstyled box.
   */
  variant?: BoundedTextVariant;
  /** "word" (default) | "anywhere" — anywhere for URLs / unspaced tokens. */
  wrap?: BoundedTextWrap;
  /** TYPOGRAPHY ONLY. Containment props are refused — see the header. */
  className?: string;
  children?: ReactNode;
  ref?: ComponentPropsWithRef<T>["ref"];
  /** data-* attributes pass straight through to the element. */
  [dataAttr: `data-${string}`]: unknown;
} & Omit<
  ComponentPropsWithRef<T>,
  "as" | "ref" | "className" | "children"
>;

export function BoundedText<T extends BoundedTextAs = "p">({
  as,
  variant = "body",
  wrap = "word",
  className,
  children,
  ref,
  ...rest
}: BoundedTextProps<T>) {
  const tag = (as ?? "p") as BoundedTextAs;
  const hostRef = useRef<HTMLElement | null>(null);

  const setRefs = (el: HTMLElement | null) => {
    hostRef.current = el;
    if (typeof ref === "function") {
      (ref as (el: HTMLElement | null) => void)(el);
    } else if (ref) {
      (ref as { current: HTMLElement | null }).current = el;
    }
  };

  // Dev-only overflow tripwire (spec §6a): the guarantee is pure CSS; this
  // converts the NEXT future flag into a console error plus a
  // data-overflow="true" marker the E2E suite asserts is absent. Never
  // ships to production (import.meta.env.DEV is false in the built
  // artifact), so it cannot flash, fight the clamp, or cost runtime.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const check = () => {
      const overflowing =
        el.scrollWidth > el.clientWidth + 1 ||
        el.scrollHeight > el.clientHeight + 1;
      if (overflowing) {
        // eslint-disable-next-line no-console
        console.error(
          `[BoundedText] text overflows its box (variant="${variant}", as="${tag}")`,
          el,
        );
        el.setAttribute("data-overflow", "true");
      } else {
        el.removeAttribute("data-overflow");
      }
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tag, variant]);

  return createElement(
    tag,
    {
      ...rest,
      ref: setRefs,
      "data-as": tag,
      "data-variant": variant,
      "data-wrap": wrap,
      className: className ? `bounded-text ${className}` : "bounded-text",
    },
    children,
  );
}
