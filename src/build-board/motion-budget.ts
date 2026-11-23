/**
 * The build board's motion budget — a mirror of the small
 * registry in src/board/card-animations.tsx (which this area
 * may not import: lint:arch fires on a feature-to-feature
 * import). Same shape, same numbers: a shared registry of the
 * elements in motion, a budget of at most 1 moving card on
 * phones (<= 760 px) / 2 on desktop, first registrants win, and
 * everything past the budget simply rests at its end pose —
 * the same still that Calm mode and prefers-reduced-motion
 * show. Here the registry gates the one-shot FLIP slides the
 * live overlay triggers when a story changes column; the
 * board's registry gates its looping scene windows.
 */

const registry = new Set<HTMLElement>();

export function motionBudget(): number {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches
    ? 1
    : 2;
}

/**
 * Register `el` as wanting to move. Returns true when it is
 * within budget (it stays registered until endMotion); false
 * when the budget is already spent — the caller then leaves
 * the element at its end pose, unanimated.
 */
export function beginMotion(el: HTMLElement): boolean {
  if (registry.has(el)) return true;
  if (registry.size >= motionBudget()) return false;
  registry.add(el);
  return true;
}

/** Release an element's motion slot (animation finished or cancelled). */
export function endMotion(el: HTMLElement): void {
  registry.delete(el);
}

/** Motion is off entirely under Calm mode or the OS reduced-motion setting. */
export function motionSettled(calm: boolean): boolean {
  if (calm) return true;
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
