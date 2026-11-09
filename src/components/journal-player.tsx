/**
 * journal-player.tsx — tap-to-play movie player for one journal entry
 * ("What the land remembers").
 *
 * The entry's still picture IS the button: tapping it swaps the picture
 * for that entry's movie (10 s, with audio narration) in the same 3/2
 * box. Nothing loads before the tap — the manifest is fetched lazily on
 * first open and the <video> carries preload="none", so no movie bytes
 * move until the kid asks. Closing stops playback and returns the still.
 *
 * One player open at a time: `open` is driven by the parent, which holds
 * the single open note id. Reduced motion: the movie still plays on the
 * explicit tap (the tap is consent), but it plays once instead of
 * looping. Audio plays on the tap gesture, with a mute toggle in the
 * controls — but if the browser refuses playback, the player degrades
 * to paused-with-a-big-Play-button instead of failing.
 */
import { useEffect, useRef, useState } from "react";
import { LazyHomeImage } from "./lazy-home-image";
import {
  getJournalMovieManifest,
  journalMovieUrl,
  resetJournalMovieManifestCache,
  type JournalMovieManifest,
} from "./journal-movies";

export type JournalPlayerPhase = "closed" | "loading" | "ready" | "error";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `0:${String(total).padStart(2, "0")}`;
}

export function JournalPlayer({
  noteId,
  place,
  imageSrc,
  imageAlt,
  open,
  onOpen,
  onClose,
  reducedMotion,
  /** Test-only deterministic path: bypass the manifest fetch. When
   *  undefined (production), the manifest is fetched lazily on open. */
  movieUrlOverride,
}: {
  noteId: string;
  place: string;
  imageSrc: string;
  imageAlt: string;
  open: boolean;
  onOpen: (noteId: string) => void;
  onClose: () => void;
  reducedMotion?: boolean;
  movieUrlOverride?: string | null;
}) {
  const reduceMotion = reducedMotion ?? prefersReducedMotion();
  const initialPhase = (): JournalPlayerPhase => {
    if (!open) return "closed";
    if (movieUrlOverride === undefined) return "loading";
    return movieUrlOverride === null ? "error" : "ready";
  };
  const [phase, setPhase] = useState<JournalPlayerPhase>(initialPhase);
  const [movieUrl, setMovieUrl] = useState<string | null>(
    movieUrlOverride === undefined ? null : movieUrlOverride,
  );
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showPauseFlash, setShowPauseFlash] = useState(false);
  const flashTimerRef = useRef<number | null>(null);
  const [ended, setEnded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeText, setTimeText] = useState("0:00 / 0:10");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(open);

  // Open/close transitions: fetch the manifest lazily on open, reset on close.
  useEffect(() => {
    if (!open) {
      setPhase("closed");
      setMovieUrl(movieUrlOverride === undefined ? null : movieUrlOverride);
      setPaused(true);
      setMuted(false);
      setShowPauseFlash(false);
      setEnded(false);
      setProgress(0);
      setTimeText("0:00 / 0:10");
      return;
    }
    if (movieUrlOverride !== undefined) {
      setMovieUrl(movieUrlOverride);
      setPhase(movieUrlOverride === null ? "error" : "ready");
      return;
    }
    let cancelled = false;
    setPhase("loading");
    getJournalMovieManifest()
      .then((manifest: JournalMovieManifest | null) => {
        if (cancelled) return;
        const url = journalMovieUrl(manifest, noteId);
        setMovieUrl(url);
        setPhase(url === null ? "error" : "ready");
      })
      .catch(() => {
        if (cancelled) return;
        setMovieUrl(null);
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [open, noteId, movieUrlOverride, retryCount]);

  // "Try again" on the error state: drop the memoized manifest (a failed
  // fetch would otherwise be cached for the whole page load) and refetch.
  const handleRetry = () => {
    resetJournalMovieManifestCache();
    setRetryCount((c) => c + 1);
  };

  // Start playback once the video is mounted: the tap is the gesture,
  // so sound is allowed — but if the browser refuses, degrade to paused
  // with the big Play button instead of failing.
  useEffect(() => {
    if (phase !== "ready") return;
    const video = videoRef.current;
    if (!video) return;
    const attempt = video.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => setPaused(true));
    }
  }, [phase]);

  // Keep the video's muted flag in sync with the toggle: React's
  // muted attribute alone does not reliably update the property after
  // mount, so set it on the element directly.
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = muted;
  }, [muted, phase]);

  // Focus (WCAG 2.4.3): opening moves focus INTO the player — the
  // video once it is ready, the Close button while loading or on error.
  // Closing (Close button, Escape, or any other path) returns focus to
  // this entry's play button instead of stranding it on <body>.
  useEffect(() => {
    if (!open) return;
    if (phase === "ready") {
      videoRef.current?.focus();
    } else {
      closeRef.current?.focus();
    }
  }, [open, phase]);

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      document
        .querySelector<HTMLButtonElement>(`[data-testid="journal-play-${noteId}"]`)
        ?.focus();
    }
    wasOpenRef.current = open;
  }, [open, noteId]);

  // Escape closes the player.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (ended) video.currentTime = 0;
      const attempt = video.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(() => setPaused(true));
      }
    } else {
      video.pause();
    }
  };

  // Tapping the video itself toggles play/pause; a tap-pause flashes a
  // brief pause icon (~600ms) so the kid sees the tap landed.
  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      togglePlay();
      return;
    }
    video.pause();
    setShowPauseFlash(true);
    if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setShowPauseFlash(false), 600);
  };

  // The flash timer never outlives the player.
  useEffect(() => {
    return () => {
      if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    setProgress(video.currentTime / video.duration);
    setTimeText(`${formatTime(video.currentTime)} / ${formatTime(video.duration)}`);
  };

  if (!open) {
    return (
      <figure className="hv5-entry-art hv5-journal-art">
        <LazyHomeImage src={imageSrc} alt={imageAlt} />
        <button
          type="button"
          className="hv5-journal-play"
          data-testid={`journal-play-${noteId}`}
          aria-label={`Watch the ${place} movie, 10 seconds with sound`}
          onClick={() => onOpen(noteId)}
        >
          <span className="hv5-journal-play-badge" aria-hidden="true">
            ▶ Watch the movie · 10 sec 🔊
          </span>
        </button>
      </figure>
    );
  }

  if (phase === "loading") {
    return (
      <figure className="hv5-entry-art hv5-journal-art">
        <LazyHomeImage src={imageSrc} alt={imageAlt} />
        <p className="hv5-journal-status" data-testid={`journal-loading-${noteId}`}>
          Loading the movie…
        </p>
        <button
          type="button"
          className="hv5-journal-close"
          ref={closeRef}
          data-testid={`journal-player-close-${noteId}`}
          aria-label="Close movie"
          onClick={onClose}
        >
          ✕ Close
        </button>
      </figure>
    );
  }

  if (phase === "error" || movieUrl === null) {
    return (
      <figure className="hv5-entry-art hv5-journal-art">
        <LazyHomeImage src={imageSrc} alt={imageAlt} />
        <p className="hv5-journal-status" role="alert" data-testid={`journal-error-${noteId}`}>
          This story&rsquo;s movie isn&rsquo;t ready yet.
        </p>
        <div className="hv5-journal-controls">
          <button
            type="button"
            className="hv5-journal-close"
            data-testid={`journal-player-retry-${noteId}`}
            onClick={handleRetry}
          >
            ↻ Try again
          </button>
          <button
            type="button"
            className="hv5-journal-close"
            ref={closeRef}
            data-testid={`journal-player-close-${noteId}`}
            aria-label="Close movie"
            onClick={onClose}
          >
            ✕ Close
          </button>
        </div>
      </figure>
    );
  }

  return (
    <figure className="hv5-entry-art hv5-journal-art">
      <video
        ref={videoRef}
        className="hv5-journal-video"
        data-testid={`journal-movie-${noteId}`}
        src={movieUrl}
        poster={imageSrc}
        preload="none"
        loop={!reduceMotion}
        playsInline
        tabIndex={-1}
        aria-label={`${place} movie`}
        onPlay={() => {
          setPaused(false);
          setEnded(false);
        }}
        onPause={() => setPaused(true)}
        onEnded={() => {
          setPaused(true);
          setEnded(true);
        }}
        onTimeUpdate={handleTimeUpdate}
        onError={() => setPhase("error")}
        onClick={handleVideoClick}
      />
      {showPauseFlash && (
        <span
          className="hv5-journal-pause-flash"
          data-testid={`journal-player-pause-flash-${noteId}`}
          aria-hidden="true"
        >
          ⏸
        </span>
      )}
      <div className="hv5-journal-controls">
        <button
          type="button"
          className="hv5-journal-toggle"
          data-testid={`journal-player-toggle-${noteId}`}
          aria-label={ended ? "Play movie again" : paused ? "Play movie" : "Pause movie"}
          onClick={togglePlay}
        >
          {ended ? "▶ Play again" : paused ? "▶ Play" : "⏸ Pause"}
        </button>
        <button
          type="button"
          className="hv5-journal-mute"
          data-testid={`journal-player-mute-${noteId}`}
          aria-label={muted ? "Unmute movie" : "Mute movie"}
          aria-pressed={muted}
          onClick={() => setMuted((m) => !m)}
        >
          {muted ? "🔇 Muted" : "🔊 Sound"}
        </button>
        <div
          className="hv5-journal-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Movie progress"
        >
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <span className="hv5-journal-time" data-testid={`journal-player-time-${noteId}`}>
          {timeText}
        </span>
        <button
          type="button"
          className="hv5-journal-close"
          ref={closeRef}
          data-testid={`journal-player-close-${noteId}`}
          aria-label="Close movie"
          onClick={onClose}
        >
          ✕ Close
        </button>
      </div>
    </figure>
  );
}
