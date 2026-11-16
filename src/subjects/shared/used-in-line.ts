/**
 * The result band's "used in" line (item 15, Stream W). The raw
 * useElsewhere values are catalogue phrases — most are
 * "<area>: <example>" ("economics: counting out change in coins
 * by 5s and 10s"), some are whole sentences ("Everyday reasoning
 * about places and time."), a few are bare phrases. Slotted after
 * "You just used this in…" they read like a placeholder, so the
 * line is composed per shape instead:
 * - "<area>: <example>" → the example, framed as real life;
 * - a full sentence → it stands as its own sentence;
 * - a bare phrase → it completes "You just used this in …";
 * - nothing authored → a plain everyday-life sentence.
 * Every shape ends in exactly one full stop.
 */
export function usedInLine(useElsewhere: readonly string[]): string {
  const raw = useElsewhere[0]?.trim() ?? "";
  if (!raw) {
    return "You just used this in everyday life — the same thinking solves real problems every day.";
  }
  const colon = raw.indexOf(": ");
  if (colon > 0) {
    const example = raw.slice(colon + 2).replace(/\.+$/, "");
    return `You just used this in real life: ${example}.`;
  }
  if (raw.endsWith(".")) {
    return `You just used this. ${raw}`;
  }
  return `You just used this in ${raw.replace(/\.+$/, "")}.`;
}
