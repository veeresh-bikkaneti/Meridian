/**
 * Cartographer's Plate — grade chip (spec §7, Veeresh's ratified bands).
 *
 * The reveal verdict pairs the number with meaning. Space Mono 11px,
 * brass styling; the chip exposes `aria-label="Grade: <band text>"` so
 * the band is announced with the verdict (e.g. "Result: 2,073 km away.
 * Grade: Bullseye.").
 *
 * The chip never compacts: fixed 11px floor, nowrap, same padding at
 * every name tier (Walkthrough: signals never flex).
 */
export function GradeChip({
  emoji,
  bandName,
  className = "",
}: {
  emoji: string;
  /** Band text — visible AND in the aria-label, never emoji-only. */
  bandName: string;
  className?: string;
}): React.JSX.Element {
  return (
    <span className={`grade-chip ${className}`} aria-label={`Grade: ${bandName}`}>
      <span aria-hidden="true">{emoji}</span> {bandName}
    </span>
  );
}
