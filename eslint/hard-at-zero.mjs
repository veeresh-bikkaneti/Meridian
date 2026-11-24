/**
 * One severity rule for every architecture gauge.
 *
 * A gauge whose baseline count is already 0 is an error, so CI fails.
 * Any count still above zero only warns, so CI does not fail. The same
 * function covers every gauge: when a baseline later reaches 0, that
 * gauge flips with no hand edit.
 */
export function hardAtZero(count) {
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
    throw new Error(`hardAtZero: expected a non-negative integer, got ${String(count)}`);
  }
  return count === 0 ? "error" : "warn";
}

/** Shell-ban is one gauge: the sum of every ban list, comment excluded. */
export function shellBanCount(baseline) {
  if (!baseline || typeof baseline !== "object") return 0;
  return Object.entries(baseline).reduce(
    (sum, [key, value]) => (key === "comment" || !Array.isArray(value) ? sum : sum + value.length),
    0,
  );
}

export function gaugeCountsFrom(layer, shell) {
  return {
    noRawIo: Array.isArray(layer?.noRawIo) ? layer.noRawIo.length : 0,
    noUpwardImport: Array.isArray(layer?.noUpwardImport) ? layer.noUpwardImport.length : 0,
    shellBan: shellBanCount(shell),
  };
}

/**
 * Rule id each gauge owns. shellBan is one gauge, so every shell ban
 * shares its severity. Adding a gauge means adding one entry here;
 * the severity still comes from hardAtZero, never a hand-set string.
 */
export const GAUGE_RULES = {
  noRawIo: ["platform/no-raw-io"],
  noUpwardImport: ["layer/no-upward-import"],
  shellBan: [
    "shell/no-home-button-import",
    "shell/no-page-local-header-footer",
    "shell/no-page-local-nav",
    "shell/no-page-local-main",
    "shell/no-max-w-none",
  ],
};
