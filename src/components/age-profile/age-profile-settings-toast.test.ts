/**
 * AgeProfileSettings — the band-naming confirmation toasts
 * (owner ruling, 2026-11-04), pinned in the source-pinning style
 * of card-film.test.ts / locked-tile-film.test.ts.
 *
 * Why not a behavioural E2E for the IN-PROGRESS string
 * ("Saved — {band}; takes effect on the next card. ✅")? It is
 * genuinely unreachable through the app today: game-app renders
 * AgeProfileSettings only in its Home return branch, which is
 * reached only when `run === null && !loopOpen` — the run and
 * loop screens return earlier, without the settings flow — so
 * the `runInProgress` prop is never true at the only render
 * site, and no harness flow can open settings mid-run. What CAN
 * be pinned honestly is the construction itself: the exact
 * templates, the branch on runInProgress, and the band name
 * built from the real band table (composed below from getBand,
 * the same source the component uses). The not-in-progress
 * string is covered behaviourally by the E2E specs
 * (age-profile-gate + band-switch-in-session).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getBand } from "../../game/age-profile/bands.ts";
import type { AgeBandId } from "../../game/age-profile/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const settings = readFileSync(join(here, "AgeProfileSettings.tsx"), "utf8");

describe("AgeProfileSettings — confirm-change toast construction", () => {
  it("the band name is built from the band table via getBand, never hardcoded", () => {
    assert.ok(settings.includes("const band = getBand(confirmTarget);"), "band from getBand(confirmTarget)");
    assert.ok(
      settings.includes("const bandName = `${band.label} (ages ${band.ageMin}–${band.ageMax})`;"),
      "bandName = label + the AgePicker range format, both from the table entry",
    );
  });

  it("not in progress: `Saved — {bandName} ✅`", () => {
    assert.ok(
      settings.includes("onToast(`Saved — ${bandName} ✅`);"),
      "the not-in-progress template is exact",
    );
  });

  it("in progress: `Saved — {bandName}; takes effect on the next card. ✅`, chosen on runInProgress", () => {
    assert.ok(
      settings.includes("if (runInProgress) {"),
      "the in-progress branch is selected on the runInProgress prop",
    );
    assert.ok(
      settings.includes("onToast(`Saved — ${bandName}; takes effect on the next card. ✅`);"),
      "the in-progress template is exact — semicolon, 'takes effect on the next card.', ✅",
    );
  });

  it("the composed strings match the real band table, for every band", () => {
    // Compose exactly as the component does (same getBand source,
    // same templates pinned above) and check the full strings a
    // player would see — including the in-progress one no E2E can
    // reach (see the header note).
    const expected: Record<AgeBandId, { plain: string; inProgress: string }> = {
      "5-7": {
        plain: "Saved — Little Explorer (ages 5–7) ✅",
        inProgress: "Saved — Little Explorer (ages 5–7); takes effect on the next card. ✅",
      },
      "8-10": {
        plain: "Saved — Trail Scout (ages 8–10) ✅",
        inProgress: "Saved — Trail Scout (ages 8–10); takes effect on the next card. ✅",
      },
      "11-13": {
        plain: "Saved — GeoDetective (ages 11–13) ✅",
        inProgress: "Saved — GeoDetective (ages 11–13); takes effect on the next card. ✅",
      },
    };
    for (const id of Object.keys(expected) as AgeBandId[]) {
      const band = getBand(id);
      const bandName = `${band.label} (ages ${band.ageMin}–${band.ageMax})`;
      assert.equal(`Saved — ${bandName} ✅`, expected[id].plain, `${id} plain toast`);
      assert.equal(
        `Saved — ${bandName}; takes effect on the next card. ✅`,
        expected[id].inProgress,
        `${id} in-progress toast`,
      );
    }
  });

  it("the first-save and reset toasts stay byte-identical (out of the ruling's scope)", () => {
    assert.ok(settings.includes('onToast("Saved — enjoy the trail. 🌿");'), "first-save toast unchanged");
    assert.ok(
      settings.includes('onToast("Cleared — the full game is open again. 🗺️");'),
      "reset toast unchanged",
    );
  });
});
