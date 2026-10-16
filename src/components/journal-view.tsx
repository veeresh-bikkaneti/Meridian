/**
 * JournalView — the Journal overlay ("What the land remembers",
 * docs/journal-spec.md §5).
 *
 * Follows the app's grown-ups overlay pattern (age-profile): a
 * full-viewport fixed overlay rendered after the home page, focus moves
 * into it on open, Esc closes, a visible close button, and the host
 * (GameApp) returns focus to the invoking control on close.
 *
 * The set shown is passed in by the host and never changes while the
 * view is open — rotation deferral (spec §6) is the host's job, via
 * `shouldApplySetChange` in @/game/journal. The footer countdown is
 * plain text, refreshed at most once per minute, and is NOT an
 * aria-live region.
 */
import { useEffect, useRef, useState } from "react";
import {
  confidenceText,
  journalSetCount,
  nextEntryCountdown,
  type JournalSet,
} from "@/game/journal";
import "./journal-view.css";

export interface JournalViewProps {
  /** The set to display — fixed for the life of this mount. */
  entry: JournalSet;
  /** Close the view (host returns focus to the invoking control). */
  onClose: () => void;
}

export function JournalView({ entry, onClose }: JournalViewProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  // Countdown clock: plain text, ticked once a minute at most (spec §6).
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    // Focus moves into the dialog on open (grown-ups overlay pattern).
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const total = journalSetCount();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="journal-title"
      className="journal-view"
      data-testid="journal-view"
    >
      <div className="journal-sheet">
        <button
          type="button"
          ref={closeRef}
          className="journal-close"
          onClick={onClose}
          data-testid="journal-close"
        >
          <span aria-hidden="true">✕</span> Close
        </button>
        <p className="journal-eyebrow">Journal</p>
        <h2 id="journal-title" className="journal-title">
          What the land remembers
        </h2>
        <p className="journal-geography">{entry.geography}</p>
        <div className="journal-notes">
          {entry.notes.map((note) => (
            <article key={note.placeId} className="journal-note" data-testid="journal-note">
              <h3 className="journal-note-title">{note.title}</h3>
              <p className="journal-note-eyebrow">{note.geography.toUpperCase()}</p>
              <p className="journal-note-story">{note.story}</p>
              <p className="journal-note-source">
                <a href={note.citation.href} target="_blank" rel="noreferrer">
                  {note.citation.label}
                </a>
                <span className="journal-confidence">{confidenceText(note)}</span>
              </p>
            </article>
          ))}
        </div>
        <p className="journal-footer">
          Entry {entry.index + 1} of {total} · Next entry in {nextEntryCountdown(nowMs)}
        </p>
      </div>
    </div>
  );
}
