/**
 * #330 cure round (PR #331 panel) — Scout trial upgrade lifecycle pins.
 *
 * Two wiring bugs the panel found in the unknown-memory trial:
 *
 * 1. The stale Scout note. A trial boot shows the one-time auto-Scout
 *    note on Home ("picked for this device"). When the in-session
 *    upgrade later switches the session to the full map, that note
 *    must retire — the session is no longer on Scout. The manual and
 *    home toggle paths already retire it; the upgrade path must too.
 *
 * 2. The manual-choice override. A pending trial upgrade must never
 *    override an explicit manual Scout choice made after boot. Both
 *    manual handlers therefore clear the trial's upgrade eligibility,
 *    and Play's upgrade handler re-checks that no stored manual
 *    record stands before it fires.
 *
 * 3. The flag gate (PR #331 panel re-vote cure). The trial's
 *    kill-switch is the `scoutUpgradeTrial` flag: GameApp's boot
 *    effect must await the shared flags load and set eligibility only
 *    when the flag is on — that gated call is the only arming site in
 *    the file — and a manual record landing during the load must
 *    block the arming, mirroring the fire-time guard in (2).
 *
 * This is React state wiring inside GameApp/Play that needs a browser
 * to render end-to-end, so — in the repo's established source-pin
 * style (cf. map-switched-notice-lifecycle.test.ts) — this file pins
 * the wiring at the source seam.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const gameAppSource = readFileSync(join(here, "game-app.tsx"), "utf8");

/** The source between two markers (both must exist). */
function segment(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  assert.ok(start >= 0, `segment start missing: ${from}`);
  const end = src.indexOf(to, start + from.length);
  assert.ok(end >= 0, `segment end missing: ${to}`);
  return src.slice(start, end);
}

describe("#330 cure: the upgrade retires the auto-Scout note", () => {
  it("applyScoutUpgrade clears autoScoutNote", () => {
    const upgrade = segment(
      gameAppSource,
      "const applyScoutUpgrade = useCallback(",
      "// GeoDetective mounts its own screen",
    );
    assert.ok(
      upgrade.includes("setAutoScoutNote(false);"),
      "applyScoutUpgrade must retire the boot auto-Scout note — after the upgrade the session is on the full map, so a standing 'picked for this device' Scout note is stale",
    );
  });

  it("control: applyScoutUpgrade still clears eligibility and applies full", () => {
    const upgrade = segment(
      gameAppSource,
      "const applyScoutUpgrade = useCallback(",
      "// GeoDetective mounts its own screen",
    );
    assert.ok(
      upgrade.includes("setScoutUpgradeEligible(false);"),
      "control: the upgrade still fires at most once per boot",
    );
    assert.ok(
      upgrade.includes('applySessionMapMode("full");'),
      "control: the upgrade still applies the full map, session-only",
    );
  });
});

describe("#331 flag-gate cure: the trial arms only when scoutUpgradeTrial is on", () => {
  it("boot eligibility is set inside the flag-gated loadFlags callback", () => {
    const boot = segment(
      gameAppSource,
      'if (decision.source === "unknown-memory")',
      "setAutoScoutNote(true);",
    );
    const loadAt = boot.indexOf("loadFlags()");
    assert.ok(loadAt >= 0, "the arming must await the shared flags load (kill-switch ordering)");
    const flagAt = boot.indexOf('isEnabled("scoutUpgradeTrial")');
    assert.ok(flagAt > loadAt, "the flag check must run after the load resolves");
    const armAt = boot.indexOf("setScoutUpgradeEligible(true);");
    assert.ok(armAt > flagAt, "eligibility may only be set after the flag check passes");
  });

  it("the flag-gated call is the ONLY place eligibility is armed", () => {
    const arms = gameAppSource.split("setScoutUpgradeEligible(true);").length - 1;
    assert.equal(arms, 1, "exactly one arming site may exist, and it is the flag-gated one");
  });

  it("a manual record landing during the flags load blocks the arming", () => {
    const boot = segment(
      gameAppSource,
      'if (decision.source === "unknown-memory")',
      "setAutoScoutNote(true);",
    );
    const guardAt = boot.indexOf("readStoredMapMode()");
    const armAt = boot.indexOf("setScoutUpgradeEligible(true);");
    assert.ok(guardAt >= 0 && guardAt < armAt, "the manual re-check must run before arming");
    assert.ok(boot.includes('"manual"'), "the re-check must look for a manual record specifically");
  });
});

describe("#330 cure: a manual choice after trial boot disarms the upgrade", () => {
  it("handleManualMapMode clears scoutUpgradeEligible", () => {
    const manual = segment(
      gameAppSource,
      "const handleManualMapMode = useCallback(",
      "const handleHomeMapMode = useCallback(",
    );
    assert.ok(
      manual.includes("setScoutUpgradeEligible(false);"),
      "an explicit in-game manual choice must disarm a pending trial upgrade",
    );
  });

  it("handleHomeMapMode clears scoutUpgradeEligible", () => {
    const home = segment(
      gameAppSource,
      "const handleHomeMapMode = useCallback(",
      "// Block A: land focus on the home heading",
    );
    assert.ok(
      home.includes("setScoutUpgradeEligible(false);"),
      "an explicit home manual choice must disarm a pending trial upgrade",
    );
  });

  it("Play's handleScoutUpgrade re-checks for a stored manual record before firing", () => {
    const handler = segment(
      gameAppSource,
      "const handleScoutUpgrade = useCallback(",
      "// The switch viewport is consumed by the remount",
    );
    const guardAt = handler.indexOf("readStoredMapMode()");
    assert.ok(
      guardAt >= 0,
      "handleScoutUpgrade must re-read the stored map-mode record before firing",
    );
    assert.ok(
      handler.includes('"manual"'),
      "the re-check must look for a manual record specifically",
    );
    const fireAt = handler.indexOf("onScoutUpgrade();");
    assert.ok(fireAt >= 0, "control: the handler still fires the upgrade");
    assert.ok(
      guardAt < fireAt,
      "the manual-record re-check must run BEFORE the upgrade fires",
    );
  });
});
