import type { JSX } from "react";
import { useEffect } from "react";
import { formatDistance } from "@/game/geo";
import type { TutorialBeat } from "@/game/tutorial";

/**
 * First-run tutorial UI: an inline menu invitation plus three beat
 * overlays. Every surface is dismissible and none of them blocks play —
 * the invitation is an inline banner (the edition buttons stay one tap
 * away), beats 1–2 are pointer-transparent except their own buttons, and
 * every beat offers an instant skip/finish.
 *
 * Copy rules: kid reading age ~10, one idea per line, bold anchors,
 * no text walls (ADHD-friendly). No map labels are added anywhere, so the
 * no-labels policy holds.
 */

const cardClass =
  "rounded-xl border border-line bg-surface p-5 text-fg shadow-lg";

export function TutorialInvite(props: {
  onTakeTour: () => void;
  onDismiss: () => void;
}): JSX.Element {
  return (
    <section
      data-testid="tutorial-invite"
      aria-label="First-run tutorial invitation"
      className={`${cardClass} mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}
    >
      <div>
        <p className="text-lg font-semibold">
          <span role="img" aria-hidden="true">
            🗺️
          </span>{" "}
          New to Meridian?
        </p>
        <p className="mt-1 text-sm text-muted">
          Take a <strong className="text-fg">30-second tour</strong> — learn
          the only move in the game.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={props.onTakeTour}
          className="rounded-full bg-fg px-5 py-2 text-sm font-medium text-bg"
        >
          Take the tour
        </button>
        <button
          type="button"
          onClick={props.onDismiss}
          className="rounded-full px-5 py-2 text-sm font-medium text-muted hover:text-fg"
        >
          Not now
        </button>
      </div>
    </section>
  );
}

/**
 * Beat 1 (aim) and beat 2 (reveal) render as floating banners that never
 * intercept map taps: the wrapper is pointer-transparent and only the
 * action buttons re-enable pointer events.
 */
function FloatingBanner(props: {
  testId: string;
  label: string;
  /** Extra positioning classes (beat 1 dodges the question bubble on phones). */
  positionClass?: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      data-testid={props.testId}
      role="status"
      aria-label={props.label}
      className={`pointer-events-none absolute inset-x-3 z-40 mx-auto max-w-md ${
        props.positionClass ?? "top-16"
      }`}
    >
      <div className={cardClass}>{props.children}</div>
    </div>
  );
}

function SkipButton(props: { onSkip: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onSkip}
      className="pointer-events-auto mt-3 text-sm font-medium text-muted underline-offset-2 hover:text-fg hover:underline"
    >
      Skip tour
    </button>
  );
}

export function TutorialOverlay(props: {
  beat: TutorialBeat;
  /** Beat 2: km from the pin to the practice place (null when unknown). */
  distanceKm: number | null;
  /** Beat 2: whether the practice pin was a hit. */
  hit: boolean;
  onSkip: () => void;
  /** Beat 2 → beat 3. */
  onGotIt: () => void;
  /** Beat 3 → back to the menu. */
  onFinish: () => void;
}): JSX.Element {
  const { beat, onFinish } = props;
  // Escape closes the closing dialog like the primary button does. The
  // hook lives at the top level (never conditional): beat changes 2 → 3
  // across renders of this same component instance.
  useEffect(() => {
    if (beat !== 3) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onFinish();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [beat, onFinish]);

  if (beat === 3) {
    return (
      <div
        data-testid="tutorial-beat-3"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-beat-3-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-5"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-black/60"
          onClick={props.onFinish}
        />
        <div className={`${cardClass} relative max-w-md text-center`}>
          <p id="tutorial-beat-3-title" className="text-2xl font-semibold">
            <span role="img" aria-hidden="true">
              🎉
            </span>{" "}
            That&rsquo;s the whole game!
          </p>
          <p className="mt-3 text-lg">One place, one pin, one story.</p>
          <p className="mt-2 text-sm text-muted">
            The real map has <strong className="text-fg">100,000+ places</strong>.
            Where will you go first?
          </p>
          <button
            type="button"
            autoFocus
            onClick={props.onFinish}
            className="mt-5 rounded-full bg-fg px-6 py-2.5 text-base font-medium text-bg"
          >
            Start exploring
          </button>
        </div>
      </div>
    );
  }

  if (props.beat === 2) {
    const distanceLine =
      props.distanceKm === null ? (
        <>Pin dropped!</>
      ) : props.hit ? (
        <>
          <strong>Bullseye</strong> — that&rsquo;s the Eiffel Tower!
        </>
      ) : (
        <>
          You&rsquo;re <strong>{formatDistance(props.distanceKm)}</strong> from
          the Eiffel Tower.
        </>
      );
    return (
      <FloatingBanner testId="tutorial-beat-2" label="Tutorial: your reveal">
        <>
          <p className="text-lg font-semibold">
            <span role="img" aria-hidden="true">
              🎉
            </span>{" "}
            {distanceLine}
          </p>
          <p className="mt-2 text-sm text-muted">
            Closer guesses earn <strong className="text-fg">more points</strong>{" "}
            — and every place tells its story.{" "}
            <span role="img" aria-label="look below">
              👇
            </span>
          </p>
          <button
            type="button"
            onClick={props.onGotIt}
            className="pointer-events-auto mt-4 rounded-full bg-fg px-5 py-2 text-sm font-medium text-bg"
          >
            Got it
          </button>
        </>
      </FloatingBanner>
    );
  }

  return (
    <FloatingBanner
      testId="tutorial-beat-1"
      label="Tutorial: how to play"
      // On phones the question bubble occupies the top-left; park the
      // coachmark above the Drop pin pill instead of covering the bubble.
      positionClass="top-16 max-sm:top-auto max-sm:bottom-24"
    >
      <>
        <p className="text-lg font-semibold">
          <span role="img" aria-hidden="true">
            👆
          </span>{" "}
          <strong>Tap the map</strong> to drop your pin.
        </p>
        <p className="mt-2 text-sm text-muted">
          Easy one to start: the <strong className="text-fg">Eiffel Tower</strong>,
          in Paris. Then press <strong className="text-fg">Drop pin</strong>.
        </p>
        <SkipButton onSkip={props.onSkip} />
      </>
    </FloatingBanner>
  );
}
