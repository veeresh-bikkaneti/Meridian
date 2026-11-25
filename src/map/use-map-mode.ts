import { useCallback, useState } from "react";
import {
  planBootMapMode,
  probeWebGL,
  qualifyMapMode,
  readDeviceMemoryGB,
  readStoredMapMode,
  writeStoredMapMode,
  type MapModeSource,
} from "./capability.ts";
import { isCoarsePointer } from "@/lib/map-options";
import { isEnabled, loadFlags } from "@/lib/flags";
import { setReportMapMode, wasMapAttributedCrash } from "@/lib/observability";
import type { MapMode } from "@/lib/map-mode";

/**
 * Map-mode hook (game-app-map step 8): the Scout Map mode cluster
 * that used to live inline in GameApp — the mode state, its
 * notices and live-region announcement, the boot qualification,
 * and the apply paths (runtime, session-only, trial upgrade,
 * welcome-card commit). GameApp calls this hook and threads the
 * values down as props. The manual toggles stay in the shell:
 * handleManualMapMode force-homes the run and lands focus, and
 * handleHomeMapMode renders Home's copy — both drive this state
 * through the returned setters.
 */
export function useMapMode() {
  /**
   * Scout Map: the game map mode is owned HERE and threaded down as a
   * prop — satellite-map unmounts on the webglcontextlost teardown, so
   * the mode state can never live inside it. Full mode is the default;
   * every assignment persists through writeStoredMapMode (write policy
   * Q3: only on a new qualifying event or an explicit state change —
   * never rewritten per boot).
   */
  const [mapMode, setMapMode] = useState<MapMode>("full");
  /**
   * True once the boot map-mode qualification has run. The storyteller
   * greeting waits for this so narration never starts before the boot
   * mode is settled.
   */
  const [bootQualified, setBootQualified] = useState(false);
  /**
   * The manual-switch announcement ("Scout Map on — back home; your
   * next game uses Scout Map"). It lives HERE, not in the toggle:
   * flipping the switch unmounts Play — and the toggle with it — in
   * the same commit that lands the player home, so a live region
   * inside the toggle is destroyed before any screen reader can speak
   * its text (pipeline Block A). GameApp renders the region in every
   * screen branch (mapModeAnnouncer below), so the node survives the
   * Play → home switch and the text change is actually announced
   * (WCAG 4.1.3).
   */
  const [mapModeAnnouncement, setMapModeAnnouncement] = useState("");
  /**
   * The VISIBLE sibling of the announcement above (Block B cure): when
   * a manual switch lands the player home, a dismissible notice in
   * Home's notice slot (the idle note's pattern) records what happened
   * — mode switched, next game uses the new map, score kept. Holds the
   * mode that was switched TO; null = no notice. The announcement is
   * spoken once and gone; this stays until dismissed.
   */
  const [mapSwitchedNote, setMapSwitchedNote] = useState<MapMode | null>(null);
  /**
   * Block C cure: set once by the boot effect when a FRESH
   * qualification silently auto-switches this boot to Scout, so Home
   * can show the non-blocking "You're on Scout Map" note for that
   * boot. A stored-record boot does not set it (nothing new happened),
   * and a manual flip from the Home control clears it (the player has
   * taken over; the "picked for this device" note is stale).
   */
  const [autoScoutNote, setAutoScoutNote] = useState(false);
  /**
   * Issue #330: true only when this boot started in Scout SOLELY under
   * the unknown-memory trial (capability source "unknown-memory") AND
   * the `scoutUpgradeTrial` flag is on (the trial's kill-switch — the
   * boot effect awaits the flags load before setting this; flag off =
   * never set, so the upgrade never arms). The first Scout map mount
   * may then upgrade the session to full after its stability soak.
   * Session-only state: it is never persisted, and firing the upgrade
   * clears it, so a later runtime fallback to Scout (tile failure,
   * context loss) can never re-arm it.
   */
  const [scoutUpgradeEligible, setScoutUpgradeEligible] = useState(false);

  /**
   * The welcome card's STAGED map pick. Flipping the card's switch
   * only stages the choice here — nothing is written yet — because
   * declining the card must commit nothing (the card's contract, and
   * manifest C6: the bargain binds on Start). Start commits a staged
   * pick that differs from the resolved mode via
   * handleWelcomeMapMode; "Not now" just drops it.
   */
  const [welcomeMapPick, setWelcomeMapPick] = useState<MapMode | null>(null);
  /**
   * Apply a runtime auto-switch: persist (Q3) + stamp crash reports +
   * update state. The only caller is the webglcontextlost tripwire (the
   * map is already gone, so the new mode applies immediately with the
   * remount Play performs). Boot-time qualification and the manual
   * toggle have their own paths — neither queues: the boot switch
   * happens before any map exists, and a manual switch ends the game
   * (force-home, below), so there is never a pending mode waiting for
   * a later place.
   *
   * It also retires the visible switched notice (re-vote round 3,
   * BLOCK-B): that notice asserts a mode for "your next game", and
   * this switch falsifies it — the reconciliation lives in these
   * GameApp-owned paths so no switch can bypass it. The finer points
   * of the reconciliation (what does NOT retire or speak, and why)
   * are recorded on applySessionMapMode below.
   */
  const applyMapMode = useCallback((mode: MapMode, source: Extract<MapModeSource, "contextlost">) => {
    writeStoredMapMode(mode, source);
    setReportMapMode(mode);
    setMapMode(mode);
    setMapSwitchedNote(null);
  }, []);

  /**
   * Apply a runtime SESSION-ONLY switch (the tile-fallback path in
   * Play): update state without persisting — nothing is stored, and a
   * reload returns to the stored mode. GameApp owns this callback so
   * the notice lifecycle is reconciled in exactly one place: Play
   * receives THIS, never the raw setMapMode (re-vote round 3,
   * BLOCK-B — the raw setter let a mid-run tile failure flip the mode
   * to Scout while Home still showed the stale "You switched to the
   * full map" notice from an earlier manual flip, the two
   * contradicting each other under an indicator reading Scout).
   *
   * The reconciliation, and its deliberate limits:
   * - The switched notice RETIRES (here and in applyMapMode): its
   *   text names the mode the next game uses, and this switch just
   *   changed that mode.
   * - The boot auto-switch note does NOT retire here. The tile-
   *   fallback path (the other runtime caller) fires only from full,
   *   and its switch lands on Scout, where the note's text would
   *   remain TRUE. The one path that DOES falsify the note is the
   *   #330 trial upgrade: a trial boot leaves the note standing in
   *   Scout, and the upgrade then moves the session to full — so
   *   applyScoutUpgrade retires the note itself before delegating
   *   here. (Manual flips clear it for a different reason: the
   *   player's own choice supersedes the "picked for this device"
   *   framing.)
   * - Nothing is ANNOUNCED: device-driven switches are silent (owner
   *   ruling, 2026-10-20), the announcer's texts are manual-switch
   *   wording ("back home; your next game…") that would be false
   *   mid-run, and Play already shows its own deferred switch note
   *   at the next natural break for exactly these events.
   */
  const applySessionMapMode = useCallback((mode: MapMode) => {
    setMapMode(mode);
    setMapSwitchedNote(null);
  }, []);
  /**
   * Issue #330: the unknown-memory trial's upgrade. Session-only, like
   * the tile fallback: no record is written, so if the upgraded full
   * map kills the process, the next boot meets the prior-crash signal
   * (session or durable marker) with no stored artifact in front of it
   * and stays in Scout with no further upgrade. Silent, per the
   * 2026-10-20 auto-switch ruling. Clears eligibility first so the
   * upgrade fires at most once per boot.
   */
  const applyScoutUpgrade = useCallback(() => {
    setScoutUpgradeEligible(false);
    setReportMapMode("full");
    // The trial boot left the auto-Scout note standing; this upgrade
    // falsifies it (the session is no longer on Scout), so retire it
    // here, mirroring the manual and home toggle paths.
    setAutoScoutNote(false);
    applySessionMapMode("full");
  }, [applySessionMapMode]);

  /**
   * Commit the challenge welcome card's staged map pick (owner
   * ruling, 2026-10-29): a received challenge's map is chosen WHEN
   * THE CHALLENGE OPENS — before Start builds the run's map — never
   * mid-challenge, where the only switch used to be the force-home
   * toggle that killed the challenge. The mode the card shows is the
   * one the boot already resolved (a stored manual record stands;
   * otherwise the capability qualification — the same signals, no
   * new probe). Flipping the card's switch only STAGES the pick;
   * this commit runs on Start (startPendingChallenge, below) and is
   * a manual choice exactly like the Home toggle's: write the manual
   * record (manual records never decay — the pick is the player's
   * saved map choice from then on, which the card's note says out
   * loud), apply at once, retire the boot auto-switch note. "Not
   * now" never reaches here, so declining commits nothing.
   * Declared before startPendingChallenge, which calls it.
   */
  const handleWelcomeMapMode = useCallback((mode: MapMode) => {
    writeStoredMapMode(mode, "manual");
    setReportMapMode(mode);
    setMapMode(mode);
    setAutoScoutNote(false);
    setMapSwitchedNote(null);
  }, []);

  /**
   * Run the boot qualification once: resolve the mode pre-mount
   * and settle bootQualified. Called from GameApp's boot effect,
   * at the point the inline block used to run.
   */
  const qualifyBootMapMode = useCallback(() => {
  // Scout Map boot qualification: resolve the mode pre-mount — before
  // any map instance exists.
  // Write policy (Q3): a live stored assignment (manual forever, auto
  // inside its decay window, a legacy accepted answer forever) stands
  // WITHOUT a rewrite — rewriting per boot would refresh setAt and
  // silently defeat decay.
  // A fresh scout decision (prior-crash / probe / low-memory) applies
  // SILENTLY (owner ruling, 2026-10-20: "Auto-switch silently on weak
  // devices (my decision stands)"): the session starts in Scout and
  // the decision is persisted as an AUTO record — qualifying source
  // kept, never manual, never accepted — so the 7-day decay
  // re-qualifies the device on later boots, and a device that later
  // probes clean returns to full. (This replaced the boot choice
  // dialog; see planBootMapMode's docstring for the superseded
  // directive.)
  // Issue #330 exception: an "unknown-memory" decision (Safari reports
  // no deviceMemory; coarse pointer) is a trial, not a verdict — it
  // persists NOTHING and instead arms the in-session Scout → full
  // upgrade (applyScoutUpgrade), so no stored artifact can ever stand
  // in front of a later prior-crash check. The arming itself is gated
  // by the `scoutUpgradeTrial` flag (see the unknown-memory branch
  // below): flag off, the boot still starts in Scout and the upgrade
  // simply never arms.
  // There is deliberately NO test bypass here (issue #154 item 1):
  // the E2E harness used to set a window flag to suppress this
  // auto-switch on its SwiftShader VM, which reads as a weak device.
  // That flag shipped in production, where any page script could set
  // it. The harness now spoofs the device signals themselves
  // (tests/e2e/helpers.ts), so this boot path is the only one that
  // exists — in production and in tests alike.
  try {
    const stored = readStoredMapMode();
    if (stored) {
      setReportMapMode(stored.mode);
      setMapMode(stored.mode);
    } else {
      const decision = qualifyMapMode({
        priorMapCrash: wasMapAttributedCrash(),
        webglProbeOk: probeWebGL(),
        deviceMemoryGB: readDeviceMemoryGB(),
        coarsePointer: isCoarsePointer(),
      });
      const plan = planBootMapMode(decision);
      if (plan.mode === "scout") {
        if (plan.persistSource !== null) {
          writeStoredMapMode("scout", plan.persistSource);
        }
        if (decision.source === "unknown-memory") {
          // Issue #330 trial: nothing was persisted above (the plan's
          // persistSource is null for this source) — arm the in-session
          // upgrade the first Scout map may fire after its soak.
          // Flag gate (PR #331 panel cure — the trial's kill-switch):
          // eligibility is set only when the `scoutUpgradeTrial` flag
          // is on. Kill-switches await the shared flags load before
          // checking (src/lib/flags.ts), so a remote `false` in
          // flags.json wins the boot-time race deterministically and
          // the upgrade never arms; the baked-in default is true, so
          // an unreachable flags.json keeps the shipped behavior.
          // The manual re-check mirrors Play's fire-time guard: a
          // manual choice that landed while the load was in flight
          // stands over the trial and must not be re-armed over.
          void loadFlags().then(() => {
            if (!isEnabled("scoutUpgradeTrial")) return;
            if (readStoredMapMode()?.source === "manual") return;
            setScoutUpgradeEligible(true);
          });
        }
        setReportMapMode("scout");
        setMapMode("scout");
        // Block C: silent is not invisible — flag the one-time
        // non-blocking home note for this boot's auto-switch.
        setAutoScoutNote(true);
      } else {
        setReportMapMode("full");
      }
    }
  } catch {
    // Qualification never blocks boot — full mode is the default.
  }
  // Boot qualification has settled — the storyteller greeting may start.
  setBootQualified(true);
  }, []);

  return {
    mapMode,
    bootQualified,
    mapModeAnnouncement,
    mapSwitchedNote,
    autoScoutNote,
    scoutUpgradeEligible,
    welcomeMapPick,
    setMapMode,
    setMapModeAnnouncement,
    setMapSwitchedNote,
    setAutoScoutNote,
    setScoutUpgradeEligible,
    setWelcomeMapPick,
    applyMapMode,
    applySessionMapMode,
    applyScoutUpgrade,
    handleWelcomeMapMode,
    qualifyBootMapMode,
    // The stored-record pair the shell's manual toggles and Play's
    // upgrade re-check call directly (they stay in the shell; the
    // hook surfaces the capability reader/writer so the composer
    // never imports this area's capability module itself).
    readStoredMapMode,
    writeStoredMapMode,
  };
}
