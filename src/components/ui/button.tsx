import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/cn";

// The variant tables are plain maps on purpose: this component
// was the bundle's only class-variance-authority consumer, and
// the library's resolver cost more entry bytes than the three
// variants and three sizes it picked between. The maps resolve
// to the exact class strings the cva definition produced, in
// the same order (base, variant, size), so the merged class
// list every caller renders is unchanged.
const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-[transform,background-color,color,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none disabled:pointer-events-none disabled:opacity-40 min-h-11 active:scale-[0.98]";

const BUTTON_VARIANTS = {
  primary: "bg-fg text-bg hover:opacity-90",
  secondary: "bg-surface-2 text-fg border border-line hover:bg-surface",
  ghost: "bg-transparent text-fg hover:bg-surface-2",
} as const;

const BUTTON_SIZES = {
  md: "min-h-11 px-4",
  lg: "min-h-12 px-5 text-base",
  // The small pill from the Why Learn subject cards (the
  // per-card Reset): the face stays the approved mock's —
  // muted text on no fill, 26px tall — while the invisible
  // after: zone grows the tap target to 44px+ both ways
  // without moving or covering anything beside it.
  pill: "relative min-h-0 rounded-full bg-transparent px-2.5 py-1 text-xs font-normal text-muted after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  asChild?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

export function Button({ className, variant = "primary", size = "md", asChild, type = "button", ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      type={type}
      {...props}
    />
  );
}
