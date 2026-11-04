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
  readLoopDeckClosed,
  readSelectedDeck,
  type PackDeckView,
  type PackEditionId,
  type PackManifest,
} from "./pack-shelf-data.ts";

/**
 * The pack shelf: one row of deck chips inside an edition's entry
 * screen (docs/story-packs.md sections 6 and 7, placed in the entry flows by the
 * swarm brief; the home cards belong to Track A).
 *
 * What a player can do here:
 * - See the decks this edition can deal: the core deck, plus the
 *   Capitals pack once its manifest ships. An unshipped pack never
 *   renders a chip.
 * - See cases closed per deck, read live from each deck's own store.
 * - Tap a chip to pick that deck. The pick goes to the screen
 *   through onPickDeck: the screen owns the store its dealer reads,
 *   so the pick and the deal can never disagree. When a finished
 *   case is on screen, the tap also starts that next case at once,
 *   through the screen's own next-case handler. A case mid-play is
 *   never yanked: the pick applies to the next case, and the status
 *   line under the chips says so.
 *
 * Layout: the section reserves its height from first paint. The label,
 * the chip row, and the status line all carry fixed minimum heights,
 * so the pack chip arriving after its manifest fetch moves nothing
 * below the shelf.
 *
 * Wiring (integrated): activeDeckId is the deck the on-screen case
 * was dealt from, in shelf vocabulary; both screens pass the open
 * case's real deck. GeoDetective pack progress reads the pack deck's
 * own cycle count in the loop store; Cold Trail pack progress reads
 * the pack store's solved count.
 */
export function PackShelf({
  edition,
  activeDeckId,
  caseFinished,
  onPickDeck,
  onStartNext,
  coreTotal = null,
  packTotal = null,
  statusLineSuppressed = false,
}: {
  edition: PackEditionId;
  activeDeckId: string;
  caseFinished: boolean;
  /** Store the pick in the store the screen's dealer reads. Runs before onStartNext. */
  onPickDeck: (deckId: string) => void;
  onStartNext: () => void;
  /** Deck size when the screen already knows it (Cold Trail bundles its count). */
  coreTotal?: number | null;
  /** Pack deck size in this edition when the screen bundles it (Cold Trail: 60, not the manifest's 72). */
  packTotal?: number | null;
  /**
   * Keep the status line under the chips empty while the screen is
   * showing a message of its own in the same spot (#336 owner cure:
   * during a GeoDetective fallback case, the fallback notice is the
   * one voice — the shelf's "Your next case comes from…" line saying
   * a second thing at the same time is what confused the owner).
   * The line's reserved height stays, so nothing below shifts.
   */
  statusLineSuppressed?: boolean;
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
  const packClosed =
    edition === "geodetective" ? readLoopDeckClosed(FIRST_PACK_ID) : readColdtrailClosed("pack");
  const decks = buildDeckList({
    edition,
    packManifest: manifest,
    coreClosed,
    coreTotal: coreTotal ?? loopSize,
    packClosed,
    packTotal,
  });

  // A stored pick can name a pack that is not on this shelf (not
  // shipped, or not playable in this edition). The core chip shows as
  // picked then; the stored pick itself is left alone.
  const shownSelected = decks.some((d) => d.id === selected) ? selected : CORE_DECK_ID;
  const selectedDeck: PackDeckView | undefined = decks.find((d) => d.id === shownSelected);

  const onPick = (deckId: string) => {
    setSelected(deckId);
    onPickDeck(deckId);
    if (caseFinished) onStartNext();
  };

  let statusLine = "";
  if (statusLineSuppressed) {
    statusLine = "";
  } else if (caseFinished) {
    statusLine = "Tap a deck chip to start your next case.";
  } else if (shownSelected !== activeDeckId && selectedDeck) {
    statusLine = `Your next case comes from ${selectedDeck.label}.`;
  }

  return (
    <section aria-label="Case decks" data-testid="pack-shelf" className="mt-6">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Case decks</h2>
      {/* At widths where the two chips cannot fit one row (around
          340px and below, e.g. the 320px reflow width) the row wraps,
          so it reserves the second row's height there too: 58 + 8 gap
          + 58 = 124px. Wider viewports keep the one-row reservation,
          so 390px and desktop layout are unchanged. */}
      <div className="mt-2 flex min-h-[58px] flex-wrap gap-2 max-[340px]:min-h-[124px]">
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
      <p role="status" className="mt-2 min-h-[20px] text-sm text-muted" data-testid="pack-shelf-status">
        {statusLine}
      </p>
    </section>
  );
}
