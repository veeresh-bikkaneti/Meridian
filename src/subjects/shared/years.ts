/**
 * Year-gap answers, shared by every subject.
 *
 * A year-based answer is resolved from the device's current year at
 * play time — never typed into content (owner rule). Kept pure (the
 * year is a parameter) so tests can pin the clock.
 */

/** How many years have passed since `eventYear`, counted in `currentYear`. */
export function yearsSince(eventYear: number, currentYear: number): number {
  return currentYear - eventYear;
}

/** The device's current year, read at play time. */
export function currentYear(now: Date = new Date()): number {
  return now.getFullYear();
}
