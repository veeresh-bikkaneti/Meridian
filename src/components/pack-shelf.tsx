import { useEffect, useState, type JSX } from "react";
import {
  CORE_DECK_ID,
  FIRST_PACK_ID,
  buildDeckList,
  deckProgressLine,
  fetchLoopDeckSize,
  fetchPackManifest,
  readColdtrailClosed,
  readLoopCoreClosed,
  readSelectedDeck,
  writeSelectedDeck,
  type PackDeckView,
  type PackEditionId,
  type PackManifest,
} from "./pack-shelf-data.ts";

/**
 * The pack shelf: one row of deck chips inside an edition's entry
 * screen (DESIGN.md sections 6 and 7, placed in the entry flows by the
 * swarm brief; the home cards belong to Track A).
 *
 * What a player can do here:
 * - See the decks this edition can deal: the core deck, plus the
 *   Capitals pack once its manifest ships. An unshipped pack never
 *   renders a chip.
 * - See cases closed per deck, read live from each deck's own store.
 * - Tap a chip to pick that deck. The pick is stored through
 *   pack-shelf-data.ts, and the deal path (slice 1) deals the next
 *   case from it. When a finished case is on screen, the tap also
 *   starts that next case at once, through the screen's own next-case
 *   handler. A case mid-play is never yanked: the pick applies to the
 *   next case, and the status line under the chips says so.
 *
 * Layout: the section reserves its height from first paint. The label,
 * the chip row, and the status line all carry fixed minimum heights,
 * so the pack chip arriving after its manifest fetch moves nothing
 * below the shelf.
 *
 * Integration points for the Stacker:
 * - activeDeckId is the deck the on-screen case was dealt from. Both
 *   screens pass the core deck on this branch because dealing is not
 *   deck-aware yet; slice 1 passes the open case's real deck id.
 * - GeoDetective pack progress reads as unknown until slice 1's
 *   per-deck store lands (see pack-shelf-data.ts, assumption 2).
 */
export function PackShelf({
  edition,
  activeDeckId,
  caseFinished,
  onStartNext,
  coreTotal = null,
}: {
  edition: PackEditionId;
  activeDeckId: string;
  caseFinished: boolean;
  onStartNext: () => void;
  /** Deck size when the screen already knows it (Cold Trail bundles its count). */
  coreTotal?: number | null;
}): JSX.Element {
  const [manifest, setManifest] = useState<PackManifest | null>(null);
  const [loopSize, setLoopSize] = useState<number | null>(null);
  const [selected, setSelected] = useState<string>(() => readSelectedDeck(edition));

  useEffect(() => {
    let live = true;
    void fetchPackManifest(FIRST_PACK_ID).then((m) => {
      if (live) setManifest(m);
    });
    return () => {
      live = false;
    };
  }, []);

  // GeoDetective's core deck size lives in the loop manifest. Cold
  // Trail passes its bundled count as a prop instead.
  useEffect(() => {
    if (edition !== "geodetective" || coreTotal !== null) return;
    let live = true;
    void fetchLoopDeckSize().then((size) => {
      if (live) setLoopSize(size);
    });
    return () => {
      live = false;
    };
  }, [edition, coreTotal]);

  // Progress reads run on every render: both screens re-render on each
  // store commit, so the counts stay current without a subscription.
  const coreClosed =
    edition === "geodetective" ? readLoopCoreClosed() : readColdtrailClosed("core");
  const packClosed = edition === "coldtrail" ? readColdtrailClosed("pack") : null;
  const decks = buildDeckList({
    edition,
    packManifest: manifest,
    coreClosed,
    coreTotal: coreTotal ?? loopSize,
    packClosed,
  });

  // A stored pick can name a pack that is not on this shelf (not
  // shipped, or not playable in this edition). The core chip shows as
  // picked then; the stored pick itself is left alone.
  const shownSelected = decks.some((d) => d.id === selected) ? selected : CORE_DECK_ID;
  const selectedDeck: PackDeckView | undefined = decks.find((d) => d.id === shownSelected);

  const onPick = (deckId: string) => {
    writeSelectedDeck(edition, deckId);
    setSelected(deckId);
    if (caseFinished) onStartNext();
  };

  let statusLine = "";
  if (caseFinished) {
    statusLine = "Tap a deck chip to start your next case.";
  } else if (shownSelected !== activeDeckId && selectedDeck) {
    statusLine = `Your next case comes from ${selectedDeck.label}.`;
  }

  return (
    <section aria-label="Case decks" data-testid="pack-shelf" className="mt-6">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Case decks</h2>
      <div className="mt-2 flex min-h-[58px] flex-wrap gap-2">
        {decks.map((deck) => {
          const isSelected = deck.id === shownSelected;
          const line = deckProgressLine(deck);
          return (
            <button
              key={deck.id}
              type="button"
              aria-pressed={isSelected}
              data-testid={`pack-chip-${deck.id}`}
              onClick={() => onPick(deck.id)}
              className={`min-h-[58px] min-w-[44px] rounded-2xl border px-4 py-2 text-left ${
                isSelected
                  ? "border-transparent bg-accent text-accent-fg"
                  : "border-line bg-surface text-fg"
              }`}
            >
              <span className="block text-base leading-snug font-semibold">
                <span aria-hidden="true">{deck.glyph} </span>
                {deck.label}
                {deck.star ? <span aria-hidden="true"> ★</span> : null}
              </span>
              {line ? (
                <span
                  className={`block text-xs leading-snug ${isSelected ? "text-accent-fg" : "text-muted"}`}
                >
                  {line}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="mt-2 min-h-[20px] text-sm text-muted" data-testid="pack-shelf-status">
        {statusLine}
      </p>
    </section>
  );
}
