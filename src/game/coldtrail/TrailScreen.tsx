import { useEffect, useRef, useState, type JSX } from "react";
import { clampLat, normalizeLon } from "@/game/geo";
import { Button } from "@/components/ui/button";
import { playConfirmGuess, playLose, playWin } from "@/game/audio/sfx";
import { playCelebrationSound } from "@/game/audio/play-guards";
import { LoopMap } from "../loop/LoopMap";
import { coldtrailCaseCount, getColdtrailCase } from "./cases";
import {
  INFORMANT_COST,
  effectiveRadius,
  scoreIntercept,
  SOLVE_REWARD,
  verdictFor,
} from "./engine";
import {
  buildEvidenceOverlays,
  nudgeDirection,
  tripleOverlap,
  wrapLonDelta,
  type LockedRing,
  type PlacementDraft,
} from "./placement";
import { freshProgress, loadColdtrail, saveColdtrail, takeLegacyMigrationNotice } from "./store";
import { InterceptConfirm } from "./InterceptConfirm";
import { SightingCard } from "./SightingCard";
import type { ColdTrailStore } from "./types";

/**
 * Cold Trail vertical slice: one case = 3 timestamped sightings → the player
 * places 3 radius rings → taps the interception guess → score reveal (km
 * from the true hideout).
 *
 * Placement mode (WS1 "Every Place Findable"): "📍 Place ring on map" arms
 * the map for a sighting (crosshair, no ring yet); the player's tap plants
 * an ephemeral draft ring; tap-to-move re-positions it (primary verb), a
 * draggable 🎯 marker and arrow-key nudge are progressive enhancement; "Yes,
 * keep it" commits the player's chosen center atomically with ringsPlaced.
 * Pre-reveal, the map renders ONLY player-chosen coordinates — the true
 * anchor (sighting.cityLon/cityLat) never reaches the render path.
 *
 * The map is the shared Detective's Atlas (LoopMap) in free-tap mode: taps
 * report raw coordinates instead of resolving to labeled places. No place
 * index is fetched in this mode.
 */
export function TrailScreen({ onLeave }: { onLeave: () => void }): JSX.Element {
  const [store, setStore] = useState<ColdTrailStore>(loadColdtrail);
  const [pending, setPending] = useState<{ lon: number; lat: number } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  // Placement-mode state: ephemeral, NEVER persisted (a reload mid-placement
  // returns to idle — a clean, non-dead state). `placing !== null && draft
  // === null` ⟺ placing(i); `draft !== null` ⟺ adjusting(i).
  const [placing, setPlacing] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ lon: number; lat: number } | null>(null);
  const caseHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const prevRevealedRef = useRef(false);
  const prevCaseIndexRef = useRef<number | null>(null);
  // Focus targets: each card's primary action button (place/cancel/confirm).
  const cardActionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // Coarse pointer (touch): placement mode gets a static reticle overlay —
  // there is no crosshair cursor on touch devices.
  const [isCoarsePointer] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches,
  );

  const commit = (next: ColdTrailStore) => {
    saveColdtrail(next);
    setStore(next);
  };

  // Keep keyboard/screen-reader focus on the action: result heading on
  // reveal, case heading when a new case is dealt. Reads store directly so
  // the hook stays above the fail-closed early return.
  const caseIndexNow = store.caseIndex;
  const revealedNow = store.current?.revealed ?? false;
  useEffect(() => {
    if (revealedNow && !prevRevealedRef.current) resultHeadingRef.current?.focus();
    prevRevealedRef.current = revealedNow;
    if (prevCaseIndexRef.current !== null && prevCaseIndexRef.current !== caseIndexNow) {
      caseHeadingRef.current?.focus();
    }
    prevCaseIndexRef.current = caseIndexNow;
  }, [revealedNow, caseIndexNow]);

  // One-time notice after a v1 save migrates (auto-placed rings are gone).
  useEffect(() => {
    if (takeLegacyMigrationNotice()) {
      setHint("Rings work differently now — place yours!");
    }
  }, []);

  const deckSize = coldtrailCaseCount();
  const caseData = deckSize > 0 ? getColdtrailCase(store.caseIndex) : null;
  const progress = store.current ?? freshProgress();

  if (!caseData) {
    // Fail closed: a corrupt or empty deck never starts a broken case.
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8" data-testid="coldtrail-screen">
        <h1 className="font-display text-3xl text-fg">❄️ Cold Trail</h1>
        <p className="mt-4 text-fg" role="alert">
          The case files didn&rsquo;t load. No case to play right now.
        </p>
        <Button type="button" variant="secondary" onClick={onLeave} className="mt-6 min-h-[44px] self-start">
          ← Back
        </Button>
      </main>
    );
  }

  const ringsPlacedCount = progress.ringsPlaced.filter(Boolean).length;
  const allRingsPlaced = ringsPlacedCount === 3;
  const revealed = progress.revealed;

  // Render inputs derived by the pure, unit-tested buildEvidenceOverlays:
  // locked rings + witness dots at PLAYER centers, draft ring as preview.
  const draftForOverlay: PlacementDraft | null =
    placing !== null && draft ? { index: placing, ...draft } : null;
  const { rings: evidenceRings, marks: evidenceMarks, overlap: evidenceOverlap } = buildEvidenceOverlays(
    caseData,
    progress,
    draftForOverlay,
  );

  const withProgress = (mutate: (p: typeof progress) => void): void => {
    const next = {
      ...progress,
      ringsPlaced: [...progress.ringsPlaced] as typeof progress.ringsPlaced,
      informantOn: [...progress.informantOn] as typeof progress.informantOn,
      // Clone ringCenters too: the commit below must not mutate the previous
      // progress object's array (React state immutability / I5 atomicity).
      ringCenters: [...progress.ringCenters] as typeof progress.ringCenters,
    };
    mutate(next);
    commit({ ...store, current: next });
  };

  const focusMap = () => {
    document.querySelector<HTMLElement>('[data-testid="loop-map"]')?.focus();
  };

  // Enter placement mode for sighting i. Tapping another card's button
  // mid-placement switches implicitly (UXA T5/T11): the in-flight draft is
  // discarded — drafts are free, one tap to recreate.
  const onPlaceRing = (i: number) => {
    if (revealed) return;
    if (placing === i) return;
    if (placing !== null) {
      setHint("Your ring draft was set aside — tap 📍 to place it again.");
    } else {
      setHint("Tap where you think the ring goes");
    }
    setPlacing(i);
    setDraft(null);
    focusMap();
  };

  // Placement tap from LoopMap (placing → adjusting, or tap-to-move while
  // adjusting — the primary adjust verb). Keyboard planting (Enter/Space at
  // the map center) flows through here too. Coordinates are normalized here.
  const onPlacementTap = (lon: number, lat: number) => {
    if (revealed || placing === null) return;
    const firstTap = draft === null;
    setDraft({ lon: normalizeLon(lon), lat: clampLat(lat) });
    if (firstTap) {
      // Input-agnostic: works for tap planters and keyboard planters alike.
      setHint("Ring planted — move it with arrow keys or by tapping, then tap “Yes, keep it”.");
    }
  };

  // Drag of the draft marker ended (progressive enhancement over tap-to-move).
  const onPlacementDrag = (lon: number, lat: number) => {
    if (revealed || placing === null) return;
    setDraft({ lon: normalizeLon(lon), lat: clampLat(lat) });
  };

  // Arrow-key nudge from LoopMap (scale-aware step, computed there).
  const onPlacementNudge = (lon: number, lat: number) => {
    if (revealed || placing === null || draft === null) return;
    // The step is signed BEFORE lon normalization: an east step across the
    // antimeridian wraps 179 → -179, whose raw delta (-358°) would
    // mis-announce as "west". wrapLonDelta recovers the true +2°.
    const dLon = wrapLonDelta(lon - draft.lon);
    setHint(`Ring moved ${nudgeDirection(dLon, lat - draft.lat)}.`);
    setDraft({ lon, lat });
  };

  // Commit the draft: atomic — ringCenters[i] and ringsPlaced[i] in one
  // withProgress transaction (I5). Re-lock after Move works the same way.
  const onLockRing = () => {
    if (revealed || placing === null || draft === null) return;
    const i = placing;
    const center = draft;
    const wasPlaced = progress.ringsPlaced[i]!;
    withProgress((p) => {
      p.ringCenters[i] = { ...center };
      p.ringsPlaced[i] = true;
    });
    // The lock moment gets a chime (walkthrough F7) — the reward schedule
    // of the place→adjust→lock loop is thin without it.
    playCelebrationSound("toastChime");
    setPlacing(null);
    setDraft(null);
    const locked = ringsPlacedCount + (wasPlaced ? 0 : 1);
    if (locked === 3) {
      // Fresh overlap check: the render's evidenceOverlap is stale here
      // (only 2 rings were locked before this commit). When the rings are
      // disjoint there is no crossing — say so instead of "tap where they
      // cross", and never imply a center.
      const freshLocked: LockedRing[] = [];
      caseData.sightings.forEach((s, j) => {
        const c = j === i ? center : progress.ringCenters[j];
        if (!c) return;
        freshLocked.push({
          lon: c.lon,
          lat: c.lat,
          radiusKm: effectiveRadius(s, progress.informantOn[j]!),
        });
      });
      const freshOverlap = tripleOverlap(freshLocked);
      setHint(
        freshOverlap?.polygon
          ? "All 3 rings are down — tap where they cross to set your interception."
          : "All 3 rings are down, but they don't cross — use ↩ Move on a ring to shift it closer.",
      );
    } else {
      setHint(`Ring ${i + 1} locked. ${3 - locked} to go — tap 📍 Place ring on the next sighting.`);
    }
    // Focus the next unplaced card's action; when all 3 are down, the map
    // (the next thing to tap) takes focus.
    const nextRings = [...progress.ringsPlaced];
    nextRings[i] = true;
    const nextIdx = nextRings.findIndex((placed) => !placed);
    if (nextIdx >= 0) cardActionRefs.current[nextIdx]?.focus();
    else focusMap();
  };

  // "Try again": discard the draft, re-arm the crosshair (back to placing(i)).
  const onTryAgain = () => {
    if (revealed || placing === null) return;
    setDraft(null);
    setHint("Tap where you think the ring goes");
    focusMap();
  };

  const onCancelPlacement = () => {
    if (placing === null) return;
    const i = placing;
    setPlacing(null);
    setDraft(null);
    setHint("Placement canceled — no ring placed.");
    // Focus AFTER React commits the idle tree (WCAG 2.4.3): the card's
    // "✖ Cancel placement" button unmounts on commit, so focusing it
    // synchronously here would focus a detached node and drop focus to
    // <body>. rAF fires post-commit, when the ref points at the card's
    // "📍 Place ring on map" button again. The Escape path shares this
    // function, so it gets the same fix.
    requestAnimationFrame(() => {
      cardActionRefs.current[i]?.focus();
    });
  };

  // "Move" on a confirmed ring: re-enter adjusting(i) with the draft planted
  // at the current locked center; re-confirm re-locks (no cost, no penalty).
  // Entering adjusting via Move clears a pending interception (O13): a
  // pending guess predicated on 3 locked rings is void once one unlocks.
  const onMoveRing = (i: number) => {
    if (revealed || !progress.ringCenters[i]) return;
    setPending(null);
    setPlacing(i);
    setDraft({ ...progress.ringCenters[i]! });
    // Entering adjusting via Move discards another card's in-flight draft
    // (adjudication 3) — say so with the exact set-aside copy.
    if (placing !== null && placing !== i) {
      setHint("Your ring draft was set aside — tap 📍 to place it again.");
    } else {
      setHint("Tap the map to move the ring — then tap “Yes, keep it”.");
    }
    focusMap();
  };

  // Escape exits placement mode without locking (the touch path is the
  // Cancel button; document-level so it works from any focused control).
  // Re-registers only when `placing` changes (NIT: was every render).
  useEffect(() => {
    if (placing === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancelPlacement();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placing]);

  // Focus the map when placement starts (WCAG 2.4.3): the map container
  // only becomes focusable AFTER the placing render commits (tabIndex is
  // conditional on placementActive), so focus in an effect — the synchronous
  // focusMap() calls in onPlaceRing/onMoveRing fire pre-commit and are no-ops.
  useEffect(() => {
    if (placing !== null) {
      document.querySelector<HTMLElement>('[data-testid="loop-map"]')?.focus();
    }
  }, [placing]);

  // Defensive: reveal requires 3 confirmed rings, so placing + revealed is
  // unreachable — but abort any draft if revealed ever flips (UXA T12).
  useEffect(() => {
    if (revealed && placing !== null) {
      setPlacing(null);
      setDraft(null);
    }
  }, [revealed, placing]);

  const onInformant = (i: number) => {
    if (revealed || !progress.ringsPlaced[i] || progress.informantOn[i]) return;
    if (store.stars < INFORMANT_COST) {
      setHint("Not enough stars — close a case to earn one.");
      return;
    }
    const next = {
      ...progress,
      ringsPlaced: [...progress.ringsPlaced] as typeof progress.ringsPlaced,
      informantOn: [...progress.informantOn] as typeof progress.informantOn,
      ringCenters: [...progress.ringCenters] as typeof progress.ringCenters,
    };
    next.informantOn[i] = true;
    commit({ ...store, stars: store.stars - INFORMANT_COST, current: next });
    setHint("🎙️ The informant tightened that ring to half its radius.");
  };

  // Map tap: the interception guess (only once all 3 rings are locked).
  // While a ring is placing/adjusting, taps are routed to onPlacementTap by
  // LoopMap and never reach here — the placing branch was removed per C8
  // (it was unreachable and a double-handling trap for future edits).
  const onMapTap = (lon: number, lat: number) => {
    if (revealed) return;
    if (!allRingsPlaced) {
      setHint("Place all 3 rings first — one per sighting card.");
      return;
    }
    setHint(null);
    setPending({ lon, lat });
  };

  const onConfirmIntercept = () => {
    if (!pending || revealed) return;
    playConfirmGuess();
    const scoreKm = scoreIntercept(pending.lon, pending.lat, caseData.hideout.lon, caseData.hideout.lat);
    const verdict = verdictFor(scoreKm);
    if (verdict.caught) playWin();
    else playLose();
    const next = {
      ...progress,
      guess: pending,
      revealed: true,
      scoreKm,
    };
    commit({
      ...store,
      stars: store.stars + SOLVE_REWARD,
      solved: store.solved + 1,
      current: next,
    });
    setPending(null);
  };

  const onNextCase = () => {
    setPending(null);
    setHint(null);
    setPlacing(null);
    setDraft(null);
    commit({ ...store, caseIndex: store.caseIndex + 1, current: freshProgress() });
  };

  const verdict = progress.scoreKm !== null ? verdictFor(progress.scoreKm) : null;
  const placingNow = placing !== null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-8" data-testid="coldtrail-screen">
      <header>
        <div className="flex items-start justify-between gap-3">
          <Button type="button" variant="ghost" onClick={onLeave} className="min-h-[44px] px-2">
            ← All games
          </Button>
          <p data-testid="coldtrail-stars" className="text-sm text-muted" aria-label={`${store.stars} stars`}>
            ⭐ {store.stars}
          </p>
        </div>
        <p className="mt-4 text-[11px] tracking-wider text-muted uppercase">❄️ Cold Trail · Case file</p>
        <h1 ref={caseHeadingRef} tabIndex={-1} className="font-display mt-1 text-3xl text-fg">
          Case #{String(caseData.caseNo).padStart(3, "0")}
        </h1>
        <p className="mt-2 text-muted">
          A smuggler is moving between cities. Three sightings, three rings — triangulate
          the hideout and tap your interception.
        </p>
      </header>

      <section aria-label="Sightings" className="mt-6 flex flex-col gap-3">
        {caseData.sightings.map((s, i) => (
          <SightingCard
            key={s.id}
            sighting={s}
            index={i}
            ringPlaced={progress.ringsPlaced[i]!}
            informantOn={progress.informantOn[i]!}
            stars={store.stars}
            revealed={revealed}
            onPlaceRing={() => onPlaceRing(i)}
            onInformant={() => onInformant(i)}
            placingActive={placing === i}
            draftSet={placing === i && draft !== null}
            onLockRing={onLockRing}
            onTryAgain={onTryAgain}
            onCancelPlacement={onCancelPlacement}
            onMoveRing={() => onMoveRing(i)}
            actionRef={(el) => {
              cardActionRefs.current[i] = el;
            }}
          />
        ))}
      </section>

      <section aria-label="Trail map" className="mt-6 flex flex-col gap-3">
        {/* Plain text, not a live region: the hint below (role="status") is
            the single announcer — two live regions were double-announcing
            the same sentences (e.g. "All 3 rings are down"). Every state
            shown here is also announced via the hint or a focus move. */}
        <p className="text-sm text-muted">
          {revealed
            ? "Case closed — the gold star marks the hideout."
            : allRingsPlaced
              ? evidenceOverlap?.polygon
                ? "All 3 rings are down — tap where they cross to set your interception."
                : "All 3 rings are down, but they don't cross — use ↩ Move on a ring to shift it closer."
              : `Rings placed: ${ringsPlacedCount} of 3`}
        </p>
        <div className="relative">
          <LoopMap
            guesses={[]}
            target={{ lon: caseData.hideout.lon, lat: caseData.hideout.lat }}
            finished={revealed}
            freeTap
            onMapTap={onMapTap}
            evidenceRings={evidenceRings}
            evidenceMarks={evidenceMarks}
            evidenceOverlap={evidenceOverlap}
            mapLabel={
              placingNow
                ? `Cold Trail map — placing the ring for sighting ${placing! + 1}. Tap the map where you think the ring goes, or press Enter to plant it at the map center, then use arrow keys to move it.`
                : "Cold Trail map. Place each sighting ring where you think the witness saw the smuggler, then tap where the rings cross to set your interception."
            }
            placementActive={placingNow}
            onPlacementTap={onPlacementTap}
            placementDraft={draft}
            onPlacementDrag={onPlacementDrag}
            onPlacementNudge={onPlacementNudge}
            onSelectPlace={() => {}}
            onEmptyTap={() => {}}
          />
          {placingNow && draft === null ? (
            <>
              {/* Armed-map signal: dashed gold border while waiting for the
                  first tap. Static (no pulse) — reduced-motion safe. The hint
                  banner carries the meaning; this is aria-hidden. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-2 rounded-xl border-2 border-dashed border-[#C9A227]"
              />
              {/* Touch devices have no crosshair cursor: a decorative reticle
                  at map center orients the eye. Taps land where the finger
                  lands, not at the reticle. */}
              {isCoarsePointer ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl text-[#C9A227]"
                >
                  ⊕
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        {!revealed ? (
          <p className="text-xs text-muted" aria-hidden="true">
            <span className="text-gold-ink">gold ring</span>&thinsp;=&thinsp;witness sighting radius
            {placingNow ? (
              <>
                &ensp;·&ensp;<span className="text-gold-ink">dashed ring</span>&thinsp;=&thinsp;your draft — not locked yet
              </>
            ) : null}
            &ensp;·&ensp;{allRingsPlaced && !evidenceOverlap?.polygon ? (
              <>use ↩ Move on a sighting card to shift a ring closer</>
            ) : (
              <>tap where the rings cross to intercept</>
            )}
          </p>
        ) : null}
        {hint ? (
          <div className="flex items-center justify-between gap-3">
            <p role="status" data-testid="map-hint" className="text-sm text-fg">
              {hint}
            </p>
            {placingNow ? (
              <button
                type="button"
                data-testid="cancel-placement-banner-btn"
                onClick={onCancelPlacement}
                className="min-h-[44px] shrink-0 px-3 text-sm text-muted underline"
              >
                Cancel
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {pending && !revealed ? (
        <InterceptConfirm onConfirm={onConfirmIntercept} onCancel={() => setPending(null)} />
      ) : null}

      {revealed && verdict && progress.scoreKm !== null ? (
        <section
          aria-label="Case result"
          data-testid="coldtrail-reveal"
          className="mt-6 rounded-xl border border-line bg-surface p-5"
        >
          <p className="text-[11px] tracking-wider text-muted uppercase">Case closed</p>
          <h2 ref={resultHeadingRef} tabIndex={-1} className="mt-1 text-2xl font-semibold text-fg">{verdict.title}</h2>
          <p className="mt-2 text-fg">
            The hideout was <strong>{caseData.hideout.name}</strong>.
          </p>
          <p className="mt-1 text-muted">
            Your intercept missed by{" "}
            <strong className="text-fg">
              {progress.scoreKm.toLocaleString("en-US")} km
            </strong>
            . {verdict.line}
          </p>
          <p className="mt-2 text-sm text-muted">+{SOLVE_REWARD}⭐ for closing the case</p>
          <Button
            type="button"
            data-testid="next-case-btn"
            onClick={onNextCase}
            className="mt-4 min-h-[48px] w-full text-base"
          >
            🔎 Next case
          </Button>
        </section>
      ) : null}
    </main>
  );
}
