import { useId, useMemo, useRef, useState } from "react";
import type { JSX, KeyboardEvent } from "react";
import type { LoopNameEntry } from "./types.ts";
import { Button } from "@/components/ui/button";
import {
  displayLoopName,
  fetchLoopIndex,
  LOOP_SUGGESTION_LIMIT,
  rankLoopSuggestions,
} from "./evaluate.ts";

/**
 * The normalizer lives in ./evaluate.ts (Worker 3's own module) and is
 * re-exported here so the input surface owns the contract.
 */
export { normalizeLoopName } from "./evaluate.ts";

type LoadState = "idle" | "loading" | "ready" | "error";

/**
 * Constrained typeahead for the GeoDetective edition (WAI-ARIA 1.2 combobox).
 *
 * - The name index (public/loop/names.json) is fetched lazily on first
 *   focus and never ships in the main bundle.
 * - Suggestions match every query word against "name + region", ranked
 *   exact-name > word-boundary > substring > region-only, then population;
 *   capped at 8, with the pre-cap total shown ("8 of 65 — keep typing").
 * - Propose -> commit: tapping a suggestion or pressing Enter only PROPOSES
 *   (fills the input, arms the Guess button); the Guess button commits the
 *   guess. A mis-tap never burns one of the five guesses.
 * - Keyboard: ArrowDown/ArrowUp move the active option, Enter proposes the
 *   active option (or the top suggestion when none is active), Escape
 *   closes the listbox.
 * - Free text with no match shows a friendly inline message and never
 *   arms the Guess button.
 */
export function GuessInput({ onPick }: { onPick: (entry: LoopNameEntry) => void }): JSX.Element {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<LoopNameEntry[] | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // The proposed pick: chosen from the list, not yet a guess.
  const [pending, setPending] = useState<LoopNameEntry | null>(null);
  // Transient status-region note (e.g. Enter while the index is loading).
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const statusId = `${baseId}-status`;

  const { suggestions, total } = useMemo(
    () =>
      index
        ? rankLoopSuggestions(index, query)
        : { suggestions: [] as LoopNameEntry[], total: 0 },
    [index, query],
  );

  const queryIsBlank = query.trim().length === 0;
  const showListbox = open && !queryIsBlank && loadState === "ready";
  const showSuggestions = showListbox && suggestions.length > 0;
  const showNoMatch = showListbox && suggestions.length === 0;
  const showOverflow = showSuggestions && total > LOOP_SUGGESTION_LIMIT;

  function loadIndex(): void {
    setLoadState("loading");
    fetchLoopIndex()
      .then((entries) => {
        setIndex(entries);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }

  function ensureIndexLoaded(): void {
    if (loadState === "idle") loadIndex();
  }

  /** Propose: fill the input and arm the Guess button. Burns nothing. */
  function propose(entry: LoopNameEntry): void {
    setPending(entry);
    setStatusNote(null);
    setQuery(displayLoopName(entry));
    setOpen(false);
    setActiveIndex(-1);
    // Keep focus so the player can commit (or keep typing) immediately.
    inputRef.current?.focus();
  }

  /** Commit: the Guess button burns one of the five guesses. */
  function commit(): void {
    if (!pending) return;
    onPick(pending);
    setPending(null);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Enter") {
      if (loadState === "loading" || loadState === "idle") {
        // M2: never a dead keypress — announce the load through the status
        // region instead of swallowing Enter silently.
        e.preventDefault();
        if (loadState === "idle") loadIndex();
        setStatusNote("Still loading place names — one moment…");
        return;
      }
      if (loadState === "error") {
        // The retry affordance is already announced in the status region;
        // don't submit, don't swallow.
        e.preventDefault();
        return;
      }
      if (!showListbox) return;
      e.preventDefault();
      const pick = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
      // No suggestions: the inline no-match message is already visible;
      // never propose free text.
      if (pick) propose(pick);
    }
  }

  return (
    <div className="relative w-full">
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-muted">
        Guess the place
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls={showSuggestions ? listboxId : undefined}
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        aria-autocomplete="list"
        aria-describedby={statusId}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Type a place name…"
        value={query}
        onFocus={() => {
          ensureIndexLoaded();
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          // The input no longer matches the proposal — disarm the button.
          setPending(null);
          setStatusNote(null);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-fg outline-none placeholder:text-muted focus:border-fg/40"
      />
      {showSuggestions && (
        <ul
          role="listbox"
          id={listboxId}
          aria-label="Matching places"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-surface py-1"
        >
          {suggestions.map((entry, i) => (
            <li
              key={entry.id}
              id={`${listboxId}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              // mousedown (not click): fires before the input's blur closes
              // the listbox; preventDefault keeps focus in the combobox.
              onMouseDown={(e) => {
                e.preventDefault();
                propose(entry);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className="cursor-pointer px-4 py-2.5 text-base text-fg aria-selected:bg-fg/10"
            >
              {displayLoopName(entry)}
            </li>
          ))}
        </ul>
      )}
      <Button type="button" onClick={commit} disabled={pending === null} className="mt-2 w-full">
        Guess
      </Button>
      <p id={statusId} role="status" className="mt-1 min-h-[1.25rem] text-sm text-muted">
        {statusNote}
        {!statusNote && loadState === "loading" && "Loading place names…"}
        {!statusNote && loadState === "error" && (
          <>
            Couldn&apos;t load the place list. Check your connection and{" "}
            <button
              type="button"
              onClick={loadIndex}
              className="cursor-pointer font-medium text-fg underline"
            >
              try again
            </button>
            .
          </>
        )}
        {!statusNote &&
          showNoMatch &&
          `No places match “${query.trim()}”. Check the spelling and try another name.`}
        {!statusNote &&
          showOverflow &&
          `${suggestions.length} of ${total} — keep typing to narrow it down.`}
      </p>
    </div>
  );
}
