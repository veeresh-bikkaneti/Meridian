import { useId, useMemo, useRef, useState } from "react";
import type { JSX, KeyboardEvent } from "react";
import type { LoopNameEntry } from "./types.ts";
import { displayLoopName, fetchLoopIndex, rankLoopSuggestions } from "./evaluate.ts";

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
 * - Suggestions are substring matches on the normalized name, ranked by
 *   population, capped at 8.
 * - Keyboard: ArrowDown/ArrowUp move the active option, Enter picks the
 *   active option (or the top suggestion when none is active), Escape
 *   closes the listbox.
 * - Free text with no match shows a friendly inline message and never
 *   calls onPick.
 */
export function GuessInput({ onPick }: { onPick: (entry: LoopNameEntry) => void }): JSX.Element {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<LoopNameEntry[] | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const statusId = `${baseId}-status`;

  const suggestions = useMemo(
    () => (index ? rankLoopSuggestions(index, query) : []),
    [index, query],
  );

  const queryIsBlank = query.trim().length === 0;
  const showListbox = open && !queryIsBlank && loadState === "ready";
  const showSuggestions = showListbox && suggestions.length > 0;
  const showNoMatch = showListbox && suggestions.length === 0;

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

  function choose(entry: LoopNameEntry): void {
    onPick(entry);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
    // Keep focus so the player can type the next guess immediately.
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
      if (!showListbox) return;
      e.preventDefault();
      const pick = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
      // No suggestions: the inline no-match message is already visible;
      // never call onPick for free text.
      if (pick) choose(pick);
    }
  }

  return (
    <div className="relative w-full">
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-white/80">
        Guess the place
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls={listboxId}
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
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        className="w-full rounded-xl border border-white/15 bg-[rgba(10,12,16,0.72)] px-4 py-3 text-base text-white placeholder:text-white/40 backdrop-blur-[14px] outline-none focus:border-white/40"
      />
      {showSuggestions && (
        <ul
          role="listbox"
          id={listboxId}
          aria-label="Matching places"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-white/15 bg-[rgba(10,12,16,0.94)] py-1 backdrop-blur-[14px]"
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
                choose(entry);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className="cursor-pointer px-4 py-2.5 text-base text-white/90 aria-selected:bg-white/15"
            >
              {displayLoopName(entry)}
            </li>
          ))}
        </ul>
      )}
      <p id={statusId} role="status" className="mt-1 min-h-[1.25rem] text-sm text-white/60">
        {loadState === "loading" && "Loading place names…"}
        {loadState === "error" && (
          <>
            Couldn&apos;t load the place list. Check your connection and{" "}
            <button
              type="button"
              onClick={loadIndex}
              className="cursor-pointer font-medium text-white underline"
            >
              try again
            </button>
            .
          </>
        )}
        {showNoMatch &&
          `No places match “${query.trim()}”. Check the spelling and try another name.`}
      </p>
    </div>
  );
}
